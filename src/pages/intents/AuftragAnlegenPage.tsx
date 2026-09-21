/**
 * Auftrag anlegen — 4-Schritt-Wizard.
 * Steps: 1) Fahrzeug wählen → 2) Mechaniker auswählen → 3) Auftragsdaten erfassen → 4) Prüfen & anlegen.
 * Reads: fahrzeuge (kennzeichen, marke, modell, halter), mitarbeiter (vorname, nachname, rolle, status).
 * Writes: auftraege (createAuftraegeEntry) mit status='angenommen', annahmedatum=today.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
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
    orderby: ['r.v_kennzeichen asc'],
  });

  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    filter: "r.v_status == 'aktiv' and r.v_rolle == 'mechaniker'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv' && fieldLookup(r, 'rolle')?.key === 'mechaniker',
    searchFields: ['vorname', 'nachname'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
    }),
    orderby: ['r.v_nachname asc'],
  });

  const auftrag = useStepForm('auftraege', {
    steps: {
      fahrzeug: 1,
      mechaniker: 2,
      fertigstellungstermin: 3,
      kilometerstand_annahme: 3,
      kundenwunsch: 3,
      notizen: 3,
    },
    initial: {
      annahmedatum: todayIso(),
    },
    required: {
      auftragsnummer: false,
    },
  });

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'auftrag',
        entity: 'auftraege',
        form: auftrag,
        primary: true,
        values: {
          status: 'angenommen',
          annahmedatum: todayIso(),
        },
      },
    ],
    { draftKey: 'auftrag-anlegen' },
  );

  return (
    <IntentWizardShell
      title={tx('Auftrag anlegen')}
      subtitle={tx('Fahrzeug annehmen und Auftrag eröffnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[auftrag]}
      draftKey="auftrag-anlegen"
      intro={{
        description: tx('Fahrzeug wählen, Mechaniker zuweisen und alle Annahmedaten erfassen.'),
        needs: [tx('Fahrzeugkennzeichen'), tx('Kundenwunsch')],
      }}
    >
      <WizardStep
        label={tx('Fahrzeug')}
        description={tx('Fahrzeug anhand des Kennzeichens suchen und wählen.')}
      >
        <EntitySelectStep
          {...fahrzeuge.select}
          selectedId={auftrag.get('fahrzeug') as string | null}
          onSelect={id => {
            auftrag.set('fahrzeug', id, fahrzeuge.labelOf(id));
            setStep(2);
          }}
          avatar="none"
          searchPlaceholder={tx('Kennzeichen oder Marke suchen …')}
          emptyText={tx('Kein Fahrzeug gefunden. Bitte zuerst das Fahrzeug im System anlegen.')}
          create={false}
        />
      </WizardStep>

      <WizardStep
        label={tx('Mechaniker')}
        description={tx('Einen aktiven Mechaniker für diesen Auftrag auswählen.')}
        needs={['fahrzeug']}
      >
        <EntitySelectStep
          {...mitarbeiter.select}
          selectedId={auftrag.get('mechaniker') as string | null}
          onSelect={id => {
            auftrag.set('mechaniker', id, mitarbeiter.labelOf(id));
            setStep(3);
          }}
          avatar="initials"
          searchPlaceholder={tx('Mechaniker suchen …')}
          emptyText={tx('Kein aktiver Mechaniker verfügbar.')}
          create={false}
        />
      </WizardStep>

      <WizardStep
        label={tx('Auftragsdaten')}
        description={tx('Kilometerstand, Fertigstellungstermin und Kundenwunsch erfassen.')}
        needs={['fahrzeug', 'mechaniker']}
      >
        <div className="space-y-4">
          <Bound form={auftrag} name="fertigstellungstermin" />
          <Bound form={auftrag} name="kilometerstand_annahme" />
          <Bound form={auftrag} name="kundenwunsch" rows={4} />
          <Bound form={auftrag} name="notizen" rows={3} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => auftrag.validate(['fertigstellungstermin', 'kilometerstand_annahme', 'kundenwunsch'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[auftrag]}
            submit={submit}
            whatHappensNext={tx('Der Auftrag erhält den Status „Angenommen" und erscheint sofort in der Auftragsliste.')}
            items={[
              { key: 'status', label: tx('Status'), value: tx('Angenommen') },
              { key: 'annahmedatum', label: tx('Annahmedatum'), value: new Intl.DateTimeFormat('de-DE').format(new Date()) },
            ]}
            confirmLabel={tx('Auftrag anlegen')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[auftrag]}
          submit={submit}
          restartLabel={tx('Weiteren Auftrag anlegen')}
          whatHappensNext={tx('Jetzt können Positionen (Arbeiten und Teile) zum Auftrag hinzugefügt werden.')}
          next={[
            {
              label: tx('Positionen erfassen'),
              href: '#/intents/position-erfassen',
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
