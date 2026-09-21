/**
 * Position hinzufügen — 4-Schritt-Wizard (mit bedingten Ästen 3a/3b).
 * Steps: 1) Auftrag wählen → 2) Positionstyp wählen → 3a) Arbeit-Details oder 3b) Teil wählen + Details → 4) Prüfen & anlegen.
 * Reads: auftraege (filter: angenommen|in_arbeit|fertig), mitarbeiter (filter: aktiv), teilebestand.
 * Writes: auftragspositionen (createAuftragspositionenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
  fieldNumber,
  combineFilters,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function PositionHinzufuegenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Aufträge — nur angenommen, in_arbeit, fertig
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
      status: fieldLookup(a, 'status') ?? undefined,
    }),
  });

  // Step 3a: Mitarbeiter — nur aktiv
  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldLookup(m, 'rolle')?.label ?? undefined,
    }),
  });

  // Step 3b: Teilebestand — alle Teile
  const teile = useRecordSearch(servicePort, 'teilebestand', {
    searchFields: ['artikelnummer', 'bezeichnung'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'bezeichnung'),
      subtitle: fieldText(t, 'artikelnummer'),
      stats: [{ label: tx('Bestand'), value: fieldNumber(t, 'bestand') ?? 0 }],
    }),
  });

  // Formular für Auftragspositionen — alle Felder mit ihrem Schritt
  const f = useStepForm('auftragspositionen', {
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

  const isArbeit = f.get('positionstyp') === 'arbeit';
  const isTeil = f.get('positionstyp') === 'teil';
  const selectedTeilId = f.get('teil') as string | null;
  const selectedTeilRecord = selectedTeilId ? teile.recordOf(selectedTeilId) : undefined;
  const teilBestand = selectedTeilRecord ? (fieldNumber(selectedTeilRecord, 'bestand') ?? 0) : 0;
  const eingabeMenge = Number(f.get('menge') ?? 0);
  const bestandWarnung = isTeil && selectedTeilId && eingabeMenge > 0 && eingabeMenge > teilBestand;

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'position',
      entity: 'auftragspositionen',
      form: f,
      primary: true,
    },
  ], { draftKey: 'position-hinzufuegen' });

  const handleRestart = () => {
    submit.reset();
    f.reset();
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Position hinzufügen')}
      subtitle={tx('Arbeitsleistung oder verbautes Teil zu einem Auftrag buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="position-hinzufuegen"
      intro={{
        description: tx('Füge einem laufenden Auftrag eine Arbeitsleistung oder ein Teil hinzu.'),
        needs: [tx('Auftragsnummer'), tx('Bezeichnung der Position'), tx('Menge und Einzelpreis')],
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
          emptyText={tx('Keine offenen Aufträge gefunden. Nur Aufträge mit Status „Angenommen", „In Arbeit" oder „Fertig" können bearbeitet werden.')}
          onSelect={id => {
            f.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
        />
      </WizardStep>

      {/* Schritt 2: Positionstyp wählen */}
      <WizardStep
        label={tx('Positionstyp')}
        heading={tx('Art der Position wählen')}
        description={tx('Handelt es sich um eine Arbeitsleistung oder ein verbautes Teil?')}
        needs={['auftrag']}
      >
        <div className="space-y-6">
          <Field form={f} name="positionstyp">
            <ChoiceGroup {...f.choice('positionstyp')} />
          </Field>
          <StepNav
            onNext={() => f.validate(['positionstyp'])}
            nextStepLabel={isArbeit ? tx('Arbeitsdetails') : isTeil ? tx('Teil wählen') : tx('Details')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3a: Arbeitsleistung-Details */}
      <WizardStep
        label={tx('Details')}
        heading={tx('Arbeitsleistung erfassen')}
        description={tx('Beschreibung, Menge, Preis, zuständiger Mechaniker und Dauer eintragen.')}
        enabledIf={isArbeit}
        needs={['positionstyp']}
      >
        <div className="space-y-4">
          <Bound form={f} name="bezeichnung" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Bound form={f} name="menge" hint={tx('Anzahl der Einheiten')} />
            <Bound form={f} name="einzelpreis" hint={tx('Preis pro Einheit in €')} />
          </div>
          <Bound form={f} name="dauer_stunden" hint={tx('Arbeitszeit in Stunden')} />
          <div className="pt-2">
            <p className="text-sm font-medium text-foreground mb-3">{tx('Mechaniker (optional)')}</p>
            <EntitySelectStep
              {...mitarbeiter.select}
              selectedId={f.get('mechaniker') as string | null}
              emptyText={tx('Keine aktiven Mitarbeiter gefunden.')}
              onSelect={id => {
                f.set('mechaniker', id, mitarbeiter.labelOf(id));
              }}
              createLabel={tx('Mitarbeiter anlegen')}
            />
          </div>
          <StepNav
            onNext={() => f.validate(['bezeichnung', 'menge', 'einzelpreis'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3b: Teil wählen + Details */}
      <WizardStep
        label={tx('Details')}
        heading={tx('Verbautem Teil erfassen')}
        description={tx('Teil aus dem Lager wählen, dann Menge und Einzelpreis eingeben.')}
        enabledIf={isTeil}
        needs={['positionstyp']}
      >
        <div className="space-y-6">
          {/* Teil aus Teilebestand wählen */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">{tx('Teil aus Teilebestand')}</p>
            <EntitySelectStep
              {...teile.select}
              selectedId={selectedTeilId}
              onSelect={id => {
                f.set('teil', id, teile.labelOf(id));
                // Bezeichnung aus dem Teil vorbelegen
                const rec = teile.recordOf(id);
                if (rec) {
                  const bez = fieldText(rec, 'bezeichnung');
                  if (bez && !f.get('bezeichnung')) {
                    f.set('bezeichnung', bez);
                  }
                  // Einzelpreis aus Verkaufspreis vorbelegen
                  const vp = fieldNumber(rec, 'verkaufspreis');
                  if (vp != null && !f.get('einzelpreis')) {
                    f.set('einzelpreis', String(vp));
                  }
                }
              }}
              emptyText={tx('Keine Teile im Bestand gefunden.')}
            />
          </div>

          {/* Bestand anzeigen wenn Teil gewählt */}
          {selectedTeilId && selectedTeilRecord && (
            <BudgetTracker
              format="count"
              unit={tx('Stück')}
              budget={teilBestand}
              booked={eingabeMenge > 0 ? eingabeMenge : 0}
              label={tx('Bestand')}
              texts={{
                booked: tx('Entnommen'),
                remaining: tx('Verbleibend'),
                over: tx('Bestand reicht nicht aus'),
                none: tx('Kein Bestand vorhanden'),
              }}
            />
          )}

          {/* Warnung bei Überschreitung */}
          {bestandWarnung && (
            <p className="text-sm text-destructive">
              {tx('Der Bestand des gewählten Teils reicht für die eingegebene Menge nicht aus.')}
            </p>
          )}

          <Bound form={f} name="bezeichnung" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Bound form={f} name="menge" hint={tx('Entnommene Stückzahl')} />
            <Bound form={f} name="einzelpreis" hint={tx('Verkaufspreis pro Stück in €')} />
          </div>

          <StepNav
            onNext={() => {
              if (!selectedTeilId) {
                return tx('Bitte wähle ein Teil aus dem Bestand.');
              }
              if (bestandWarnung) {
                return tx('Der Bestand des gewählten Teils reicht für die eingegebene Menge nicht aus.');
              }
              return f.validate(['bezeichnung', 'menge', 'einzelpreis']);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={[
              ...(f.get('auftrag')
                ? [{
                    key: '_auftrag_label',
                    label: tx('Auftrag'),
                    value: auftraege.labelOf(f.get('auftrag') as string) ?? (f.get('auftrag') as string),
                    step: 1,
                    keys: ['auftrag'],
                  }]
                : []),
            ]}
            whatHappensNext={tx('Die Position wird dem Auftrag hinzugefügt und erscheint sofort in der Auftragsübersicht.')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          restartLabel={tx('Weitere Position hinzufügen')}
          next={[
            {
              label: tx('Weitere Position hinzufügen'),
              onClick: handleRestart,
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          whatHappensNext={tx('Der Auftrag ist damit aktualisiert. Bei Bedarf kann jetzt eine Rechnung erstellt werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
