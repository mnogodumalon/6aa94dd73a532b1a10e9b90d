/**
 * Auftrag anlegen — 4-Schritt-Wizard.
 * Steps: 1) Fahrzeug wählen → 2) Auftragsdetails erfassen → 3) Mechaniker wählen → 4) Prüfen & anlegen.
 * Reads: fahrzeuge, mitarbeiter, auftraege (für Auftragsnummer-Berechnung).
 * Writes: auftraege (createAuftraegeEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  todayIso,
  fieldText,
  fieldLookup,
  fieldRef,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { LivingAppsService } from '@/services/livingAppsService';
import { tx } from '@/i18n';

export default function AuftragAnlegenPage() {
  const [step, setStep] = useState(1);

  // Fahrzeuge: alle, durchsuchbar nach Kennzeichen, Marke, Modell
  const fahrzeuge = useRecordSearch(servicePort, 'fahrzeuge', {
    searchFields: ['kennzeichen', 'marke', 'modell'],
    toItem: f => ({
      id: f.id,
      title: fieldText(f, 'kennzeichen'),
      subtitle: `${fieldText(f, 'marke')} ${fieldText(f, 'modell')}`.trim(),
    }),
  });

  // Mitarbeiter: nur aktiv + mechaniker oder chef
  const mechaniker = useRecordSearch(servicePort, 'mitarbeiter', {
    searchFields: ['vorname', 'nachname'],
    filter: "r.v_status == 'aktiv' and (r.v_rolle == 'mechaniker' or r.v_rolle == 'chef')",
    where: r => {
      const status = fieldLookup(r, 'status');
      const rolle = fieldLookup(r, 'rolle');
      return status?.key === 'aktiv' && (rolle?.key === 'mechaniker' || rolle?.key === 'chef');
    },
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldLookup(m, 'rolle')?.label,
    }),
  });

  // Formular für den Auftrag
  const auftrag = useStepForm('auftraege', {
    steps: {
      fahrzeug: 1,
      auftragsnummer: 2,
      annahmedatum: 2,
      fertigstellungstermin: 2,
      kilometerstand_annahme: 2,
      kundenwunsch: 2,
      status: 2,
      mechaniker: 3,
    },
    initial: {
      annahmedatum: todayIso(),
      status: 'angenommen',
    },
    required: {
      mechaniker: false,
      fertigstellungstermin: false,
      kilometerstand_annahme: false,
      kundenwunsch: false,
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
      },
    ],
    { draftKey: 'auftrag-anlegen' },
  );

  // Auftragsnummer berechnen: A-2026-NNN aus vorhandenen Aufträgen
  const berechneAuftragsnummer = async (): Promise<string> => {
    try {
      const alle = await LivingAppsService.getAuftraege();
      const pattern = /^A-\d{4}-(\d+)$/;
      let max = 0;
      for (const a of alle) {
        const match = pattern.exec(a.fields.auftragsnummer ?? '');
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > max) max = n;
        }
      }
      const naechste = (max + 1).toString().padStart(3, '0');
      const jahr = new Date().getFullYear();
      return `A-${jahr}-${naechste}`;
    } catch {
      const jahr = new Date().getFullYear();
      return `A-${jahr}-001`;
    }
  };

  return (
    <IntentWizardShell
      title={tx('Auftrag anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[auftrag]}
      draftKey="auftrag-anlegen"
      intro={{
        description: tx('Einen neuen Werkstattauftrag anlegen.'),
        needs: [tx('Fahrzeugkennzeichen'), tx('Kundenwunsch oder Fehlerbeschreibung')],
      }}
    >
      {/* Schritt 1: Fahrzeug wählen */}
      <WizardStep
        label={tx('Fahrzeug')}
        description={tx('Das Fahrzeug wählen, das zur Werkstatt gebracht wird.')}
      >
        <EntitySelectStep
          {...fahrzeuge.select}
          selectedId={auftrag.get('fahrzeug') as string}
          onSelect={async id => {
            auftrag.set('fahrzeug', id, fahrzeuge.labelOf(id));
            // Halter (Kunde) aus dem Fahrzeug-Record auslesen — für spätere Schritte
            const fzRecord = fahrzeuge.recordOf(id);
            if (fzRecord) {
              const halterId = fieldRef(fzRecord, 'halter');
              if (halterId) {
                auftrag.remember(halterId, '');
              }
            }
            // Auftragsnummer vorberechnen
            const nr = await berechneAuftragsnummer();
            auftrag.set('auftragsnummer', nr);
            setStep(2);
          }}
          avatar="none"
          searchPlaceholder={tx('Kennzeichen, Marke oder Modell suchen …')}
          columns={2}
        />
      </WizardStep>

      {/* Schritt 2: Auftragsdetails */}
      <WizardStep
        label={tx('Auftragsdetails')}
        description={tx('Auftragsdaten, Kilometerstand und Kundenwunsch erfassen.')}
        needs={['fahrzeug']}
      >
        <div className="space-y-4">
          <Field form={auftrag} name="auftragsnummer" hint={tx('Wird automatisch vergeben — bei Bedarf anpassen.')}>
            <input
              {...auftrag.field('auftragsnummer')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
          <Bound form={auftrag} name="annahmedatum" />
          <Bound form={auftrag} name="fertigstellungstermin" label={tx('Zugesagter Fertigstellungstermin')} />
          <Bound form={auftrag} name="kilometerstand_annahme" label={tx('Kilometerstand bei Annahme (km)')} />
          <Bound form={auftrag} name="kundenwunsch" rows={4} />
          <Field form={auftrag} name="status">
            <ChoiceGroup {...auftrag.choice('status')} />
          </Field>
          <StepNav
            onNext={() => auftrag.validate(['auftragsnummer', 'annahmedatum', 'status'])}
            nextStepLabel={tx('Mechaniker')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Mechaniker wählen (optional) */}
      <WizardStep
        label={tx('Mechaniker')}
        description={tx('Einen Mechaniker oder Chef zuweisen — optional, kann später ergänzt werden.')}
        needs={['fahrzeug']}
      >
        <EntitySelectStep
          {...mechaniker.select}
          selectedId={auftrag.get('mechaniker') as string | undefined}
          onSelect={id => {
            auftrag.set('mechaniker', id, mechaniker.labelOf(id));
            setStep(4);
          }}
          avatar="initials"
          searchPlaceholder={tx('Name suchen …')}
          emptyText={tx('Kein aktiver Mechaniker oder Chef gefunden.')}
          create={false}
        />
        <div className="mt-4">
          <StepNav
            onNext={() => { setStep(4); }}
            nextStepLabel={tx('Prüfen')}
            nextLabel={tx('Weiter ohne Mechaniker')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[auftrag]}
            submit={submit}
            whatHappensNext={tx('Der Auftrag wird sofort angelegt und erscheint in der Auftragsübersicht.')}
            confirmLabel={tx('Auftrag anlegen')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[auftrag]}
            submit={submit}
            restartLabel={tx('Weiteren Auftrag anlegen')}
            whatHappensNext={tx('Positionen wie Arbeit und Teile jetzt erfassen oder den Auftrag später abrechnen.')}
            next={[
              {
                label: tx('Position erfassen'),
                href: '#/intents/position-erfassen',
              },
              {
                label: tx('Zum Dashboard'),
                href: '#/',
              },
            ]}
          />
        )}
      </WizardStep>
    </IntentWizardShell>
  );
}
