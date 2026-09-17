import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { tx } from '@/i18n';

const SLUG = 'reparaturanfrage';

export default function Reparaturanfrage() {
  const STEPS = [
  {
    label: tx('Kontaktdaten'),
    description: tx('Deine Kontaktinformationen für die Reparaturanfrage'),
  },
  {
    label: tx('Fahrzeug'),
    description: tx('Daten zu deinem Fahrzeug'),
  },
  {
    label: tx('Problembeschreibung'),
    description: tx('Beschreibe das Problem und deinen Wunschtermin'),
  },
  {
    label: tx('Prüfen & Absenden'),
  },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
      if (!c?.pages[SLUG]) setUnavailable(true);
    }).catch(err => {
      if (err instanceof PageUnavailableError) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  // Step 1: Kontaktdaten (visitor's own data — autoComplete on)
  const kunde = useStepForm('kunden', {
    fields: ['vorname', 'nachname', 'telefon', 'email', 'kundentyp'],
    required: { vorname: true, nachname: true, kundentyp: true, telefon: false, email: false },
    steps: { vorname: 1, nachname: 1, telefon: 1, email: 1, kundentyp: 1 },
    initial: { kundentyp: 'privat' },
    autoComplete: true,
  });

  // Step 2: Fahrzeugdaten (halter is linked via plan — kept in fields so port can reference it)
  const fahrzeug = useStepForm('fahrzeuge', {
    fields: ['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig', 'halter'],
    required: { kennzeichen: true, marke: true, modell: true, kilometerstand: false, hu_faellig: false, halter: true },
    steps: { kennzeichen: 2, marke: 2, modell: 2, kilometerstand: 2, hu_faellig: 2 },
    autoComplete: true,
  });

  // Step 3: Problembeschreibung (fahrzeug is linked via plan — kept in fields so port can reference it)
  const auftrag = useStepForm('auftraege', {
    fields: ['fahrzeug', 'kundenwunsch', 'fertigstellungstermin', 'status'],
    required: { fahrzeug: true, kundenwunsch: false, fertigstellungstermin: false, status: true },
    steps: { kundenwunsch: 3, fertigstellungstermin: 3, status: 3 },
    initial: { status: 'angenommen' },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port!,
    [
      {
        key: 'kunde',
        entity: 'kunden',
        form: kunde,
      },
      {
        key: 'fahrzeug',
        entity: 'fahrzeuge',
        form: fahrzeug,
        needs: ['kunde'],
        link: { halter: 'kunde' },
      },
      {
        key: 'auftrag',
        entity: 'auftraege',
        form: auftrag,
        primary: true,
        needs: ['fahrzeug'],
        link: { fahrzeug: 'fahrzeug' },
      },
    ],
    { draftKey: SLUG },
  );

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  const kundenEp = page.endpoints?.find(e => e.entity === 'kunden' && e.op === 'create');

  function handleFirstInteraction() {
    if (kundenEp?.app_id) {
      prepareChallenge(cfg!, page!, 'POST', `/apps/${kundenEp.app_id}/records`);
    }
  }

  function restart() {
    submit.reset();
    kunde.reset();
    fahrzeug.reset();
    auftrag.reset();
    setStep(1);
  }

  return (
    <PublicShell
      title={page.title}
      description={page.description}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[kunde, fahrzeug, auftrag]}
        draftKey={SLUG}
      >
        {/* Step 1: Kontaktdaten */}
        {step === 1 && (
          <div className="space-y-4" onFocus={handleFirstInteraction}>
            <Bound form={kunde} name="vorname" />
            <Bound form={kunde} name="nachname" />
            <Bound form={kunde} name="telefon" />
            <Bound form={kunde} name="email" />
            <Field form={kunde} name="kundentyp" label={tx('Kundentyp')}>
              <ChoiceGroup {...kunde.choice('kundentyp')} />
            </Field>
            <StepNav
              onNext={() => kunde.validate(['vorname', 'nachname', 'kundentyp'])}
              nextStepLabel={tx('Fahrzeug')}
            />
          </div>
        )}

        {/* Step 2: Fahrzeug */}
        {step === 2 && (
          <div className="space-y-4">
            <Bound form={fahrzeug} name="kennzeichen" />
            <Bound form={fahrzeug} name="marke" />
            <Bound form={fahrzeug} name="modell" />
            <Bound form={fahrzeug} name="kilometerstand" />
            <Bound form={fahrzeug} name="hu_faellig" />
            <StepNav
              onNext={() => fahrzeug.validate(['kennzeichen', 'marke', 'modell'])}
              nextStepLabel={tx('Problembeschreibung')}
            />
          </div>
        )}

        {/* Step 3: Problembeschreibung & Wunschtermin */}
        {step === 3 && (
          <div className="space-y-4">
            <Bound
              form={auftrag}
              name="kundenwunsch"
              label={tx('Beschreibung des Problems / Kundenwunsch')}
              rows={4}
            />
            <Bound
              form={auftrag}
              name="fertigstellungstermin"
              label={tx('Wunschtermin')}
            />
            <Field form={auftrag} name="status" label={tx('Auftragsstatus')}>
              <ChoiceGroup {...auftrag.choice('status')} />
            </Field>
            <StepNav
              onNext={() => auftrag.validate(['kundenwunsch', 'fertigstellungstermin', 'status'])}
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        )}

        {/* Step 4: Zusammenfassung */}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[kunde, fahrzeug, auftrag]}
            submit={submit}
            whatHappensNext={tx('Wir melden uns zeitnah bei dir, um die Reparatur zu besprechen und einen Termin zu vereinbaren.')}
          />
        )}

        {/* Erfolg */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[kunde, fahrzeug, auftrag]}
            whatHappensNext={tx('Unser Team wird sich in Kürze bei dir melden.')}
            next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
