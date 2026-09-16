/**
 * Position erfassen — 4-Schritt-Wizard.
 * Steps: 1) Auftrag wählen → 2) Positionstyp wählen → 3) Positionsdaten → 4) Prüfen & anlegen.
 * Reads: auftraege (gefiltert: angenommen|in_arbeit), mitarbeiter (aktiv), teilebestand.
 * Writes: auftragspositionen.
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
import { Input } from '@/components/ui/input';
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

export default function PositionErfassenPage() {
  const [step, setStep] = useState(1);

  // Schritt 1: Aufträge (nur angenommen oder in_arbeit)
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    searchFields: ['auftragsnummer'],
    filter: "r.v_status in ['angenommen', 'in_arbeit']",
    where: r => {
      const s = fieldLookup(r, 'status')?.key;
      return s === 'angenommen' || s === 'in_arbeit';
    },
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldLookup(a, 'status')?.label,
      status: fieldLookup(a, 'status') ?? undefined,
    }),
  });

  // Schritt 3a: Mechaniker (nur aktiv) — benötigt für Typ "arbeit"
  const mechaniker = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    filter: "r.v_status == 'aktiv'", /* i18n-exempt */
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldLookup(m, 'rolle')?.label,
    }),
  });

  // Schritt 3b: Teile — benötigt für Typ "teil"
  const teile = useRecordSearch(servicePort, 'teilebestand', {
    searchFields: ['artikelnummer', 'bezeichnung'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'bezeichnung'),
      subtitle: fieldText(t, 'artikelnummer'),
      stats: [{ label: tx('Bestand'), value: fieldNumber(t, 'bestand') ?? 0 }],
    }),
  });

  // Einziges Formular für auftragspositionen
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
    initial: { menge: 1 },
  });

  const submit = useJourneySubmit(servicePort, [
    { key: 'position', entity: 'auftragspositionen', form: f, primary: true },
  ], { draftKey: 'position-erfassen' });

  const positionstyp = f.get('positionstyp') as string | null;
  const istArbeit = positionstyp === 'arbeit';
  const istTeil = positionstyp === 'teil';

  // Bestand des gewählten Teils für Warnhinweis
  const gewaehltesTeilId = f.get('teil') as string | null;
  const gewaehltesTeil = gewaehltesTeilId ? teile.recordOf(gewaehltesTeilId) : undefined;
  const bestand = gewaehltesTeil ? (fieldNumber(gewaehltesTeil, 'bestand') ?? 0) : null;
  const menge = parseFloat(String(f.get('menge') ?? '0')) || 0;
  const bestandsWarnung = bestand !== null && menge > bestand;

  return (
    <IntentWizardShell
      title={tx('Position erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="position-erfassen"
      intro={{
        description: tx('Arbeitszeit oder verbautes Teil zu einem offenen Auftrag hinzufügen.'),
        needs: [tx('Auftragsnummer'), tx('Bezeichnung und Preis der Position')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Nur offene Aufträge (angenommen oder in Arbeit) werden angezeigt.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={f.get('auftrag') as string | null}
          onSelect={id => {
            f.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Kein offener Auftrag gefunden. Nur Aufträge mit Status „Angenommen" oder „In Arbeit" können bearbeitet werden.')}
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          avatar="none"
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Positionstyp wählen */}
      <WizardStep
        label={tx('Positionstyp')}
        description={tx('Handelt es sich um geleistete Arbeit oder ein verbautes Teil?')}
        needs={['auftrag']}
      >
        <div className="space-y-6">
          <Bound form={f} name="positionstyp" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['positionstyp'])}
            nextStepLabel={tx('Positionsdaten')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Positionsdaten */}
      <WizardStep
        label={tx('Positionsdaten')}
        description={tx('Bezeichnung, Menge und Preis der Position eingeben.')}
        needs={['auftrag', 'positionstyp']}
      >
        <div className="space-y-4">
          <Bound form={f} name="bezeichnung" />
          <div className="grid grid-cols-2 gap-4">
            <Field form={f} name="menge">
              <Input {...f.number('menge')} />
            </Field>
            <Field form={f} name="einzelpreis" hint={tx('in €')}>
              <Input {...f.number('einzelpreis')} />
            </Field>
          </div>

          {/* Felder für Positionstyp "Arbeit" */}
          {istArbeit && (
            <div className="space-y-4">
              <Field form={f} name="mechaniker" label={tx('Mechaniker')}>
                <EntitySelectStep
                  {...mechaniker.select}
                  selectedId={f.get('mechaniker') as string | null}
                  onSelect={id => f.set('mechaniker', id, mechaniker.labelOf(id))}
                  emptyText={tx('Kein aktiver Mechaniker gefunden.')}
                  searchPlaceholder={tx('Name suchen …')}
                  create={false}
                />
              </Field>
              <Field form={f} name="dauer_stunden" hint={tx('Dezimalstunden, z. B. 1.5')}>
                <Input {...f.number('dauer_stunden')} />
              </Field>
            </div>
          )}

          {/* Felder für Positionstyp "Teil" */}
          {istTeil && (
            <div className="space-y-4">
              <Field form={f} name="teil" label={tx('Verwendetes Teil')}>
                <EntitySelectStep
                  {...teile.select}
                  selectedId={f.get('teil') as string | null}
                  onSelect={id => f.set('teil', id, teile.labelOf(id))}
                  emptyText={tx('Kein Teil im Bestand gefunden.')}
                  searchPlaceholder={tx('Artikelnummer oder Bezeichnung suchen …')}
                  create={false}
                  avatar="none"
                />
              </Field>
              {bestandsWarnung && (
                <p className="text-sm text-destructive">
                  {tx('Achtung: Die eingegebene Menge überschreitet den aktuellen Bestand von')} {bestand} {tx('Stück.')}
                </p>
              )}
              {bestand !== null && !bestandsWarnung && (
                <p className="text-xs text-muted-foreground">
                  {tx('Aktueller Bestand:')} {bestand} {tx('Stück')}
                </p>
              )}
            </div>
          )}

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              const keys: string[] = ['bezeichnung', 'menge', 'einzelpreis'];
              if (istArbeit) keys.push('dauer_stunden');
              if (istTeil) keys.push('teil');
              return f.validate(keys);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung & Bestätigung */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Die Position wird sofort dem Auftrag hinzugefügt und erscheint in der Auftragsübersicht.')}
          />
        )}
      </WizardStep>

      {/* Erfolgsschritt */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          restartLabel={tx('Weitere Position erfassen')}
          next={[
            { label: tx('Auftrag abrechnen'), href: '#/intents/auftrag-abrechnen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Den Auftrag abrechnen, sobald alle Positionen erfasst sind.')}
        />
      )}
    </IntentWizardShell>
  );
}
