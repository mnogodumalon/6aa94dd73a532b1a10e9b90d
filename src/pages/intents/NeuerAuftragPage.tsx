/**
 * Neuer Auftrag — 4-Schritt-Wizard.
 * Steps: 1) Fahrzeug wählen (ggf. neu anlegen mit Halter/Kunden) →
 *        2) Auftragsdaten erfassen →
 *        3) Mechaniker zuweisen (optional) →
 *        4) Prüfen & anlegen.
 * Reads: fahrzeuge, kunden, mitarbeiter. Writes: auftraege (createAuftraegeEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Input } from '@/components/ui/input';
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

export default function NeuerAuftragPage() {
  const [step, setStep] = useState(1);

  // Step 1: Fahrzeug selection
  const fahrzeuge = useRecordSearch(servicePort, 'fahrzeuge', {
    searchFields: ['kennzeichen', 'marke', 'modell'],
    toItem: f => ({
      id: f.id,
      title: fieldText(f, 'kennzeichen'),
      subtitle: `${fieldText(f, 'marke')} ${fieldText(f, 'modell')}`.trim(),
    }),
  });

  // For inline create of a new Fahrzeug — Halter selection (Kunden)
  const kunden = useRecordSearch(servicePort, 'kunden', {
    searchFields: ['vorname', 'nachname'],
    toItem: k => ({
      id: k.id,
      title: `${fieldText(k, 'vorname')} ${fieldText(k, 'nachname')}`.trim(),
      subtitle: fieldText(k, 'telefon') || undefined,
    }),
  });

  // Step 3: Mechaniker — only aktiv + mechaniker
  const mechaniker = useRecordSearch(servicePort, 'mitarbeiter', {
    filter: "r.v_status == 'aktiv' and r.v_rolle == 'mechaniker'",
    where: r =>
      fieldLookup(r, 'status')?.key === 'aktiv' &&
      fieldLookup(r, 'rolle')?.key === 'mechaniker',
    searchFields: ['vorname', 'nachname'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
    }),
  });

  // Form for auftraege — fahrzeug + mechaniker are record picks, stored via f.set
  const auftrag = useStepForm('auftraege', {
    steps: {
      fahrzeug: 1,
      auftragsnummer: 2,
      annahmedatum: 2,
      fertigstellungstermin: 2,
      kundenwunsch: 2,
      kilometerstand_annahme: 2,
      mechaniker: 3,
    },
    initial: {
      annahmedatum: todayIso(),
    },
    required: {
      mechaniker: false,
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
        values: { status: 'angenommen' },
      },
    ],
    { draftKey: 'neuer-auftrag' },
  );

  return (
    <IntentWizardShell
      title={tx('Neuer Werkstattauftrag')}
      currentStep={step}
      onStepChange={setStep}
      forms={[auftrag]}
      draftKey="neuer-auftrag"
      intro={{
        description: tx('Fahrzeug auswählen, Auftragsdaten erfassen und Mechaniker zuweisen.'),
        needs: [tx('Kennzeichen des Fahrzeugs'), tx('Auftragsnummer (z.B. A-2026-042)')],
      }}
    >
      {/* Schritt 1: Fahrzeug wählen */}
      <WizardStep
        label={tx('Fahrzeug')}
        description={tx('Fahrzeug anhand des Kennzeichens suchen oder neu anlegen.')}
      >
        <EntitySelectStep
          {...fahrzeuge.select}
          selectedId={auftrag.get('fahrzeug') as string}
          onSelect={id => {
            auftrag.set('fahrzeug', id, fahrzeuge.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Kennzeichen, Marke oder Modell …')}
          create={{
            fields: ['kennzeichen', 'marke', 'modell', 'halter'],
            title: tx('Neues Fahrzeug anlegen'),
          }}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 2: Auftragsdaten */}
      <WizardStep
        label={tx('Auftragsdaten')}
        description={tx('Nummer, Datum und Kundenwunsch eintragen.')}
        needs={['fahrzeug']}
      >
        <div className="space-y-4">
          <Field
            form={auftrag}
            name="auftragsnummer"
            hint={tx('z.B. A-2026-042 — bitte selbst vergeben')}
          >
            <Input
              {...auftrag.field('auftragsnummer')}
              placeholder={tx('z.B. A-2026-042')}
            />
          </Field>
          <Bound form={auftrag} name="annahmedatum" />
          <Bound form={auftrag} name="fertigstellungstermin" />
          <Bound form={auftrag} name="kundenwunsch" rows={4} />
          <Bound form={auftrag} name="kilometerstand_annahme" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => auftrag.validate(['auftragsnummer', 'annahmedatum'])}
            nextStepLabel={tx('Mechaniker')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Mechaniker zuweisen (optional) */}
      <WizardStep
        label={tx('Mechaniker')}
        description={tx('Einen aktiven Mechaniker zuweisen — dieser Schritt kann übersprungen werden.')}
        needs={['auftragsnummer']}
      >
        <EntitySelectStep
          {...mechaniker.select}
          selectedId={auftrag.get('mechaniker') as string}
          onSelect={id => {
            auftrag.set('mechaniker', id, mechaniker.labelOf(id));
            setStep(4);
          }}
          emptyText={tx('Kein aktiver Mechaniker gefunden. Bitte Mitarbeiterstamm prüfen.')}
          create={false}
          avatar="initials"
        />
        <div className="mt-4">
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => { setStep(4); }}
            nextStepLabel={tx('Prüfen')}
            nextLabel={tx('Ohne Mechaniker weiter')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & Anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[auftrag]}
            submit={submit}
            items={[
              {
                key: 'status',
                label: tx('Status'),
                value: tx('Angenommen'),
              },
            ]}
            whatHappensNext={tx('Der Auftrag wird angelegt und erscheint sofort in der Auftragsliste. Danach können Positionen ergänzt werden.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[auftrag]}
            submit={submit}
            restartLabel={tx('Weiteren Auftrag anlegen')}
            whatHappensNext={tx('Jetzt Positionen (Arbeitsleistungen, Teile) zum Auftrag hinzufügen.')}
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
      </WizardStep>

      {/* Kunden-Schritt für Fahrzeug-Neuanlage — wird als Unterpicker durch den EntitySelectStep gesteuert */}
      {/* Die halter-Auswahl erfolgt über das inline create={{ fields: [..., 'halter'] }} im Fahrzeugschritt */}
      {/* Der EntitySelectStep öffnet ein InlineCreate-Panel mit dem halter-Feld, das seinerseits auf kunden zeigt */}
    </IntentWizardShell>
  );
}
