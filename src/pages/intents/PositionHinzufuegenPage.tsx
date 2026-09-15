/**
 * Position hinzufügen — 4-Schritt-Wizard (Arbeit oder Teil).
 * Steps: 1) Auftrag wählen → 2) Positionstyp wählen → 3a) Arbeit-Details / 3b) Teil-Details → 4) Prüfen & anlegen.
 * Reads: auftraege (gefiltert: angenommen|in_arbeit), mitarbeiter (aktiv+mechaniker), teilebestand.
 * Writes: auftragspositionen (create), teilebestand (update Bestand bei 'teil'), auftraege (update status → in_arbeit).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, Field, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldNumber,
  fieldLookup,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function PositionHinzufuegenPage() {
  const [step, setStep] = useState(1);

  // Aufträge: nur angenommen oder in_arbeit
  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    filter: "r.v_status in ['angenommen', 'in_arbeit']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key === 'angenommen' || key === 'in_arbeit';
    },
    searchFields: ['auftragsnummer', 'kundenwunsch'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldText(a, 'kundenwunsch') || undefined,
      status: fieldLookup(a, 'status') ?? undefined,
    }),
    orderby: ['r.v_annahmedatum desc'],
  });

  // Mitarbeiter: nur aktiv + Rolle mechaniker
  const mechaniker = useRecordSearch(servicePort, 'mitarbeiter', {
    filter: "r.v_status == 'aktiv' and r.v_rolle == 'mechaniker'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv' && fieldLookup(r, 'rolle')?.key === 'mechaniker',
    searchFields: ['vorname', 'nachname'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
    }),
  });

  // Teilebestand: alle Teile
  const teile = useRecordSearch(servicePort, 'teilebestand', {
    searchFields: ['artikelnummer', 'bezeichnung', 'hersteller'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'bezeichnung'),
      subtitle: fieldText(t, 'artikelnummer') || undefined,
      stats: [
        { label: tx('Bestand'), value: fieldNumber(t, 'bestand') ?? 0 },
      ],
    }),
    orderby: ['r.v_bezeichnung asc'],
  });

  // Hauptformular für Auftragsposition
  const position = useStepForm('auftragspositionen', {
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

  const positionstyp = position.get('positionstyp') as string | null;
  const selectedTeilId = position.get('teil') as string | null;
  const selectedAuftragId = position.get('auftrag') as string | null;

  // Bestand + Mindestbestand des gewählten Teils
  const selectedTeil = selectedTeilId ? teile.recordOf(selectedTeilId) : undefined;
  const teilBestand = selectedTeil ? (fieldNumber(selectedTeil, 'bestand') ?? 0) : null;
  const teilMindestbestand = selectedTeil ? (fieldNumber(selectedTeil, 'mindestbestand') ?? 0) : null;
  const bestandNiedrig = teilBestand !== null && teilMindestbestand !== null && teilBestand <= teilMindestbestand;

  // Gesamtpreis für Erfolgsmeldung
  const menge = position.get('menge') as number | null;
  const einzelpreis = position.get('einzelpreis') as number | null;
  const gesamtpreis = menge != null && einzelpreis != null ? menge * einzelpreis : null;

  // Aktueller Auftragsstatus
  const selectedAuftrag = selectedAuftragId ? auftraege.recordOf(selectedAuftragId) : undefined;
  const auftragStatus = selectedAuftrag ? fieldLookup(selectedAuftrag, 'status')?.key : null;

  // Plan: Position anlegen, ggf. Bestand updaten, ggf. Auftragsstatus → in_arbeit
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'position',
      entity: 'auftragspositionen',
      form: position,
      primary: true,
    },
    {
      key: 'bestand_update',
      needs: ['position'],
      label: tx('Bestand aktualisieren'),
      run: async ({ port }) => {
        if (positionstyp !== 'teil' || !selectedTeilId || !selectedTeil) return;
        const aktuell = fieldNumber(selectedTeil, 'bestand') ?? 0;
        const entnommen = (position.get('menge') as number | null) ?? 0;
        return await (port as import('@/lib/journey').InternalJourneyPort).update(
          'teilebestand',
          selectedTeilId,
          { bestand: aktuell - entnommen },
        );
      },
    },
    {
      key: 'auftrag_status',
      needs: ['position'],
      label: tx('Auftrag aktualisieren'),
      run: async ({ port }) => {
        if (!selectedAuftragId || auftragStatus !== 'angenommen') return;
        return await (port as import('@/lib/journey').InternalJourneyPort).update(
          'auftraege',
          selectedAuftragId,
          { status: 'in_arbeit' },
        );
      },
    },
  ], { draftKey: 'position-hinzufuegen' });

  return (
    <IntentWizardShell
      title={tx('Position hinzufügen')}
      subtitle={tx('Arbeitsstunden oder Teile einem Auftrag zubuchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[position]}
      draftKey="position-hinzufuegen"
      intro={{
        description: tx('Arbeitsstunden oder ein Ersatzteil zu einem laufenden Auftrag buchen.'),
        needs: [tx('Auftragsnummer'), tx('Bezeichnung der Leistung oder Teilenummer')],
      }}
    >
      {/* Schritt 1: Auftrag wählen */}
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Laufenden Auftrag wählen — abgerechnete oder abgeholte Aufträge werden nicht angeboten.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={position.get('auftrag') as string | null}
          onSelect={id => {
            position.set('auftrag', id, auftraege.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Aufträge gefunden. Nur Aufträge mit Status „Angenommen" oder „In Arbeit" sind wählbar.')}
          searchPlaceholder={tx('Auftragsnummer oder Kundenwunsch …')}
          avatar="none"
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Positionstyp */}
      <WizardStep
        label={tx('Typ')}
        description={tx('Art der Position wählen: Arbeitsstunden oder ein Ersatzteil.')}
        needs={['auftrag']}
      >
        <div className="space-y-6">
          <Field form={position} name="positionstyp" label={tx('Positionstyp')}>
            <ChoiceGroup {...position.choice('positionstyp')} />
          </Field>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => position.validate(['positionstyp'])}
            nextStepLabel={tx('Details')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Details — Arbeit */}
      <WizardStep
        label={tx('Details')}
        description={tx('Bezeichnung, Stunden und Preis der Arbeit eintragen.')}
        enabledIf={positionstyp === 'arbeit'}
        needs={['positionstyp']}
      >
        <div className="space-y-4">
          <Bound form={position} name="bezeichnung" placeholder={tx('z. B. Ölwechsel, Bremsen prüfen …')} />
          <Bound form={position} name="menge" hint={tx('Anzahl Stunden')} />
          <Bound form={position} name="einzelpreis" hint={tx('Preis pro Stunde (EUR)')} />
          <Bound form={position} name="dauer_stunden" />

          {/* Mechaniker: optional, EntitySelectStep */}
          <Field form={position} name="mechaniker" label={tx('Mechaniker (optional)')}>
            <EntitySelectStep
              {...mechaniker.select}
              selectedId={position.get('mechaniker') as string | null}
              onSelect={id => position.set('mechaniker', id, mechaniker.labelOf(id))}
              searchPlaceholder={tx('Mechaniker suchen …')}
              emptyText={tx('Keine aktiven Mechaniker gefunden.')}
              create={false}
              avatar="initials"
            />
          </Field>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => position.validate(['bezeichnung', 'menge', 'einzelpreis'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3b: Details — Teil */}
      <WizardStep
        label={tx('Details')}
        description={tx('Verwendetes Teil wählen und Menge sowie Preis eintragen.')}
        enabledIf={positionstyp === 'teil'}
        needs={['positionstyp']}
      >
        <div className="space-y-4">
          {/* Teil auswählen */}
          <Field form={position} name="teil" label={tx('Verwendetes Teil')}>
            <EntitySelectStep
              {...teile.select}
              selectedId={position.get('teil') as string | null}
              onSelect={id => {
                const record = teile.recordOf(id);
                position.set('teil', id, teile.labelOf(id));
                // Bezeichnung und Einzelpreis aus dem Teil vorausfüllen
                if (record) {
                  position.set('bezeichnung', fieldText(record, 'bezeichnung'));
                  const vp = fieldNumber(record, 'verkaufspreis');
                  if (vp != null) {
                    position.set('einzelpreis', vp);
                  }
                }
              }}
              searchPlaceholder={tx('Artikelnummer, Bezeichnung oder Hersteller …')}
              emptyText={tx('Keine Teile im Bestand gefunden.')}
              create={false}
              avatar="none"
            />
          </Field>

          {/* Bestandswarnung */}
          {selectedTeilId && teilBestand !== null && (
            <div className={`rounded-lg p-3 text-sm ${bestandNiedrig ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
              {bestandNiedrig
                ? tx('Bestand niedrig — bitte nachbestellen.')
                : null}
              {' '}
              {tx('Aktueller Bestand')}{': '}<strong>{teilBestand}</strong>{' '}{tx('Stück')}
              {teilMindestbestand !== null && (
                <span className="ml-2 text-xs">({tx('Mindestbestand')}: {teilMindestbestand})</span>
              )}
            </div>
          )}

          <Bound form={position} name="bezeichnung" placeholder={tx('Teilbezeichnung …')} />
          <Bound form={position} name="menge" hint={tx('Anzahl')} />
          <Bound form={position} name="einzelpreis" hint={tx('Verkaufspreis (EUR)')} />

          {/* Mechaniker: optional */}
          <Field form={position} name="mechaniker" label={tx('Mechaniker (optional)')}>
            <EntitySelectStep
              {...mechaniker.select}
              selectedId={position.get('mechaniker') as string | null}
              onSelect={id => position.set('mechaniker', id, mechaniker.labelOf(id))}
              searchPlaceholder={tx('Mechaniker suchen …')}
              emptyText={tx('Keine aktiven Mechaniker gefunden.')}
              create={false}
              avatar="initials"
            />
          </Field>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => position.validate(['teil', 'bezeichnung', 'menge', 'einzelpreis'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done ? (
          <SummaryStep
            forms={[position]}
            submit={submit}
            items={[
              ...(gesamtpreis != null
                ? [{
                    key: 'gesamtpreis',
                    label: tx('Gesamtpreis'),
                    value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(gesamtpreis),
                  }]
                : []),
              ...(bestandNiedrig && positionstyp === 'teil'
                ? [{
                    key: 'bestand_warnung',
                    label: tx('Hinweis'),
                    value: tx('Bestand nach Entnahme unter Mindestbestand — bitte nachbestellen.'),
                  }]
                : []),
            ]}
            whatHappensNext={
              positionstyp === 'teil'
                ? tx('Die Position wird angelegt, der Teilebestand wird entsprechend reduziert und der Auftrag auf „In Arbeit" gesetzt (falls noch nicht geschehen).')
                : tx('Die Position wird angelegt und der Auftrag auf „In Arbeit" gesetzt (falls noch nicht geschehen).')
            }
          />
        ) : null}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          forms={[position]}
          restartLabel={tx('Weitere Position')}
          facts={[
            ...(gesamtpreis != null
              ? [{
                  label: tx('Gesamtpreis'),
                  value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(gesamtpreis),
                }]
              : []),
          ]}
          whatHappensNext={tx('Die Position ist im Auftrag erfasst. Du kannst weitere Positionen hinzufügen oder den Auftrag abrechnen.')}
          next={[
            { label: tx('Auftrag abrechnen'), href: '#/intents/auftrag-abrechnen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
