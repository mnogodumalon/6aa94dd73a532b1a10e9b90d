/**
 * Position erfassen — 4-Schritt-Wizard.
 * Steps: 1) Auftrag wählen → 2) Positionstyp wählen → 3a) Arbeitsdetails / 3b) Teil wählen & Details → 4) Prüfen & anlegen.
 * Reads: auftraege (status: angenommen|in_arbeit|fertig), teilebestand, mitarbeiter.
 * Writes: auftragspositionen (createAuftragspositionenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, Field, Bound,
 *           StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
  fieldNumber,
  combineFilters,
  refFilter,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { Input } from '@/components/ui/input';

export default function PositionErfassenPage() {
  const [step, setStep] = useState(1);

  // Aufträge: nur angenommen | in_arbeit | fertig
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    searchFields: ['auftragsnummer'],
    filter: "r.v_status in ['angenommen', 'in_arbeit', 'fertig']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key === 'angenommen' || key === 'in_arbeit' || key === 'fertig';
    },
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldLookup(a, 'status')?.label,
      status: fieldLookup(a, 'status') ?? undefined,
    }),
  });

  // Teilebestand
  const teile = useRecordSearch(servicePort, 'teilebestand', {
    searchFields: ['artikelnummer', 'bezeichnung'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'bezeichnung'),
      subtitle: fieldText(t, 'artikelnummer'),
      stats: [{ label: tx('Bestand'), value: String(fieldNumber(t, 'bestand') ?? 0) }],
    }),
  });

  // Mitarbeiter (nur Mechaniker wählen — angezeigt werden alle, Mechaniker ist optional)
  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    filter: "r.v_rolle == 'mechaniker'",
    where: r => fieldLookup(r, 'rolle')?.key === 'mechaniker',
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      status: fieldLookup(m, 'status') ?? undefined,
    }),
  });

  // Formular für auftragspositionen
  const pos = useStepForm('auftragspositionen', {
    steps: {
      auftrag: 1,
      positionstyp: 2,
      bezeichnung: 3,
      menge: 3,
      einzelpreis: 3,
      mechaniker: 3,
      dauer_stunden: 3,
      teil: 3,
    },
    required: {
      mechaniker: false,
      dauer_stunden: false,
      teil: false,
    },
  });

  const positionstyp = pos.get('positionstyp') as string | null;
  const istArbeit = positionstyp === 'arbeit';
  const istTeil = positionstyp === 'teil';

  // Bestand des gewählten Teils für die Validierung
  const gewähltesTeilId = pos.get('teil') as string | null;
  const gewähltesTeil = gewähltesTeilId ? teile.recordOf(gewähltesTeilId) : undefined;
  const bestand = gewähltesTeil ? (fieldNumber(gewähltesTeil, 'bestand') ?? 0) : 0;
  const menge = Number(pos.get('menge') ?? 0);

  // Lagerbestand-Prüfung nur bei Teilposition
  const bestandUnzureichend = istTeil && gewähltesTeilId != null && menge > 0 && menge > bestand;

  // Submit-Plan
  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'position',
        entity: 'auftragspositionen',
        form: pos,
        primary: true,
      },
    ],
    { draftKey: 'position-erfassen' }
  );

  return (
    <IntentWizardShell
      title={tx('Position erfassen')}
      subtitle={tx('Arbeits- oder Teilposition zu einem Auftrag hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[pos]}
      draftKey="position-erfassen"
      intro={{
        description: tx('Füge einem laufenden Auftrag eine Arbeits- oder Teilposition hinzu.'),
        needs: [tx('Auftragsnummer'), tx('Positionstyp (Arbeit oder Teil)'), tx('Menge und Preis')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Wähle den Auftrag, zu dem die Position gehört.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          avatar="none"
          selectedId={pos.get('auftrag') as string | null}
          onSelect={id => {
            pos.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Aufträge gefunden. Nur Aufträge mit Status „Angenommen", „In Arbeit" oder „Fertig" können bearbeitet werden.')}
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Positionstyp wählen */}
      <WizardStep
        label={tx('Positionstyp')}
        needs={['auftrag']}
      >
        <div className="space-y-6">
          <Bound form={pos} name="positionstyp" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => pos.validate(['positionstyp'])}
            nextStepLabel={tx('Details')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3a: Arbeitsdetails */}
      <WizardStep
        label={tx('Details')}
        description={istTeil ? tx('Teil aus dem Bestand wählen und Menge angeben.') : tx('Bezeichnung, Menge und Preis der Arbeit erfassen.')}
        enabledIf={positionstyp != null}
        needs={['positionstyp']}
      >
        <div className="space-y-4">
          {/* Bei Teilposition: Teil wählen */}
          {istTeil && (
            <div className="space-y-4">
              <Field form={pos} name="teil">
                <EntitySelectStep
                  {...teile.select}
                  avatar="none"
                  selectedId={pos.get('teil') as string | null}
                  onSelect={id => {
                    const teilRecord = teile.recordOf(id);
                    pos.set('teil', id, teile.labelOf(id));
                    // Verkaufspreis als Einzelpreis vorausfüllen
                    if (teilRecord) {
                      const vp = fieldNumber(teilRecord, 'verkaufspreis');
                      if (vp != null) pos.set('einzelpreis', String(vp));
                      // Bezeichnung aus Teil übernehmen
                      const bez = fieldText(teilRecord, 'bezeichnung');
                      if (bez) pos.set('bezeichnung', bez);
                    }
                  }}
                  emptyText={tx('Kein Teil im Teilebestand gefunden.')}
                  searchPlaceholder={tx('Artikelnummer oder Bezeichnung …')}
                  create={false}
                />
              </Field>

              {/* Bestandsanzeige */}
              {gewähltesTeil && (
                <BudgetTracker
                  format="count"
                  unit={tx('Stück')}
                  budget={bestand}
                  booked={menge}
                  label={tx('Lagerbestand')}
                  showRemaining
                  texts={{
                    booked: tx('Entnommen'),
                    remaining: tx('Verbleibend'),
                    over: tx('Bestand nicht ausreichend'),
                    none: tx('Kein Bestand erfasst'),
                  }}
                />
              )}
            </div>
          )}

          {/* Bezeichnung */}
          <Bound form={pos} name="bezeichnung" placeholder={istTeil ? tx('Teilbezeichnung') : tx('z. B. Ölwechsel, Bremsenprüfung')} />

          {/* Menge */}
          <Field form={pos} name="menge" hint={istTeil ? tx('Anzahl der entnommenen Teile') : tx('Stunden oder Einheiten')}>
            <Input {...pos.number('menge')} />
          </Field>

          {/* Einzelpreis */}
          <Bound form={pos} name="einzelpreis" hint={tx('Preis pro Einheit in Euro')} />

          {/* Bei Arbeit: Mechaniker + Dauer */}
          {istArbeit && (
            <>
              <Field form={pos} name="mechaniker">
                <EntitySelectStep
                  {...mitarbeiter.select}
                  avatar="initials"
                  selectedId={pos.get('mechaniker') as string | null}
                  onSelect={id => {
                    pos.set('mechaniker', id, mitarbeiter.labelOf(id));
                  }}
                  emptyText={tx('Kein Mechaniker verfügbar.')}
                  searchPlaceholder={tx('Name suchen …')}
                  create={false}
                />
              </Field>
              <Bound form={pos} name="dauer_stunden" hint={tx('Voraussichtliche Dauer in Stunden')} />
            </>
          )}

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              // Bestandsprüfung bei Teilposition
              if (istTeil && bestandUnzureichend) {
                return tx('Der Lagerbestand des gewählten Teils reicht für die eingegebene Menge nicht aus.');
              }
              const requiredFields: string[] = ['bezeichnung', 'menge', 'einzelpreis'];
              if (istTeil) requiredFields.push('teil');
              return pos.validate(requiredFields);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung & Bestätigung */}
      <WizardStep label={tx('Prüfen')} needs={['auftrag', 'positionstyp', 'bezeichnung', 'menge', 'einzelpreis']}>
        {!submit.done && (
          <SummaryStep
            forms={[pos]}
            submit={submit}
            whatHappensNext={tx('Die Position wird dem Auftrag hinzugefügt und erscheint sofort in der Positionsliste.')}
            confirmLabel={tx('Position anlegen')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[pos]}
          submit={submit}
          whatHappensNext={tx('Die Position ist jetzt Teil des Auftrags. Du kannst weitere Positionen erfassen oder direkt zur Rechnung wechseln.')}
          next={[
            { label: tx('Weitere Position erfassen'), href: '#/intents/position-erfassen' },
            { label: tx('Rechnung erstellen'), href: '#/intents/rechnung-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
