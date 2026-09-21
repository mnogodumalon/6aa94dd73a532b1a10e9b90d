/**
 * Auftrag anlegen — 4-Schritt-Wizard.
 * Steps: 1) Fahrzeug wählen → 2) Mechaniker wählen → 3) Details erfassen → 4) Prüfen & anlegen.
 * Reads: fahrzeuge (kennzeichen, marke, modell), mitarbeiter (vorname, nachname, status=aktiv).
 * Writes: auftraege (createAuftraegeEntry) — status 'angenommen' + annahmedatum=today() fest.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
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
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function AuftragAnlegenPage() {
  const [step, setStep] = useState(1);

  const fahrzeuge = useRecordSearch(servicePort, 'fahrzeuge', {
    searchFields: ['kennzeichen', 'marke', 'modell'],
    toItem: f => ({
      id: f.id,
      title: fieldText(f, 'kennzeichen'),
      subtitle: `${fieldText(f, 'marke')} ${fieldText(f, 'modell')}`.trim(),
    }),
  });

  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldLookup(m, 'rolle')?.label,
    }),
  });

  const auftrag = useStepForm('auftraege', {
    steps: {
      fahrzeug: 1,
      mechaniker: 2,
      kilometerstand_annahme: 3,
      fertigstellungstermin: 3,
      kundenwunsch: 3,
      notizen: 3,
    },
    initial: { annahmedatum: todayIso() },
    required: { auftragsnummer: false },
  });

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'auftrag',
        entity: 'auftraege',
        form: auftrag,
        primary: true,
        values: { status: 'angenommen', annahmedatum: todayIso() },
      },
    ],
    { draftKey: 'auftrag-anlegen' },
  );

  return (
    <IntentWizardShell
      title={tx('Auftrag anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[auftrag]}
      draftKey="auftrag-anlegen"
      intro={{
        description: tx('Fahrzeug annehmen und einen neuen Werkstattauftrag anlegen.'),
        needs: [tx('Fahrzeugkennzeichen'), tx('Kundenwunsch'), tx('Fertigstellungstermin')],
      }}
    >
      <WizardStep
        label={tx('Fahrzeug')}
        description={tx('Fahrzeug anhand von Kennzeichen, Marke oder Modell suchen und auswählen.')}
      >
        <EntitySelectStep
          {...fahrzeuge.select}
          selectedId={auftrag.get('fahrzeug') as string | null}
          onSelect={id => {
            auftrag.set('fahrzeug', id, fahrzeuge.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Kennzeichen, Marke oder Modell …')}
          avatar="none"
          create={false}
          emptyText={tx('Kein passendes Fahrzeug gefunden. Bitte zuerst das Fahrzeug anlegen.')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Mechaniker')}
        description={tx('Einen aktiven Mechaniker für diesen Auftrag zuweisen.')}
        needs={['fahrzeug']}
      >
        <EntitySelectStep
          {...mitarbeiter.select}
          selectedId={auftrag.get('mechaniker') as string | null}
          onSelect={id => {
            auftrag.set('mechaniker', id, mitarbeiter.labelOf(id));
            setStep(3);
          }}
          searchPlaceholder={tx('Vorname oder Nachname …')}
          emptyText={tx('Keine aktiven Mitarbeiter gefunden.')}
          create={false}
        />
        <div className="mt-4">
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              if (!auftrag.get('mechaniker')) return tx('Bitte einen Mechaniker auswählen.');
              setStep(3);
            }}
            nextStepLabel={tx('Details')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Details')}
        description={tx('Kilometerstand, Fertigstellungstermin und Kundenwunsch erfassen.')}
        needs={['fahrzeug']}
      >
        <div className="space-y-4">
          <Bound form={auftrag} name="kilometerstand_annahme" hint={tx('Aktueller Kilometerstand des Fahrzeugs')} />
          <Bound form={auftrag} name="fertigstellungstermin" />
          <Bound form={auftrag} name="kundenwunsch" rows={4} />
          <Bound form={auftrag} name="notizen" rows={3} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => auftrag.validate(['fertigstellungstermin', 'kundenwunsch'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[auftrag]}
            submit={submit}
            items={[
              {
                key: '_annahmedatum',
                label: tx('Annahmedatum'),
                value: todayIso(),
              },
              {
                key: '_status',
                label: tx('Status'),
                value: tx('Angenommen'),
              },
            ]}
            whatHappensNext={tx('Der Auftrag wird mit Status „Angenommen" angelegt. Die Auftragsnummer vergibt das System automatisch.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[auftrag]}
          submit={submit}
          whatHappensNext={tx('Jetzt können Auftragspositionen (Arbeiten, Teile) hinzugefügt werden.')}
          next={[
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
