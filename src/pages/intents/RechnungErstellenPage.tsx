/**
 * Rechnung erstellen — 3-Schritt-Wizard.
 * Steps: 1) Fertigen Auftrag wählen → 2) Rechnungsdaten erfassen → 3) Prüfen & anlegen.
 * Reads: auftraege (filter status=fertig), auftragspositionen (sum for nettobetrag prefill),
 *        fahrzeuge (to derive halter/kunde from picked auftrag).
 * Writes: rechnungen (createRechnungenEntry) + updates auftraege.status → abgerechnet.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState, useEffect } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
  fieldRef,
  fieldNumber,
  refFilter,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function RechnungErstellenPage() {
  const [step, setStep] = useState(1);
  const [kundeId, setKundeId] = useState<string | null>(null);
  const [positionenSum, setPositionenSum] = useState<number | null>(null);

  // Step 1: pick a finished Auftrag
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

  // Form for step 2: invoice data
  // rechnungsnummer is required by entity but owned by a tool — mark not required here
  // auftrag, kunde, rechnungsdatum, status are set by the plan, not asked
  const rechnung = useStepForm('rechnungen', {
    fields: ['faelligkeit', 'nettobetrag', 'mwst', 'bruttobetrag'],
    steps: { faelligkeit: 2, nettobetrag: 2, mwst: 2, bruttobetrag: 2 },
    required: { rechnungsnummer: false },
  });

  const pickedAuftragId = rechnung.get('auftrag') as string | undefined;

  // When an auftrag is picked: resolve fahrzeug → halter (kunde) and load positionen sum
  useEffect(() => {
    if (!pickedAuftragId) {
      setKundeId(null);
      setPositionenSum(null);
      return;
    }
    const auftragRecord = auftraege.recordOf(pickedAuftragId);
    if (!auftragRecord) return;

    const fahrzeugId = fieldRef(auftragRecord, 'fahrzeug');
    if (!fahrzeugId) return;

    let cancelled = false;

    (async () => {
      // Get fahrzeug to find halter (kunde)
      const fahrzeug = await servicePort.get('fahrzeuge', fahrzeugId);
      if (cancelled) return;
      if (fahrzeug) {
        const halterId = fieldRef(fahrzeug, 'halter');
        setKundeId(halterId);
      }

      // Load auftragspositionen to compute sum
      const positionen = await servicePort.list('auftragspositionen', {
        filter: refFilter('auftrag', pickedAuftragId),
        fields: ['einzelpreis', 'menge'],
      });
      if (cancelled) return;
      const sum = positionen.reduce((acc, p) => {
        const einzelpreis = fieldNumber(p, 'einzelpreis') ?? 0;
        const menge = fieldNumber(p, 'menge') ?? 0;
        return acc + einzelpreis * menge;
      }, 0);
      setPositionenSum(sum);
      // Prefill nettobetrag with the computed sum if the user hasn't entered it yet
      if (!rechnung.get('nettobetrag')) {
        rechnung.set('nettobetrag', String(Math.round(sum * 100) / 100));
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAuftragId]);

  const auftragLabel = pickedAuftragId ? (auftraege.labelOf(pickedAuftragId) ?? '') : '';

  // Plan: 1) create rechnungen, 2) update auftraege status → abgerechnet
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'rechnung',
      entity: 'rechnungen',
      form: rechnung,
      primary: true,
      values: (_ctx) => ({
        auftrag: pickedAuftragId ?? '',
        kunde: kundeId ?? '',
        rechnungsdatum: todayIso(),
        status: 'offen',
      }),
    },
    {
      key: 'auftrag_abgerechnet',
      entity: 'auftraege',
      needs: ['rechnung'],
      updates: pickedAuftragId ?? '',
      values: { status: 'abgerechnet' },
    },
  ], { draftKey: 'rechnung-erstellen' });

  return (
    <IntentWizardShell
      title={tx('Rechnung erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[rechnung]}
      draftKey="rechnung-erstellen"
      intro={{
        description: tx('Fertigen Auftrag auswählen und daraus eine Rechnung anlegen.'),
        needs: [tx('Auftragsnummer des fertigen Auftrags'), tx('Fälligkeitsdatum'), tx('Beträge (Netto, MwSt., Brutto)')],
      }}
    >
      {/* Step 1: Pick a finished Auftrag */}
      <WizardStep
        label={tx('Auftrag')}
        heading={tx('Fertigen Auftrag wählen')}
        description={tx('Nur Aufträge mit Status „Fertig" können abgerechnet werden.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={pickedAuftragId ?? null}
          create={false}
          emptyText={tx('Kein Auftrag hat den Status „Fertig". Bitte erst einen Auftrag fertigstellen.')}
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          avatar="none"
          onSelect={id => {
            rechnung.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
        />
      </WizardStep>

      {/* Step 2: Invoice data */}
      <WizardStep
        label={tx('Rechnungsdaten')}
        description={tx('Fälligkeit und Beträge für die Rechnung eintragen.')}
        needs={['auftrag']}
      >
        {pickedAuftragId ? (
          <div className="space-y-4">
            {positionenSum !== null && (
              <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground">
                {tx('Summe der Positionen')}{': '}
                <span className="font-medium text-foreground">
                  {positionenSum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            )}
            <Bound form={rechnung} name="faelligkeit" />
            <Bound form={rechnung} name="nettobetrag" hint={tx('Nettobetrag (€)')} />
            <Bound form={rechnung} name="mwst" hint={tx('MwSt.-Betrag (€)')} />
            <Bound form={rechnung} name="bruttobetrag" hint={tx('Bruttobetrag inkl. MwSt. (€)')} />
            <StepNav
              onNext={() => rechnung.validate(['faelligkeit', 'nettobetrag', 'mwst', 'bruttobetrag'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst einen Auftrag wählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Step 3: Review & confirm */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[rechnung]}
            submit={submit}
            items={[
              { key: '_auftrag', label: tx('Auftrag'), value: auftragLabel },
              { key: '_rechnungsdatum', label: tx('Rechnungsdatum'), value: todayIso() },
              { key: '_status', label: tx('Status'), value: tx('Offen') },
            ]}
            whatHappensNext={tx('Die Rechnung wird angelegt und der Auftrag auf „Abgerechnet" gesetzt.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[rechnung]}
          submit={submit}
          whatHappensNext={tx('Die Rechnung ist angelegt. Zahlungseingang bitte nach Eingang nachtragen.')}
          next={[
            { label: tx('Weitere Rechnung erstellen'), href: '#/intents/rechnung-erstellen' },
            { label: tx('Position hinzufügen'), href: '#/intents/position-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
