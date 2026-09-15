/**
 * Auftrag abrechnen — 4-Schritt-Wizard.
 * Steps: 1) Auftrag wählen (nur status='fertig') → 2) Rechnungsdaten eintragen
 *        → 3) Beträge eintragen → 4) Prüfen & anlegen.
 * Reads: auftraege (gefiltert auf 'fertig'). Writes: rechnungen (create),
 *        auftraege (update status → 'abgerechnet').
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav,
 *           Field, Bound, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
  fieldRef,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function AuftragAbrechnungPage() {
  const [step, setStep] = useState(1);

  // Step 1: Nur fertige Aufträge
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    filter: "r.v_status == 'fertig'",
    where: r => fieldLookup(r, 'status')?.key === 'fertig',
    searchFields: ['auftragsnummer', 'kundenwunsch'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldText(a, 'kundenwunsch') || undefined,
      status: fieldLookup(a, 'status') ?? undefined,
    }),
  });

  // Rechnungsformular (Steps 2 + 3)
  const rechnung = useStepForm('rechnungen', {
    steps: {
      rechnungsnummer: 2,
      rechnungsdatum: 2,
      faelligkeit: 2,
      nettobetrag: 3,
      mwst: 3,
      bruttobetrag: 3,
    },
    initial: {
      rechnungsdatum: todayIso(),
    },
    // auftrag, kunde und status kommen aus dem Plan — nicht vom Benutzer abgefragt
    required: { auftrag: false, kunde: false, status: false },
  });

  // Fahrzeug des gewählten Auftrags holen → daraus Halter (Kunde) ermitteln
  const [kundeLabel, setKundeLabel] = useState<string>('');
  const [kundeId, setKundeId] = useState<string | null>(null);

  const auftragId = rechnung.get('auftrag') as string | undefined;

  const plan = useJourneySubmit(
    servicePort,
    [
      {
        key: 'rechnung',
        entity: 'rechnungen',
        form: rechnung,
        primary: true,
        values: () => ({
          status: 'offen',
          auftrag: auftragId ?? '',
          kunde: kundeId ?? '',
        }),
      },
      {
        key: 'auftrag_status',
        entity: 'auftraege',
        updates: auftragId ?? '',
        values: { status: 'abgerechnet' },
        needs: ['rechnung'],
        verb: 'update',
      },
    ],
    { draftKey: 'auftrag-abrechnen' }
  );

  const handleSelectAuftrag = async (id: string) => {
    const label = auftraege.labelOf(id);
    rechnung.set('auftrag', id, label);

    // Fahrzeug des Auftrags lesen → Halter holen
    const auftragRecord = auftraege.recordOf(id);
    const fahrzeugId = auftragRecord ? fieldRef(auftragRecord, 'fahrzeug') : null;

    if (fahrzeugId) {
      try {
        const fahrzeug = await servicePort.get('fahrzeuge', fahrzeugId);
        if (fahrzeug) {
          const halterId = fieldRef(fahrzeug, 'halter');
          if (halterId) {
            rechnung.set('kunde', halterId, undefined);
            setKundeId(halterId);
            // Kundennamen laden
            const kunde = await servicePort.get('kunden', halterId);
            if (kunde) {
              const name = `${fieldText(kunde, 'vorname')} ${fieldText(kunde, 'nachname')}`.trim();
              setKundeLabel(name);
              rechnung.remember(halterId, name);
            }
          }
        }
      } catch {
        // Kunde bleibt unbekannt
      }
    }

    setStep(2);
  };

  const restart = () => {
    plan.reset();
    rechnung.reset({ rechnungsdatum: todayIso() }, {});
    setKundeLabel('');
    setKundeId(null);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Auftrag abrechnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[rechnung]}
      draftKey="auftrag-abrechnen"
      intro={{
        description: tx('Einen fertigen Auftrag abrechnen und eine Rechnung anlegen.'),
        needs: [tx('Auftragsnummer'), tx('Rechnungsnummer'), tx('Beträge aus den Positionen')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Nur Aufträge mit Status „fertig" können abgerechnet werden.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={rechnung.get('auftrag') as string | undefined}
          onSelect={handleSelectAuftrag}
          emptyText={tx('Kein fertiger Auftrag gefunden. Bitte zuerst den Auftrag als fertig markieren.')}
          searchPlaceholder={tx('Auftragsnummer oder Kundenwunsch suchen …')}
          create={false}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 2: Rechnungsdaten */}
      <WizardStep
        label={tx('Rechnungsdaten')}
        description={tx('Rechnungsnummer, Datum und Fälligkeit eintragen.')}
        needs={['auftrag']}
      >
        <div className="space-y-4">
          {/* Kunde (read-only, aus Auftrag → Fahrzeug → Halter) */}
          {kundeLabel && (
            <div className="rounded-lg bg-secondary px-4 py-3 text-sm">
              <span className="text-muted-foreground">{tx('Kunde')}: </span>
              <span className="font-medium">{kundeLabel}</span>
            </div>
          )}

          <Bound
            form={rechnung}
            name="rechnungsnummer"
            hint={tx('z.B. R-2026-042')}
          />
          <Bound form={rechnung} name="rechnungsdatum" />
          <Bound
            form={rechnung}
            name="faelligkeit"
            hint={tx('Üblicherweise 14 Tage nach Rechnungsdatum')}
          />

          <StepNav
            onBack={() => setStep(1)}
            onNext={() => rechnung.validate(['rechnungsnummer', 'rechnungsdatum'])}
            nextStepLabel={tx('Beträge')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Beträge */}
      <WizardStep
        label={tx('Beträge')}
        description={tx('Bitte Summe aus den Positionen übernehmen.')}
        needs={['rechnungsnummer', 'rechnungsdatum']}
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground">
            {tx('Die Beträge ergeben sich aus den Auftragspositionen — bitte manuell aus der Positionsliste übernehmen.')}
          </p>

          <Field form={rechnung} name="nettobetrag" label={tx('Nettobetrag (EUR)')}>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...rechnung.number('nettobetrag')}
            />
          </Field>
          <Field form={rechnung} name="mwst" label={tx('MwSt (EUR)')}>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...rechnung.number('mwst')}
            />
          </Field>
          <Field form={rechnung} name="bruttobetrag" label={tx('Bruttobetrag (EUR)')}>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...rechnung.number('bruttobetrag')}
            />
          </Field>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => rechnung.validate(['nettobetrag', 'bruttobetrag'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & Anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!plan.done && (
          <SummaryStep
            forms={[rechnung]}
            submit={plan}
            items={[
              {
                key: '_kunde',
                label: tx('Kunde'),
                value: kundeLabel || tx('—'),
              },
              {
                key: '_status',
                label: tx('Rechnungsstatus'),
                value: tx('Offen'),
              },
            ]}
            whatHappensNext={tx(
              'Die Rechnung wird angelegt und der Auftrag auf „abgerechnet" gesetzt.'
            )}
            confirmLabel={tx('Rechnung anlegen')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {plan.result && (
        <SuccessStep
          result={plan.result}
          forms={[rechnung]}
          submit={plan}
          restartLabel={tx('Weitere Abrechnung')}
          next={[
            { label: tx('Position buchen'), href: '#/intents/position-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx(
            'Der Auftrag ist jetzt als „abgerechnet" markiert. Die Rechnung kann beim Kunden eingesehen werden.'
          )}
        />
      )}
    </IntentWizardShell>
  );
}
