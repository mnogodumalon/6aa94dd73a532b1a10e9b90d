/**
 * Auftrag annehmen — 4-Schritt-Wizard.
 * Steps: 1) Kunden suchen oder neu anlegen → 2) Fahrzeug des Kunden auswählen oder neu anlegen
 *        → 3) Auftragsdetails erfassen → 4) Prüfen & anlegen.
 * Reads: kunden, fahrzeuge, mitarbeiter.
 * Writes: kunden (optional), fahrzeuge (optional), auftraege.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, Bound, StepNav,
 *           SummaryStep, SuccessStep.
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
  fieldRef,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function AuftragAnnehmenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Kunden suchen
  const kunden = useRecordSearch(servicePort, 'kunden', {
    searchFields: ['vorname', 'nachname', 'telefon'],
    toItem: k => ({
      id: k.id,
      title: `${fieldText(k, 'vorname')} ${fieldText(k, 'nachname')}`.trim(),
      subtitle: fieldText(k, 'telefon') || fieldText(k, 'email'),
    }),
    orderby: ['r.v_nachname asc'],
  });

  // Step 2: Fahrzeuge — gefiltert nach dem gewählten Kunden
  const [kundeId, setKundeId] = useState<string | null>(null);
  const fahrzeuge = useRecordSearch(servicePort, 'fahrzeuge', {
    searchFields: ['kennzeichen', 'marke', 'modell'],
    filter: kundeId ? tx`'${kundeId}' in str(r.v_halter)` : undefined,
    where: kundeId ? (r => fieldRef(r, 'halter') === kundeId) : undefined,
    toItem: f => ({
      id: f.id,
      title: fieldText(f, 'kennzeichen'),
      subtitle: `${fieldText(f, 'marke')} ${fieldText(f, 'modell')}`.trim(),
    }),
    orderby: ['r.v_kennzeichen asc'],
  });

  // Step 3: Mechaniker (nur aktive)
  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    filter: "r.v_status == 'aktiv'",
    where: r => {
      const s = r.fields['status'];
      return typeof s === 'object' && s !== null && (s as { key?: string }).key === 'aktiv';
    },
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
    }),
    orderby: ['r.v_nachname asc'],
  });

  // Forms
  const kundeForm = useStepForm('kunden', {
    steps: {
      vorname: 1, nachname: 1, kundentyp: 1,
      telefon: 1, email: 1,
      strasse: 1, hausnummer: 1, plz: 1, ort: 1,
      notizen: 1,
    },
  });

  const fahrzeugForm = useStepForm('fahrzeuge', {
    steps: {
      kennzeichen: 2, marke: 2, modell: 2,
      erstzulassung: 2, kilometerstand: 2, hu_faellig: 2,
    },
    required: { halter: false }, // wird programmatisch gesetzt
  });

  const auftragForm = useStepForm('auftraege', {
    steps: {
      fertigstellungstermin: 3,
      mechaniker: 3,
      kundenwunsch: 3,
      kilometerstand_annahme: 3,
      notizen: 3,
    },
    required: {
      auftragsnummer: false, // tool setzt die Nummer
      fahrzeug: false,       // aus dem Flow
      annahmedatum: false,   // today()
      status: false,         // fest: angenommen
    },
    initial: { annahmedatum: todayIso() },
  });

  // Branching: wurde ein Kunde NEU angelegt?
  const [neuerKundeId, setNeuerKundeId] = useState<string | null>(null);
  const [neuesFahrzeugId, setNeuesFahrzeugId] = useState<string | null>(null);

  const pickedKundeId = (auftragForm.get('_kundeId') as string | null) ?? neuerKundeId;
  const pickedFahrzeugId = (auftragForm.get('fahrzeug') as string | null) ?? neuesFahrzeugId;

  // Plan
  const submit = useJourneySubmit(
    servicePort,
    [
      // Auftrag anlegen (Fahrzeug und Status kommen via values/link)
      {
        key: 'auftrag',
        entity: 'auftraege',
        form: auftragForm,
        primary: true,
        values: (_ctx) => ({
          annahmedatum: todayIso(),
          status: 'angenommen',
          fahrzeug: pickedFahrzeugId ?? '',
        }),
      },
    ],
    { draftKey: 'auftrag-annehmen' },
  );

  const restart = () => {
    submit.reset();
    kundeForm.reset();
    fahrzeugForm.reset();
    auftragForm.reset({ annahmedatum: todayIso() });
    setKundeId(null);
    setNeuerKundeId(null);
    setNeuesFahrzeugId(null);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Auftrag annehmen')}
      subtitle={tx('Kunden und Fahrzeug suchen, Auftrag anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[kundeForm, fahrzeugForm, auftragForm]}
      draftKey="auftrag-annehmen"
      intro={{
        description: tx('Einen neuen Werkstattauftrag anlegen und direkt dem richtigen Fahrzeug zuordnen.'),
        needs: [tx('Kundendaten oder Kennzeichen'), tx('Kundenwunsch / Fehlerbeschreibung')],
      }}
    >
      {/* Schritt 1: Kunden suchen oder neu anlegen */}
      <WizardStep
        label={tx('Kunde')}
        description={tx('Bestehenden Kunden suchen oder neu anlegen.')}
      >
        <EntitySelectStep
          {...kunden.select}
          selectedId={pickedKundeId ?? null}
          onSelect={id => {
            auftragForm.set('_kundeId', id, kunden.labelOf(id));
            setKundeId(id);
            setNeuerKundeId(null);
            setStep(2);
          }}
          create={{ fields: ['vorname', 'nachname', 'kundentyp', 'telefon'] }}
          createLabel={tx('Neuen Kunden anlegen')}
          searchPlaceholder={tx('Nach Name oder Telefon suchen …')}
          avatar="initials"
        />
      </WizardStep>

      {/* Schritt 2: Fahrzeug wählen oder neu anlegen */}
      <WizardStep
        label={tx('Fahrzeug')}
        description={tx('Fahrzeug des Kunden auswählen oder neu erfassen.')}
        needs={['_kundeId']}
      >
        <EntitySelectStep
          {...fahrzeuge.select}
          selectedId={pickedFahrzeugId ?? null}
          onSelect={id => {
            auftragForm.set('fahrzeug', id, fahrzeuge.labelOf(id));
            setNeuesFahrzeugId(null);
            setStep(3);
          }}
          create={{
            fields: ['kennzeichen', 'marke', 'modell', 'erstzulassung'],
            initial: pickedKundeId ? { halter: pickedKundeId } : undefined,
          }}
          createLabel={tx('Neues Fahrzeug anlegen')}
          searchPlaceholder={tx('Nach Kennzeichen, Marke oder Modell suchen …')}
          emptyText={tx('Keine Fahrzeuge für diesen Kunden gefunden.')}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 3: Auftragsdetails */}
      <WizardStep
        label={tx('Auftragsdetails')}
        description={tx('Kilometerstand, gewünschten Fertigstellungstermin, Mechaniker und Kundenwunsch eintragen.')}
        needs={['fahrzeug']}
      >
        <div className="space-y-4">
          <Bound form={auftragForm} name="kilometerstand_annahme" hint={tx('Aktueller Kilometerstand des Fahrzeugs')} />
          <Bound form={auftragForm} name="fertigstellungstermin" />
          {/* Mechaniker: EntitySelectStep über Field, da applookup */}
          <div className="space-y-1">
            <EntitySelectStep
              {...mitarbeiter.select}
              selectedId={auftragForm.get('mechaniker') as string | null}
              onSelect={id => {
                auftragForm.set('mechaniker', id, mitarbeiter.labelOf(id));
              }}
              create={false}
              searchPlaceholder={tx('Mechaniker suchen …')}
              emptyText={tx('Keine aktiven Mechaniker gefunden.')}
              avatar="initials"
            />
          </div>
          <Bound form={auftragForm} name="kundenwunsch" rows={4} placeholder={tx('Was wünscht sich der Kunde?')} />
          <Bound form={auftragForm} name="notizen" rows={2} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => auftragForm.validate(['kilometerstand_annahme', 'kundenwunsch'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[kundeForm, fahrzeugForm, auftragForm]}
            submit={submit}
            items={[
              { key: 'annahmedatum', label: tx('Annahmedatum'), value: todayIso() },
              { key: 'status', label: tx('Status'), value: tx('Angenommen') },
            ]}
            whatHappensNext={tx('Der Auftrag wird angelegt. Auftragsnummer und Status werden automatisch gesetzt.')}
            confirmLabel={tx('Auftrag anlegen')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[auftragForm]}
          submit={submit}
          restartLabel={tx('Weiteren Auftrag annehmen')}
          next={[
            {
              label: tx('Positionen erfassen'),
              href: '#/intents/position-erfassen',
            },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Jetzt Auftragspositionen (Arbeit und Teile) erfassen.')}
        />
      )}
    </IntentWizardShell>
  );
}
