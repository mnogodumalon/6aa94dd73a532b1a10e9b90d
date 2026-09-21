/**
 * Position erfassen — 5-Schritt-Wizard.
 * Steps: 1) Auftrag wählen → 2) Positionstyp wählen → 3a) Arbeit erfassen / 3b) Teil wählen
 *        → 4) Teilmenge & Preis (nur bei Typ "Teil") → 5) Prüfen & speichern.
 * Reads: auftraege, teilebestand, mitarbeiter.
 * Writes: auftragspositionen (createAuftragspositionenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           StepNav, SummaryStep, SuccessStep, BudgetTracker.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { Field } from '@/components/blocks/Field';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldNumber,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function PositionErfassenPage() {
  const [step, setStep] = useState(1);

  // Auftrag-Suche
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    searchFields: ['auftragsnummer'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldText(a, 'kundenwunsch') || undefined,
      status: (() => {
        const s = a.fields.status as { key: string; label: string } | null | undefined;
        return s ? { key: s.key, label: s.label } : undefined;
      })(),
    }),
    filter: "r.v_status in ['angenommen', 'in_arbeit']",
    where: r => {
      const s = r.fields.status as { key: string } | null | undefined;
      return s?.key === 'angenommen' || s?.key === 'in_arbeit';
    },
  });

  // Teilebestand-Suche
  const teilebestand = useRecordSearch(servicePort, 'teilebestand', {
    searchFields: ['artikelnummer', 'bezeichnung'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'bezeichnung'),
      subtitle: fieldText(t, 'artikelnummer'),
      stats: [
        { label: tx('Bestand'), value: String(fieldNumber(t, 'bestand') ?? 0) },
        { label: tx('VK-Preis'), value: `${fieldNumber(t, 'verkaufspreis') ?? 0} €` },
      ],
    }),
  });

  // Mitarbeiter-Suche
  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
    }),
    filter: "r.v_status == 'aktiv'",
    where: r => {
      const s = r.fields.status as { key: string } | null | undefined;
      return s?.key === 'aktiv';
    },
  });

  // Einziges Formular für alle Felder der Auftragsposition
  const f = useStepForm('auftragspositionen', {
    steps: {
      auftrag: 1,
      positionstyp: 2,
      bezeichnung: 3,
      menge: 3,
      einzelpreis: 3,
      mechaniker: 3,
      dauer_stunden: 3,
      teil: 4,
    },
    required: {
      mechaniker: false,
      dauer_stunden: false,
      teil: false,
    },
    messages: {
      auftrag: tx('Bitte einen Auftrag aus der Liste wählen.'),
      positionstyp: tx('Bitte Arbeit oder Teil wählen.'),
      teil: tx('Bitte ein Teil aus dem Teilebestand wählen.'),
    },
  });

  const positionstyp = f.get('positionstyp') as string | null;
  const istArbeit = positionstyp === 'arbeit';
  const istTeil = positionstyp === 'teil';

  // Bestand des gewählten Teils
  const gewaehltesTeilId = f.get('teil') as string | null;
  const gewaehltesTeil = gewaehltesTeilId ? teilebestand.recordOf(gewaehltesTeilId) : undefined;
  const verfuegbarerBestand = gewaehltesTeil ? (fieldNumber(gewaehltesTeil, 'bestand') ?? 0) : 0;
  const eingegebeneMenge = parseFloat(String(f.get('menge') ?? '0')) || 0;

  const bestandReicht = !istTeil || !gewaehltesTeilId || eingegebeneMenge <= verfuegbarerBestand;

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'position',
        entity: 'auftragspositionen',
        form: f,
        primary: true,
      },
    ],
    { draftKey: 'position-erfassen' }
  );

  const restart = () => {
    submit.reset();
    f.reset();
    setStep(1);
  };

  // Schritt 3: Feldvalidierung je nach Typ
  const handleStep3Next = () => {
    if (istArbeit) {
      return f.validate(['bezeichnung', 'menge', 'einzelpreis']);
    }
    // Bei Teil: Bezeichnung wird automatisch vom Teil übernommen, Menge + Preis pflicht
    return f.validate(['bezeichnung', 'menge', 'einzelpreis']);
  };

  // Schritt 4 (Teil-Detaildaten): Bestandsprüfung vor dem Weiter
  const handleStep4Next = (): boolean | string => {
    if (!f.validate(['menge', 'einzelpreis'])) return false;
    if (!bestandReicht) {
      return tx('Der Bestand des gewählten Teils reicht für die eingegebene Menge nicht aus.');
    }
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Position erfassen')}
      subtitle={tx('Arbeitsleistung oder Ersatzteil einem Auftrag zuordnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="position-erfassen"
      intro={{
        description: tx('Füge einem offenen Auftrag eine Arbeitsleistung oder ein verbautes Teil hinzu.'),
        needs: [tx('Auftragsnummer'), tx('Bezeichnung und Preis der Position')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Wähle den Auftrag, dem die Position zugeordnet werden soll.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={f.get('auftrag') as string | null}
          onSelect={id => {
            f.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen oder laufenden Aufträge gefunden.')}
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          avatar="none"
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Positionstyp wählen */}
      <WizardStep
        label={tx('Positionstyp')}
        description={tx('Handelt es sich um eine Arbeitsleistung oder ein verbautes Teil?')}
        needs={['auftrag']}
      >
        <div className="space-y-6">
          {/* Tile-Auswahl für Positionstyp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'arbeit', label: tx('Arbeit'), desc: tx('Arbeitsleistung, Zeit und Mechaniker') },
              { key: 'teil', label: tx('Teil'), desc: tx('Verbautes Ersatzteil aus dem Bestand') },
            ].map(opt => {
              const isSelected = positionstyp === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    f.set('positionstyp', opt.key);
                    setStep(3);
                  }}
                  className={[
                    'rounded-xl border-2 p-6 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50',
                  ].join(' ')}
                >
                  <p className="font-semibold text-foreground">{opt.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
                </button>
              );
            })}
          </div>
          <StepNav
            onNext={() => f.validate(['positionstyp'])}
            nextStepLabel={tx('Details eingeben')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3a: Arbeit erfassen */}
      <WizardStep
        label={tx('Arbeitsdetails')}
        description={tx('Bezeichnung, Menge, Preis und optionaler Mechaniker.')}
        enabledIf={istArbeit || positionstyp === null}
        needs={['positionstyp']}
      >
        <div className="space-y-4">
          <Bound form={f} name="bezeichnung" placeholder={tx('z. B. Ölwechsel, Bremsbeläge tauschen …')} />
          <div className="grid grid-cols-2 gap-4">
            <Bound form={f} name="menge" hint={tx('z. B. 1 oder 2,5')} />
            <Bound form={f} name="einzelpreis" hint={tx('Preis in €')} />
          </div>
          <Bound form={f} name="dauer_stunden" hint={tx('Arbeitsdauer in Stunden (optional)')} />
          {/* Mechaniker-Auswahl */}
          <Field form={f} name="mechaniker" label={tx('Mechaniker (optional)')}>
            <EntitySelectStep
              {...mitarbeiter.select}
              selectedId={f.get('mechaniker') as string | null}
              onSelect={id => f.set('mechaniker', id, mitarbeiter.labelOf(id))}
              searchPlaceholder={tx('Mechaniker suchen …')}
              emptyText={tx('Keine aktiven Mechaniker gefunden.')}
              create={false}
              avatar="initials"
              {...f.record('mechaniker')}
            />
          </Field>
          <StepNav
            onNext={handleStep3Next}
            nextStepLabel={tx('Prüfen')}
            onBack={() => setStep(2)}
          />
        </div>
      </WizardStep>

      {/* Schritt 3b: Teil wählen */}
      <WizardStep
        label={tx('Teil wählen')}
        description={tx('Wähle das verbaute Teil aus dem Teilebestand.')}
        enabledIf={istTeil}
        needs={['positionstyp']}
      >
        <EntitySelectStep
          {...teilebestand.select}
          selectedId={f.get('teil') as string | null}
          onSelect={id => {
            const teilRecord = teilebestand.recordOf(id);
            f.set('teil', id, teilebestand.labelOf(id));
            // Bezeichnung und Verkaufspreis automatisch vorbelegen
            if (teilRecord) {
              f.set('bezeichnung', fieldText(teilRecord, 'bezeichnung'));
              const vk = fieldNumber(teilRecord, 'verkaufspreis');
              if (vk !== null) f.set('einzelpreis', String(vk));
            }
            setStep(4);
          }}
          searchPlaceholder={tx('Artikelnummer oder Bezeichnung suchen …')}
          emptyText={tx('Keine Teile im Bestand gefunden.')}
          avatar="none"
          create={false}
        />
      </WizardStep>

      {/* Schritt 4: Teilmenge & Preis */}
      <WizardStep
        label={tx('Menge & Preis')}
        description={tx('Menge und Einzelpreis des verbauten Teils bestätigen.')}
        enabledIf={istTeil}
        needs={['teil']}
      >
        <div className="space-y-4">
          {gewaehltesTeil && (
            <BudgetTracker
              format="count"
              unit={tx('Stück')}
              budget={verfuegbarerBestand}
              booked={eingegebeneMenge}
              label={tx('Verfügbarer Bestand')}
              showRemaining
            />
          )}
          <Bound form={f} name="menge" hint={tx('Anzahl der verbauten Einheiten')} />
          <Bound form={f} name="einzelpreis" hint={tx('Verkaufspreis in € pro Stück')} />
          {!bestandReicht && (
            <p className="text-sm text-destructive">
              {tx('Der Bestand des gewählten Teils reicht für die eingegebene Menge nicht aus.')}
            </p>
          )}
          <StepNav
            onNext={handleStep4Next}
            nextStepLabel={tx('Prüfen')}
            onBack={() => setStep(3)}
          />
        </div>
      </WizardStep>

      {/* Schritt 5: Prüfen & bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Die Position wird dem gewählten Auftrag hinzugefügt und ist sofort sichtbar.')}
            confirmLabel={tx('Position speichern')}
          />
        )}
      </WizardStep>

      {/* Erfolg */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          restartLabel={tx('Weitere Position erfassen')}
          next={[
            {
              label: tx('Rechnung erstellen'),
              href: '#/intents/rechnung-erstellen',
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          whatHappensNext={tx('Die Position erscheint jetzt in der Auftragsübersicht.')}
        />
      )}
    </IntentWizardShell>
  );
}
