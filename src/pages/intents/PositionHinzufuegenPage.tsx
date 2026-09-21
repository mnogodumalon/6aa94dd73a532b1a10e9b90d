/**
 * Position hinzufügen — 4-Schritt-Wizard.
 * Steps: 1) Auftrag wählen → 2) Positionstyp wählen → 3a) Teil wählen + Menge/Preis
 *        (bei Typ 'teil') oder 3b) Arbeitsleistung erfassen (bei Typ 'arbeit') → 4) Prüfen & anlegen.
 * Reads: auftraege (filter: angenommen|in_arbeit|fertig), teilebestand, mitarbeiter.
 * Writes: auftragspositionen (createAuftragspositionenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           Field, StepNav, SummaryStep, SuccessStep, BudgetTracker.
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
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Input } from '@/components/ui/input';
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

const ELIGIBLE_STATUS_FILTER = "r.v_status in ['angenommen', 'in_arbeit', 'fertig']";

export default function PositionHinzufuegenPage() {
  const [step, setStep] = useState(1);

  // Search hooks — all before any early return (Rules of Hooks)
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    searchFields: ['auftragsnummer'],
    filter: ELIGIBLE_STATUS_FILTER,
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

  const teilebestand = useRecordSearch(servicePort, 'teilebestand', {
    searchFields: ['artikelnummer', 'bezeichnung', 'hersteller'],
    toItem: t => ({
      id: t.id,
      title: `${fieldText(t, 'bezeichnung')} (${fieldText(t, 'artikelnummer')})`,
      subtitle: fieldText(t, 'hersteller') || undefined,
      stats: [
        { label: tx('Bestand'), value: fieldNumber(t, 'bestand') ?? 0 },
        { label: tx('VK-Preis'), value: fieldNumber(t, 'verkaufspreis') != null ? `${fieldNumber(t, 'verkaufspreis')} €` : '—' },
      ],
    }),
  });

  const mitarbeiter = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      status: fieldLookup(m, 'rolle') ?? undefined,
    }),
  });

  // ONE form for the entity we write
  const position = useStepForm('auftragspositionen', {
    steps: {
      auftrag: 1,
      positionstyp: 2,
      teil: 3,
      bezeichnung: 3,
      menge: 3,
      einzelpreis: 3,
      mechaniker: 3,
      dauer_stunden: 3,
    },
    messages: {
      auftrag: tx('Bitte einen offenen Auftrag wählen.'),
      mechaniker: tx('Bitte einen Mechaniker für diese Arbeitsleistung wählen.'),
      teil: tx('Bitte ein Teil aus dem Bestand wählen.'),
    },
  });

  const positionstyp = position.get('positionstyp') as string | null;
  const selectedTeilId = position.get('teil') as string | null;
  const menge = parseFloat(String(position.get('menge') ?? '0')) || 0;

  // Stock info for the selected part
  const selectedTeil = selectedTeilId ? teilebestand.recordOf(selectedTeilId) : undefined;
  const bestand = selectedTeil ? (fieldNumber(selectedTeil, 'bestand') ?? 0) : 0;
  const stockInsufficient = positionstyp === 'teil' && selectedTeilId != null && menge > bestand;

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'position',
      entity: 'auftragspositionen',
      form: position,
      primary: true,
    },
  ], { draftKey: 'position-hinzufuegen' });

  return (
    <IntentWizardShell
      title={tx('Position hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[position]}
      draftKey="position-hinzufuegen"
      intro={{
        description: tx('Einen offenen Auftrag wählen und eine Arbeitsleistung oder ein verbautes Teil erfassen.'),
        needs: [tx('Auftragsnummer'), tx('Artikelnummer oder Bezeichnung des Teils / Stundensatz')],
      }}
    >
      {/* Step 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Nur Aufträge mit Status „Angenommen", „In Arbeit" oder „Fertig" können bearbeitet werden.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={position.get('auftrag') as string | null}
          onSelect={id => {
            position.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
          avatar="none"
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          emptyText={tx('Kein offener Auftrag gefunden. Nur Aufträge mit Status „Angenommen", „In Arbeit" oder „Fertig" erscheinen hier.')}
          create={false}
        />
      </WizardStep>

      {/* Step 2: Positionstyp wählen */}
      <WizardStep
        label={tx('Positionstyp')}
        description={tx('Handelt es sich um eine Arbeitsleistung oder ein verbautes Teil?')}
        needs={['auftrag']}
      >
        <div className="space-y-6">
          <Bound form={position} name="positionstyp" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              const ok = position.validate(['positionstyp']);
              if (!ok) return false;
              setStep(3);
            }}
            nextStepLabel={positionstyp === 'arbeit' ? tx('Arbeitsleistung') : positionstyp === 'teil' ? tx('Teil wählen') : tx('Details')}
          />
        </div>
      </WizardStep>

      {/* Step 3a: Teil wählen (only when positionstyp === 'teil') */}
      <WizardStep
        label={tx('Details')}
        enabledIf={positionstyp === 'teil'}
        description={tx('Teil aus dem Bestand wählen und Menge sowie Einzelpreis angeben.')}
        needs={['positionstyp']}
      >
        <div className="space-y-6">
          {/* Teil-Auswahl */}
          <div>
            <p className="text-sm font-medium mb-2">{tx('Teil aus dem Bestand')}</p>
            <EntitySelectStep
              {...teilebestand.select}
              selectedId={selectedTeilId}
              onSelect={id => {
                position.set('teil', id, teilebestand.labelOf(id));
                // Vorausfüllen mit dem Verkaufspreis des Teils
                const teil = teilebestand.recordOf(id);
                const vk = teil ? fieldNumber(teil, 'verkaufspreis') : null;
                if (vk != null) {
                  const numField = position.number('einzelpreis');
                  numField.onChange({ target: { value: String(vk) } } as React.ChangeEvent<HTMLInputElement>);
                }
                // Bezeichnung des Teils vorausfüllen
                const bez = teil ? fieldText(teil, 'bezeichnung') : '';
                if (bez) {
                  const tf = position.field('bezeichnung');
                  tf.onChange({ target: { value: bez } } as React.ChangeEvent<HTMLInputElement>);
                }
              }}
              avatar="none"
              searchPlaceholder={tx('Artikel, Bezeichnung oder Hersteller suchen …')}
              emptyText={tx('Kein Teil im Bestand gefunden.')}
              columns={2}
            />
          </div>

          {/* Bestand-Anzeige */}
          {selectedTeilId && selectedTeil && (
            <BudgetTracker
              format="count"
              unit={tx('Stück')}
              budget={bestand}
              booked={menge}
              label={tx('Lagerbestand')}
              showRemaining
              texts={{
                booked: tx('Benötigt'),
                remaining: tx('Verbleibend'),
                over: tx('Lagerbestand reicht nicht aus!'),
                none: tx('Kein Bestand vorhanden'),
              }}
            />
          )}

          {stockInsufficient && (
            <p className="text-sm text-destructive">
              {tx('Der Lagerbestand des gewählten Teils reicht für die eingegebene Menge nicht aus.')}
            </p>
          )}

          {/* Menge */}
          <Field form={position} name="menge" hint={tx('Anzahl der verbauten Teile')}>
            <Input {...position.number('menge')} />
          </Field>

          {/* Einzelpreis */}
          <Field form={position} name="einzelpreis" hint={tx('Verkaufspreis pro Stück (€)')}>
            <Input {...position.number('einzelpreis')} />
          </Field>

          {/* Bezeichnung (für Rechnung) */}
          <Field form={position} name="bezeichnung" hint={tx('Erscheint auf der Rechnung')}>
            <Input {...position.field('bezeichnung')} />
          </Field>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              if (stockInsufficient) {
                return tx('Der Lagerbestand des gewählten Teils reicht für die eingegebene Menge nicht aus.');
              }
              const ok = position.validate(['teil', 'bezeichnung', 'menge', 'einzelpreis']);
              if (!ok) return false;
              setStep(4);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Step 3b: Arbeitsleistung erfassen (only when positionstyp === 'arbeit') */}
      <WizardStep
        label={tx('Details')}
        enabledIf={positionstyp === 'arbeit'}
        description={tx('Bezeichnung, Stunden und Mechaniker der Arbeitsleistung angeben.')}
        needs={['positionstyp']}
      >
        <div className="space-y-6">
          {/* Bezeichnung */}
          <Field form={position} name="bezeichnung" hint={tx('Erscheint auf der Rechnung')}>
            <Input {...position.field('bezeichnung')} />
          </Field>

          {/* Menge (Stunden-Einheiten) */}
          <Field form={position} name="menge" hint={tx('Abrechnungseinheiten (z. B. 2,5 Stunden)')}>
            <Input {...position.number('menge')} />
          </Field>

          {/* Einzelpreis (Stundensatz) */}
          <Field form={position} name="einzelpreis" hint={tx('Stundensatz in €')}>
            <Input {...position.number('einzelpreis')} />
          </Field>

          {/* Dauer in Stunden (tatsächliche Arbeitszeit) */}
          <Bound
            form={position}
            name="dauer_stunden"
            hint={tx('Tatsächlich aufgewandte Zeit in Stunden')}
          />

          {/* Mechaniker wählen */}
          <div>
            <p className="text-sm font-medium mb-2">{tx('Mechaniker')}</p>
            <EntitySelectStep
              {...mitarbeiter.select}
              selectedId={position.get('mechaniker') as string | null}
              onSelect={id => {
                position.set('mechaniker', id, mitarbeiter.labelOf(id));
              }}
              avatar="initials"
              searchPlaceholder={tx('Name suchen …')}
              emptyText={tx('Kein Mitarbeiter gefunden.')}
              create={false}
            />
          </div>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              const ok = position.validate(['bezeichnung', 'menge', 'einzelpreis', 'mechaniker']);
              if (!ok) return false;
              setStep(4);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Step 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[position]}
            submit={submit}
            whatHappensNext={tx('Die Position wird dem gewählten Auftrag hinzugefügt und erscheint auf der nächsten Rechnung.')}
            items={[
              ...(positionstyp === 'teil' && selectedTeilId && selectedTeil
                ? [{
                    key: '_bestand',
                    label: tx('Verfügbarer Bestand'),
                    value: `${bestand} ${tx('Stück')}`,
                  }]
                : []),
              {
                key: '_gesamtpreis',
                label: tx('Gesamtpreis'),
                value: menge && position.get('einzelpreis')
                  ? `${(menge * (parseFloat(String(position.get('einzelpreis') ?? '0')) || 0)).toFixed(2).replace('.', ',')} €`
                  : '—',
              },
            ]}
          />
        )}
      </WizardStep>

      {/* Success */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[position]}
          submit={submit}
          restartLabel={tx('Weitere Position hinzufügen')}
          whatHappensNext={tx('Die Position ist gespeichert. Du kannst jetzt eine weitere Position hinzufügen oder die Rechnung erstellen.')}
          next={[
            { label: tx('Rechnung erstellen'), href: '#/intents/rechnung-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
