/**
 * Rechnung erstellen — 4-Schritt-Wizard.
 * Steps: 1) Fertigen Auftrag wählen → 2) Rechnungsdatum & Fälligkeit → 3) MwSt-Satz → 4) Prüfen & anlegen.
 * Reads: auftraege, fahrzeuge (für halter/kunde-Ableitung). Writes: rechnungen (create), auftraege (status → abgerechnet).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep, Bound.
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
  fieldRef,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

const DRAFT_KEY = 'rechnung-erstellen';

export default function RechnungErstellenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Fertiger Auftrag — nur Status 'fertig'
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    filter: "r.v_status == 'fertig'",
    where: r => fieldLookup(r, 'status')?.key === 'fertig',
    searchFields: ['auftragsnummer'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      status: fieldLookup(a, 'status') ?? undefined,
    }),
    orderby: ['r.v_auftragsnummer desc'],
  });

  // Form für rechnungen (faelligkeit + mwst — rechnungsdatum und status werden per values gesetzt)
  const rechnung = useStepForm('rechnungen', {
    fields: ['faelligkeit', 'mwst'],
    steps: { faelligkeit: 2, mwst: 3 },
    initial: { faelligkeit: null, mwst: null },
    required: { faelligkeit: false, mwst: false },
  });

  // kunde-Id wird beim Auftrag-Pick async aufgelöst (Fahrzeug → halter)
  const [kundeId, setKundeId] = useState<string | null>(null);
  const [auftragId, setAuftragId] = useState<string | null>(null);
  const [auftragLabel, setAuftragLabel] = useState<string | undefined>(undefined);

  const handleAuftragSelect = async (id: string) => {
    setAuftragId(id);
    setAuftragLabel(auftraege.labelOf(id));

    // Fahrzeug aus dem gewählten Auftrag lesen, dann halter daraus ableiten
    const auftragRecord = auftraege.recordOf(id);
    const fahrzeugId = auftragRecord ? fieldRef(auftragRecord, 'fahrzeug') : null;
    if (fahrzeugId) {
      const fahrzeug = await servicePort.get('fahrzeuge', fahrzeugId);
      if (fahrzeug) {
        const halter = fieldRef(fahrzeug, 'halter');
        setKundeId(halter);
      }
    }
    setStep(2);
  };

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'rechnung',
      entity: 'rechnungen',
      form: rechnung,
      primary: true,
      values: (_ctx) => ({
        auftrag: auftragId ?? '',
        kunde: kundeId ?? '',
        rechnungsdatum: todayIso(),
        status: 'offen',
      }),
    },
    {
      key: 'auftrag_update',
      entity: 'auftraege',
      needs: ['rechnung'],
      updates: auftragId ?? '',
      values: { status: 'abgerechnet' },
      verb: 'update',
    },
  ], { draftKey: DRAFT_KEY });

  const restart = () => {
    submit.reset();
    rechnung.reset();
    setAuftragId(null);
    setAuftragLabel(undefined);
    setKundeId(null);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Rechnung erstellen')}
      subtitle={tx('Fertigen Auftrag abrechnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[rechnung]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Einen fertig gestellten Auftrag auswählen und die Rechnung dafür anlegen.'),
        needs: [tx('Auftragsnummer'), tx('Fälligkeitsdatum')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Einen fertigen Auftrag auswählen — nur Aufträge mit Status „Fertig" können abgerechnet werden.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={auftragId}
          onSelect={handleAuftragSelect}
          avatar="none"
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          emptyText={tx('Keine fertigen Aufträge vorhanden. Zuerst einen Auftrag fertig stellen.')}
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Rechnungsdatum & Fälligkeit */}
      <WizardStep
        label={tx('Datum & Fälligkeit')}
        needs={['auftrag']}
        description={tx('Das Rechnungsdatum wird auf heute gesetzt. Bitte die Fälligkeit angeben.')}
      >
        {auftragId ? (
          <div className="space-y-4">
            {/* Rechnungsdatum — wird automatisch gesetzt, nur zur Anzeige */}
            <div className="rounded-lg border bg-secondary/40 px-4 py-3 text-sm">
              <div className="text-xs text-muted-foreground mb-0.5">{tx('Rechnungsdatum')}</div>
              <div className="font-medium">{tx('Heute (wird automatisch gesetzt)')}</div>
            </div>
            <Bound form={rechnung} name="faelligkeit" hint={tx('Zahlungsziel, z. B. 14 oder 30 Tage')} />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => true}
              nextStepLabel={tx('MwSt-Satz')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            <span className="text-sm text-muted-foreground">{tx('Bitte zuerst einen Auftrag auswählen.')}</span>
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: MwSt-Satz */}
      <WizardStep
        label={tx('MwSt-Satz')}
        description={tx('Den anzuwendenden Mehrwertsteuersatz eingeben, z. B. 19 für 19 %.')}
      >
        <div className="space-y-4">
          <Bound form={rechnung} name="mwst" hint={tx('z. B. 19 für 19 % MwSt.')} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => true}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & Bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[rechnung]}
            submit={submit}
            items={[
              {
                key: '_auftrag',
                label: tx('Auftrag'),
                value: auftragLabel ?? '—',
                step: 1,
              },
              {
                key: '_rechnungsdatum',
                label: tx('Rechnungsdatum'),
                value: tx('Heute (automatisch)'),
              },
              {
                key: '_status',
                label: tx('Status'),
                value: tx('Offen'),
              },
            ]}
            whatHappensNext={tx('Die Rechnung wird angelegt und der Auftrag auf „Abgerechnet" gesetzt. Die Rechnungsnummer vergibt das System.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          restartLabel={tx('Weitere Rechnung erstellen')}
          forms={[rechnung]}
          facts={[
            { label: tx('Rechnungsnummer'), value: (submit.result.primary.fields['rechnungsnummer'] as string | undefined) ?? '—' },
            { label: tx('Status'), value: tx('Offen') },
          ]}
          next={[
            { label: tx('Position erfassen'), href: '#/intents/position-erfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Rechnungsnummer und der Betrag werden vom System eingetragen. Zahlungseingang unter „Rechnungen" vermerken.')}
        />
      )}
    </IntentWizardShell>
  );
}
