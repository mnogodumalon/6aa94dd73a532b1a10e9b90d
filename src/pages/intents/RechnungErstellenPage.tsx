/**
 * Rechnung erstellen — 4-Schritt-Wizard.
 * Steps: 1) Fertigen Auftrag wählen → 2) Rechnungsdatum & Fälligkeit →
 *        3) Beträge eingeben (mit Positionsübersicht) → 4) Prüfen & anlegen.
 * Reads: auftraege (status=fertig), auftragspositionen (per gewähltem Auftrag),
 *        fahrzeuge (via Auftrag), kunden (via Fahrzeug→Halter).
 * Writes: rechnungen (createRechnungenEntry), auftraege.status → abgerechnet (updateAuftraegeEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldText,
  fieldLookup,
  fieldNumber,
  fieldRef,
  todayIso,
  refFilter,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function RechnungErstellenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Auftrag wählen — nur Status "fertig"
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    filter: "r.v_status == 'fertig'",
    where: r => fieldLookup(r, 'status')?.key === 'fertig',
    searchFields: ['auftragsnummer'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      status: fieldLookup(a, 'status') ?? undefined,
    }),
  });

  // Ausgewählter Auftrag — wird in Step 3 für Positionsübersicht benötigt
  const [selectedAuftragId, setSelectedAuftragId] = useState<string | null>(null);

  // Positionen des gewählten Auftrags — für Referenzanzeige in Step 3
  const positionen = useRecordSearch(servicePort, 'auftragspositionen', {
    filter: selectedAuftragId ? refFilter('auftrag', selectedAuftragId) : tx('r.v_auftrag is None'),
    where: r => fieldRef(r, 'auftrag') === selectedAuftragId,
    searchFields: ['bezeichnung'],
    toItem: p => ({
      id: p.id,
      title: fieldText(p, 'bezeichnung'),
      subtitle: [
        fieldLookup(p, 'positionstyp')?.label,
        fieldNumber(p, 'menge') != null ? `${fieldNumber(p, 'menge')} ×` : undefined,
        fieldNumber(p, 'einzelpreis') != null
          ? `${fieldNumber(p, 'einzelpreis')?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`
          : undefined,
      ]
        .filter(Boolean)
        .join(' '),
    }),
  });

  // Formular für rechnungen
  const rechnung = useStepForm('rechnungen', {
    fields: ['auftrag', 'kunde', 'rechnungsdatum', 'faelligkeit', 'nettobetrag', 'mwst', 'bruttobetrag', 'status'],
    steps: {
      auftrag: 1,
      kunde: 1,
      rechnungsdatum: 2,
      faelligkeit: 2,
      nettobetrag: 3,
      mwst: 3,
      bruttobetrag: 3,
    },
    initial: {
      rechnungsdatum: todayIso(),
      status: 'offen',
    },
    required: {
      // rechnungsnummer wird vom Tool vergeben, nicht hier
      rechnungsnummer: false,
    },
  });

  // Plan: zuerst Rechnung anlegen, dann Auftrag auf abgerechnet setzen
  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'rechnung',
        entity: 'rechnungen',
        form: rechnung,
        values: { status: 'offen', rechnungsdatum: todayIso() },
        primary: true,
      },
      {
        key: 'statusUpdate',
        entity: 'auftraege',
        needs: ['rechnung'],
        updates: selectedAuftragId ?? '',
        values: { status: 'abgerechnet' },
        verb: 'update',
      },
    ],
    { draftKey: 'rechnung-erstellen' }
  );

  // Positionssumme für Hinweis in Step 3
  const positionenSumme = positionen.records.reduce(
    (sum, p) => sum + (fieldNumber(p, 'menge') ?? 0) * (fieldNumber(p, 'einzelpreis') ?? 0),
    0
  );

  const handleAuftragSelect = async (id: string) => {
    rechnung.set('auftrag', id, auftraege.labelOf(id));
    setSelectedAuftragId(id);

    // Kunden aus Fahrzeug→Halter ableiten
    const auftragRecord = auftraege.recordOf(id);
    if (auftragRecord) {
      const fahrzeugId = fieldRef(auftragRecord, 'fahrzeug');
      if (fahrzeugId) {
        const fahrzeug = await servicePort.get('fahrzeuge', fahrzeugId);
        if (fahrzeug) {
          const kundeId = fieldRef(fahrzeug, 'halter');
          if (kundeId) {
            const kunde = await servicePort.get('kunden', kundeId);
            if (kunde) {
              const kundeName =
                [fieldText(kunde, 'vorname'), fieldText(kunde, 'nachname')]
                  .filter(Boolean)
                  .join(' ') || kundeId;
              rechnung.set('kunde', kundeId, kundeName);
            }
          }
        }
      }
    }

    setStep(2);
  };

  return (
    <IntentWizardShell
      title={tx('Rechnung erstellen')}
      subtitle={tx('Fertigen Auftrag abrechnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[rechnung]}
      draftKey="rechnung-erstellen"
      intro={{
        description: tx('Wähle einen fertigen Auftrag und erstelle daraus eine Rechnung.'),
        needs: [tx('Abgeschlossener Auftrag (Status: Fertig)'), tx('Fälligkeitsdatum')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Nur Aufträge mit Status „Fertig" können abgerechnet werden.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={rechnung.get('auftrag') as string}
          onSelect={handleAuftragSelect}
          emptyText={tx('Keine fertigen Aufträge vorhanden. Erst einen Auftrag fertigstellen.')}
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 2: Datum & Fälligkeit */}
      <WizardStep
        label={tx('Datum')}
        description={tx('Das Rechnungsdatum ist auf heute gesetzt. Fälligkeitsdatum eingeben.')}
        needs={['auftrag']}
      >
        {rechnung.get('auftrag') ? (
          <div className="space-y-5">
            {/* Rechnungsdatum: vorausgefüllt, nicht editierbar */}
            <div className="rounded-lg border bg-secondary/40 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{tx('Rechnungsdatum:')}</span>{' '}
              <span className="text-muted-foreground">
                {todayIso()}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">{tx('Wird automatisch auf heute gesetzt.')}</p>
            </div>

            <Bound form={rechnung} name="faelligkeit" hint={tx('Bis wann ist die Rechnung zu begleichen?')} />

            <StepNav
              onNext={() => rechnung.validate(['faelligkeit'])}
              nextStepLabel={tx('Beträge')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)}>
            <p className="text-sm text-muted-foreground">{tx('Bitte zuerst einen Auftrag wählen.')}</p>
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: Beträge */}
      <WizardStep
        label={tx('Beträge')}
        description={tx('Nettobetrag, MwSt und Bruttobetrag aus den Positionen prüfen und eingeben.')}
        needs={['auftrag']}
      >
        {rechnung.get('auftrag') ? (
          <div className="space-y-5">
            {/* Positionsübersicht als Referenz */}
            {positionen.records.length > 0 && (
              <div className="rounded-lg border bg-secondary/40 p-4">
                <p className="mb-2 text-sm font-medium text-foreground">{tx('Auftragspositionen (Referenz)')}</p>
                <ul className="space-y-1">
                  {positionen.records.map(p => (
                    <li key={p.id} className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="min-w-0 truncate">
                        <StatusBadge
                          statusKey={fieldLookup(p, 'positionstyp')?.key}
                          label={fieldLookup(p, 'positionstyp')?.label}
                          className="mr-2 text-xs"
                        />
                        {fieldText(p, 'bezeichnung')}
                      </span>
                      <span className="ml-2 shrink-0 font-medium">
                        {fieldNumber(p, 'menge') != null && fieldNumber(p, 'einzelpreis') != null
                          ? ((fieldNumber(p, 'menge') ?? 0) * (fieldNumber(p, 'einzelpreis') ?? 0)).toLocaleString('de-DE', {
                              style: 'currency',
                              currency: 'EUR',
                            })
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {positionenSumme > 0 && (
                  <div className="mt-3 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>{tx('Summe (netto)')}</span>
                    <span>
                      {positionenSumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Bound
              form={rechnung}
              name="nettobetrag"
              hint={tx('Nettobetrag aus den Positionen übernehmen oder anpassen.')}
            />
            <Bound form={rechnung} name="mwst" hint={tx('MwSt-Betrag (z. B. 19 % auf den Nettobetrag).')} />
            <Bound
              form={rechnung}
              name="bruttobetrag"
              hint={tx('Bruttobetrag = Nettobetrag + MwSt.')}
            />

            <StepNav
              onNext={() => rechnung.validate(['nettobetrag', 'mwst', 'bruttobetrag'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)}>
            <p className="text-sm text-muted-foreground">{tx('Bitte zuerst einen Auftrag wählen.')}</p>
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[rechnung]}
            submit={submit}
            items={[
              {
                key: '_rechnungsdatum',
                label: tx('Rechnungsdatum'),
                value: todayIso(),
              },
              {
                key: '_status',
                label: tx('Status'),
                value: tx('Offen'),
              },
              {
                key: '_auftragsstatus',
                label: tx('Auftragsstatus nach Anlage'),
                value: tx('Abgerechnet'),
              },
            ]}
            whatHappensNext={tx(
              'Die Rechnung wird angelegt und der Auftrag auf „Abgerechnet" gesetzt.'
            )}
            confirmLabel={tx('Rechnung anlegen')}
          />
        )}
      </WizardStep>

      {/* Erfolgsschritt */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[rechnung]}
          submit={submit}
          whatHappensNext={tx(
            'Der Auftrag ist auf „Abgerechnet" gesetzt. Die Rechnungsnummer wird automatisch vergeben.'
          )}
          next={[
            {
              label: tx('Weitere Rechnung erstellen'),
            },
            {
              label: tx('Position hinzufügen'),
              href: '#/intents/position-hinzufuegen',
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
