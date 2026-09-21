/**
 * Rechnung erstellen — 3-Schritt-Wizard.
 * Steps: 1) Fertigen Auftrag wählen → 2) Beträge prüfen & bestätigen → 3) Fälligkeit erfassen → 4) Prüfen & anlegen.
 * Reads: auftraege (filter: status=fertig), auftragspositionen (per Auftrag, für Netto-Summe), kunden (via Auftrag→Fahrzeug→Halter).
 * Writes: rechnungen (createRechnungenEntry), auftraege update (status=abgerechnet).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState, useEffect } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup, fieldRef, fieldNumber, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { DatePicker } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { tx } from '@/i18n';

export default function RechnungErstellenPage() {
  const [step, setStep] = useState(1);

  // Nur Aufträge mit Status 'fertig' anzeigen
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    searchFields: ['auftragsnummer'],
    filter: "r.v_status == 'fertig'",
    where: r => fieldLookup(r, 'status')?.key === 'fertig',
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldLookup(a, 'status')?.label,
      status: fieldLookup(a, 'status') ?? undefined,
    }),
    orderby: ['r.v_auftragsnummer asc'],
  });

  // Formular für Rechnungen — Felder die der Nutzer eingibt
  const rechnung = useStepForm('rechnungen', {
    fields: ['auftrag', 'kunde', 'rechnungsdatum', 'faelligkeit', 'nettobetrag', 'mwst', 'bruttobetrag', 'status'],
    steps: {
      auftrag: 1,
      nettobetrag: 2,
      mwst: 2,
      bruttobetrag: 2,
      faelligkeit: 3,
    },
    initial: {
      rechnungsdatum: todayIso(),
      status: 'offen',
    },
    required: {
      // Diese Felder werden vom System gesetzt, nicht erfragt
      rechnungsnummer: false,
      zahlungseingang: false,
    },
  });

  // Geladenen Auftrag für die Positionsberechnung
  const [positionenLoading, setPositionenLoading] = useState(false);
  const [kundeId, setKundeId] = useState<string | null>(null);

  // Wenn ein Auftrag gewählt wird: Positionen laden und Beträge berechnen
  const auftragId = rechnung.get('auftrag') as string | null;

  useEffect(() => {
    if (!auftragId) return;

    let cancelled = false;
    setPositionenLoading(true);

    const loadPositionenUndKunde = async () => {
      try {
        // Positionen des Auftrags laden
        const positionen = await servicePort.list('auftragspositionen', {
          filter: tx`'${auftragId}' in str(r.v_auftrag)`,
        });

        if (cancelled) return;

        // Netto-Summe berechnen
        const netto = positionen.reduce((sum, p) => {
          const menge = fieldNumber(p, 'menge') ?? 0;
          const einzelpreis = fieldNumber(p, 'einzelpreis') ?? 0;
          return sum + menge * einzelpreis;
        }, 0);

        const mwst = Math.round(netto * 0.19 * 100) / 100;
        const brutto = Math.round((netto + mwst) * 100) / 100;
        const nettoRound = Math.round(netto * 100) / 100;

        rechnung.set('nettobetrag', String(nettoRound));
        rechnung.set('mwst', String(mwst));
        rechnung.set('bruttobetrag', String(brutto));

        // Kunde über Auftrag → Fahrzeug → Halter ermitteln
        const auftragRecord = auftraege.recordOf(auftragId);
        if (auftragRecord) {
          const fahrzeugId = fieldRef(auftragRecord, 'fahrzeug');
          if (fahrzeugId) {
            const fahrzeug = await servicePort.get('fahrzeuge', fahrzeugId);
            if (cancelled) return;
            if (fahrzeug) {
              const halterId = fieldRef(fahrzeug, 'halter');
              if (halterId) {
                setKundeId(halterId);
                rechnung.set('kunde', halterId, undefined);
              }
            }
          }
        }
      } finally {
        if (!cancelled) setPositionenLoading(false);
      }
    };

    loadPositionenUndKunde();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftragId]);

  // Plan: 1) Rechnung anlegen, 2) Auftragsstatus auf 'abgerechnet' setzen
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'rechnung',
      entity: 'rechnungen',
      form: rechnung,
      primary: true,
      values: {
        status: 'offen',
        rechnungsdatum: todayIso(),
      },
    },
    {
      key: 'auftragUpdate',
      entity: 'auftraege',
      updates: auftragId ?? '',
      needs: ['rechnung'],
      values: { status: 'abgerechnet' },
      verb: 'update',
    },
  ], { draftKey: 'rechnung-erstellen' });

  return (
    <IntentWizardShell
      title={tx('Rechnung erstellen')}
      subtitle={tx('Abgeschlossenen Auftrag abrechnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[rechnung]}
      draftKey="rechnung-erstellen"
      intro={{
        description: tx('Einen fertigen Auftrag auswählen und eine Rechnung mit automatisch berechneten Beträgen anlegen.'),
        needs: [tx('Auftragsnummer des fertigen Auftrags')],
      }}
    >
      {/* Schritt 1: Fertigen Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Einen Auftrag mit Status „Fertig" wählen, der noch nicht abgerechnet wurde.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={rechnung.get('auftrag') as string | null}
          avatar="none"
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          emptyText={tx('Kein fertiger Auftrag gefunden. Aufträge müssen den Status „Fertig" haben — neue Aufträge werden im Ablauf „Auftrag annehmen" erstellt.')}
          onSelect={id => {
            rechnung.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
        />
      </WizardStep>

      {/* Schritt 2: Beträge prüfen und ggf. korrigieren */}
      <WizardStep
        label={tx('Beträge')}
        description={tx('Die aus den Positionen berechneten Beträge prüfen und bei Bedarf anpassen.')}
        needs={['auftrag']}
      >
        {rechnung.get('auftrag') ? (
          <div className="space-y-4">
            {positionenLoading && (
              <p className="text-sm text-muted-foreground">{tx('Positionen werden berechnet …')}</p>
            )}
            <Field form={rechnung} name="nettobetrag" hint={tx('Summe aller Positionen (ohne MwSt.)')}>
              <Input {...rechnung.number('nettobetrag')} />
            </Field>
            <Field form={rechnung} name="mwst" hint={tx('19 % MwSt. auf den Nettobetrag')}>
              <Input {...rechnung.number('mwst')} />
            </Field>
            <Field form={rechnung} name="bruttobetrag" hint={tx('Nettobetrag + MwSt.')}>
              <Input {...rechnung.number('bruttobetrag')} />
            </Field>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => rechnung.validate(['nettobetrag', 'mwst', 'bruttobetrag'])}
              nextStepLabel={tx('Fälligkeit')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            <p className="text-sm text-muted-foreground">{tx('Bitte zuerst einen Auftrag wählen.')}</p>
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: Fälligkeit erfassen */}
      <WizardStep
        label={tx('Fälligkeit')}
        heading={tx('Zahlungsfrist festlegen')}
        description={tx('Bis wann muss die Rechnung bezahlt sein?')}
        needs={['auftrag']}
      >
        {rechnung.get('auftrag') ? (
          <div className="space-y-4">
            <Field form={rechnung} name="faelligkeit" hint={tx('Datum, bis wann die Rechnung bezahlt sein muss')}>
              <DatePicker {...rechnung.date('faelligkeit')} />
            </Field>
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => rechnung.validate(['faelligkeit'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            <p className="text-sm text-muted-foreground">{tx('Bitte zuerst einen Auftrag wählen.')}</p>
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 4: Zusammenfassung und Bestätigung */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[rechnung]}
            submit={submit}
            items={[
              { key: '_status', label: tx('Status'), value: tx('Offen') },
              { key: '_rechnungsdatum', label: tx('Rechnungsdatum'), value: todayIso() },
              ...(kundeId ? [{ key: '_kunde', label: tx('Kunde'), value: tx('Wird aus dem Auftrag übernommen') }] : []),
            ]}
            whatHappensNext={tx('Die Rechnung wird mit Status „Offen" angelegt und der Auftrag auf „Abgerechnet" gesetzt.')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[rechnung]}
          submit={submit}
          whatHappensNext={tx('Die Rechnung erscheint in der Rechnungsübersicht. Der Auftrag ist jetzt als abgerechnet markiert.')}
          next={[
            { label: tx('Weitere Rechnung erstellen') },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
