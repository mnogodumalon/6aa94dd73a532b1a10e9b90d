/**
 * Auftrag anlegen — 4-Schritt-Wizard.
 * Steps: 1) Kunden suchen oder neu anlegen → 2) Fahrzeug des Kunden wählen oder neu anlegen
 *        → 3) Auftragsdaten erfassen (Kundenwunsch, Termin, KM-Stand, Mechaniker, Notizen)
 *        → 4) Prüfen & speichern.
 * Reads: kunden (suche), fahrzeuge (gefiltert auf gewählten Kunden), mitarbeiter (rolle=mechaniker).
 * Writes: kunden (optional, wenn neu), fahrzeuge (optional, wenn neu), auftraege (immer).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep,
 *           Bound.
 */

import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
  fieldRef,
  refFilter,
  todayIso,
} from '@/lib/journey';
import type { PlanContext } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function AuftragAnlegenPage() {
  const [step, setStep] = useState(1);

  // Picked IDs — declared FIRST so they can be used in useRecordSearch options below
  const [selectedKundeId, setSelectedKundeId] = useState<string | null>(null);
  const [selectedKundeName, setSelectedKundeName] = useState<string>('');
  const [isNewKunde, setIsNewKunde] = useState(false);

  const [selectedFahrzeugId, setSelectedFahrzeugId] = useState<string | null>(null);
  const [selectedFahrzeugName, setSelectedFahrzeugName] = useState<string>('');
  const [isNewFahrzeug, setIsNewFahrzeug] = useState(false);

  const [selectedMechanikerId, setSelectedMechanikerId] = useState<string | null>(null);
  const [selectedMechanikerName, setSelectedMechanikerName] = useState<string>('');

  // ── Step 1: Kunden-Suche ──────────────────────────────────────────────────
  const kunden = useRecordSearch(servicePort, 'kunden', {
    searchFields: ['vorname', 'nachname', 'telefon'],
    toItem: k => ({
      id: k.id,
      title: `${fieldText(k, 'vorname')} ${fieldText(k, 'nachname')}`.trim(),
      subtitle: fieldText(k, 'telefon') || fieldLookup(k, 'kundentyp')?.label,
    }),
    orderby: ['r.v_nachname asc'],
  });

  // ── Step 2: Fahrzeug-Suche (gefiltert auf gewählten Kunden) ───────────────
  const fahrzeuge = useRecordSearch(servicePort, 'fahrzeuge', {
    searchFields: ['kennzeichen', 'marke', 'modell'],
    filter: selectedKundeId ? refFilter('halter', selectedKundeId) : undefined,
    where: selectedKundeId
      ? (r) => fieldRef(r, 'halter') === selectedKundeId
      : undefined,
    toItem: f => ({
      id: f.id,
      title: fieldText(f, 'kennzeichen'),
      subtitle: `${fieldText(f, 'marke')} ${fieldText(f, 'modell')}`.trim(),
    }),
    orderby: ['r.v_kennzeichen asc'],
  });

  // ── Step 3: Mechaniker-Suche ──────────────────────────────────────────────
  const mechaniker = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    filter: "r.v_rolle == 'mechaniker'",
    where: r => fieldLookup(r, 'rolle')?.key === 'mechaniker',
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldLookup(m, 'status')?.label,
    }),
    orderby: ['r.v_nachname asc'],
  });

  // ── Forms ─────────────────────────────────────────────────────────────────
  const kundeForm = useStepForm('kunden', {
    fields: ['vorname', 'nachname', 'kundentyp', 'telefon', 'email', 'strasse', 'hausnummer', 'plz', 'ort', 'notizen'],
    steps: { vorname: 1, nachname: 1, kundentyp: 1, telefon: 1, email: 1, strasse: 1, hausnummer: 1, plz: 1, ort: 1, notizen: 1 },
  });

  const fahrzeugForm = useStepForm('fahrzeuge', {
    fields: ['kennzeichen', 'marke', 'modell', 'erstzulassung', 'kilometerstand', 'hu_faellig'],
    steps: { kennzeichen: 2, marke: 2, modell: 2, erstzulassung: 2, kilometerstand: 2, hu_faellig: 2 },
  });

  const auftragForm = useStepForm('auftraege', {
    fields: ['fertigstellungstermin', 'kundenwunsch', 'kilometerstand_annahme', 'notizen'],
    steps: { fertigstellungstermin: 3, kundenwunsch: 3, kilometerstand_annahme: 3, notizen: 3 },
    required: { auftragsnummer: false, status: false, annahmedatum: false, fahrzeug: false, mechaniker: false },
  });

  // ── Plan ──────────────────────────────────────────────────────────────────
  const submit = useJourneySubmit(servicePort, [
    // Kunde: nur anlegen wenn neu — run gibt undefined zurück wenn nicht nötig
    {
      key: 'kunde',
      run: async ({ port }: PlanContext) => {
        if (!isNewKunde) return undefined;
        return port.create('kunden', kundeForm.payload());
      },
    },
    // Fahrzeug: nur anlegen wenn neu; halter = neue Kunden-Id oder gewählte
    {
      key: 'fahrzeug',
      needs: ['kunde'],
      run: async ({ port, done }: PlanContext) => {
        if (!isNewFahrzeug) return undefined;
        const halterId = isNewKunde ? done['kunde']?.id : (selectedKundeId ?? undefined);
        return port.create('fahrzeuge', { ...fahrzeugForm.payload(), halter: halterId });
      },
    },
    // Auftrag — immer
    {
      key: 'auftrag',
      entity: 'auftraege',
      form: auftragForm,
      primary: true,
      needs: ['kunde', 'fahrzeug'],
      values: (ctx: PlanContext) => ({
        fahrzeug: isNewFahrzeug ? ctx.done['fahrzeug']?.id : (selectedFahrzeugId ?? undefined),
        mechaniker: selectedMechanikerId ?? undefined,
        annahmedatum: todayIso(),
        status: 'angenommen',
      }),
    },
  ], { draftKey: 'auftrag-anlegen' });

  // ── Helper: Kunde gewählt ─────────────────────────────────────────────────
  const handleKundeSelect = (id: string) => {
    const label = kunden.labelOf(id) ?? id;
    setSelectedKundeId(id);
    setSelectedKundeName(label);
    setIsNewKunde(false);
    // Reset Fahrzeug-Auswahl wenn Kunde wechselt
    setSelectedFahrzeugId(null);
    setSelectedFahrzeugName('');
    setIsNewFahrzeug(false);
    setStep(2);
  };

  // ── Helper: Fahrzeug gewählt ──────────────────────────────────────────────
  const handleFahrzeugSelect = (id: string) => {
    const rec = fahrzeuge.recordOf(id);
    const name = fahrzeuge.labelOf(id) ?? (rec
      ? `${fieldText(rec, 'kennzeichen')} ${fieldText(rec, 'marke')}`.trim()
      : id);
    setSelectedFahrzeugId(id);
    setSelectedFahrzeugName(name);
    setIsNewFahrzeug(false);
    setStep(3);
  };

  // ── Helper: Mechaniker gewählt ────────────────────────────────────────────
  const handleMechanikerSelect = (id: string) => {
    setSelectedMechanikerId(id);
    setSelectedMechanikerName(mechaniker.labelOf(id) ?? id);
  };

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = () => {
    submit.reset();
    kundeForm.reset();
    fahrzeugForm.reset();
    auftragForm.reset();
    setSelectedKundeId(null);
    setSelectedKundeName('');
    setIsNewKunde(false);
    setSelectedFahrzeugId(null);
    setSelectedFahrzeugName('');
    setIsNewFahrzeug(false);
    setSelectedMechanikerId(null);
    setSelectedMechanikerName('');
    setStep(1);
  };

  // Summary items für Werte, die nicht im Formular stecken
  const summaryItems = [
    {
      key: '_kunde',
      label: tx('Kunde'),
      value: selectedKundeName || (isNewKunde ? tx('Neu angelegt') : '—'),
      step: 1,
    },
    {
      key: '_fahrzeug',
      label: tx('Fahrzeug'),
      value: selectedFahrzeugName || (isNewFahrzeug ? tx('Neu angelegt') : '—'),
      step: 2,
    },
    ...(selectedMechanikerId
      ? [{ key: '_mechaniker', label: tx('Mechaniker'), value: selectedMechanikerName, step: 3 }]
      : []),
    {
      key: '_annahmedatum',
      label: tx('Annahmedatum'),
      value: tx('Heute (automatisch)'),
    },
    {
      key: '_status',
      label: tx('Status'),
      value: tx('Angenommen'),
    },
  ];

  return (
    <IntentWizardShell
      title={tx('Auftrag anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[kundeForm, fahrzeugForm, auftragForm]}
      draftKey="auftrag-anlegen"
      intro={{
        description: tx('Neuen Werkstattauftrag für ein Fahrzeug aufnehmen.'),
        needs: [tx('Kundendaten'), tx('Fahrzeugkennzeichen'), tx('Kundenwunsch')],
      }}
    >
      {/* ── Schritt 1: Kunde ─────────────────────────────────────────────── */}
      <WizardStep
        label={tx('Kunde')}
        description={tx('Bestehenden Kunden suchen oder neuen Kunden anlegen.')}
      >
        <EntitySelectStep
          {...kunden.select}
          selectedId={selectedKundeId}
          onSelect={handleKundeSelect}
          avatar="initials"
          searchPlaceholder={tx('Vorname, Nachname oder Telefon …')}
          create={{
            fields: ['vorname', 'nachname', 'kundentyp', 'telefon', 'email'],
            title: tx('Neuen Kunden anlegen'),
          }}
          createLabel={tx('Neuen Kunden anlegen')}
        />
        {selectedKundeId && (
          <StepNav
            onNext={() => { setStep(2); }}
            nextStepLabel={tx('Fahrzeug')}
            hideBack
          />
        )}
      </WizardStep>

      {/* ── Schritt 2: Fahrzeug ──────────────────────────────────────────── */}
      <WizardStep
        label={tx('Fahrzeug')}
        description={tx('Fahrzeug des Kunden wählen oder neues Fahrzeug erfassen.')}
      >
        {selectedKundeId ? (
          <>
            <EntitySelectStep
              {...fahrzeuge.select}
              selectedId={selectedFahrzeugId}
              onSelect={handleFahrzeugSelect}
              avatar="none"
              searchPlaceholder={tx('Kennzeichen, Marke oder Modell …')}
              emptyText={tx('Für diesen Kunden ist noch kein Fahrzeug hinterlegt.')}
              create={{
                fields: ['kennzeichen', 'marke', 'modell', 'erstzulassung', 'kilometerstand', 'hu_faellig'],
                title: tx('Neues Fahrzeug anlegen'),
              }}
              createLabel={tx('Neues Fahrzeug anlegen')}
            />
            {selectedFahrzeugId && (
              <StepNav
                onBack={() => setStep(1)}
                onNext={() => { setStep(3); }}
                nextStepLabel={tx('Auftragsdaten')}
              />
            )}
            {!selectedFahrzeugId && (
              <StepNav onBack={() => setStep(1)} nextDisabled />
            )}
          </>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            <p className="text-sm text-muted-foreground">
              {tx('Bitte zuerst einen Kunden im vorherigen Schritt auswählen.')}
            </p>
          </StepNav>
        )}
      </WizardStep>

      {/* ── Schritt 3: Auftragsdaten ─────────────────────────────────────── */}
      <WizardStep
        label={tx('Auftragsdaten')}
        description={tx('Kundenwunsch, Fertigstellungstermin und weitere Details erfassen.')}
      >
        <div className="space-y-5">
          <Bound form={auftragForm} name="kundenwunsch" rows={4} />
          <Bound form={auftragForm} name="fertigstellungstermin" />
          <Bound form={auftragForm} name="kilometerstand_annahme" />

          {/* Mechaniker-Auswahl (optional) */}
          <div>
            <p className="text-sm font-medium mb-2">
              {tx('Zuständiger Mechaniker')}
              <span className="text-muted-foreground font-normal ml-1">
                {'(' + tx('optional') + ')'}
              </span>
            </p>
            <EntitySelectStep
              {...mechaniker.select}
              selectedId={selectedMechanikerId}
              onSelect={handleMechanikerSelect}
              avatar="initials"
              searchPlaceholder={tx('Mechaniker suchen …')}
              emptyText={tx('Keine Mechaniker mit dieser Rolle gefunden.')}
              create={false}
            />
          </div>

          <Bound form={auftragForm} name="notizen" rows={3} />

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => auftragForm.validate(['kundenwunsch'])}
            nextStepLabel={tx('Prüfen & speichern')}
          />
        </div>
      </WizardStep>

      {/* ── Schritt 4: Prüfen ────────────────────────────────────────────── */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[auftragForm]}
            submit={submit}
            items={summaryItems}
            whatHappensNext={tx('Der Auftrag wird sofort angelegt und erhält später automatisch eine Auftragsnummer.')}
            confirmLabel={tx('Auftrag anlegen')}
          />
        )}
      </WizardStep>

      {/* ── Erfolgsseite ─────────────────────────────────────────────────── */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[auftragForm]}
          whatHappensNext={tx('Die Auftragsnummer wird automatisch vergeben. Jetzt können Positionen hinzugefügt werden.')}
          next={[
            {
              label: tx('Position hinzufügen'),
              href: '#/intents/position-hinzufuegen',
            },
            {
              label: tx('Weiteren Auftrag anlegen'),
              onClick: restart,
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
