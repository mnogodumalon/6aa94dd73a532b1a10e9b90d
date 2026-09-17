import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit, todayIso } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { tx } from '@/i18n';

const SLUG = 'reparaturanfrage';

const KUNDEN_APP_ID = '6aa94da65297da904085d71c';
const FAHRZEUGE_APP_ID = '6aa94daf5902b993cd4338de';

function ReparaturanfrageInner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const STEPS: WizardStep[] = [
  {
    label: tx('Kontaktdaten'),
    key: 'kontakt',
    description: tx('Deine Kontaktinformationen für die Reparaturanfrage.'),
  },
  {
    label: tx('Fahrzeugdaten'),
    key: 'fahrzeug',
    description: tx('Angaben zu deinem Fahrzeug.'),
  },
  {
    label: tx('Auftragsbeschreibung'),
    key: 'auftrag',
    description: tx('Beschreibe das Problem und deinen Wunschtermin.'),
  },
  {
    label: tx('Prüfen & Absenden'),
    key: 'zusammenfassung',
  },
];

  const [step, setStep] = useState(1);

  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const kunde = useStepForm('kunden', {
    fields: ['vorname', 'nachname', 'telefon', 'email'],
    required: { vorname: true, nachname: true, telefon: false, email: false },
    steps: { vorname: 1, nachname: 1, telefon: 1, email: 1 },
    autoComplete: true,
  });

  const fahrzeug = useStepForm('fahrzeuge', {
    fields: ['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig', 'halter'],
    required: { kennzeichen: true, marke: true, modell: true, kilometerstand: false, hu_faellig: false, halter: false },
    steps: { kennzeichen: 2, marke: 2, modell: 2, kilometerstand: 2, hu_faellig: 2 },
    autoComplete: true,
  });

  const auftrag = useStepForm('auftraege', {
    fields: ['kundenwunsch', 'fertigstellungstermin', 'fahrzeug', 'annahmedatum'],
    required: { kundenwunsch: false, fertigstellungstermin: false, fahrzeug: false, annahmedatum: false },
    steps: { kundenwunsch: 3, fertigstellungstermin: 3 },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
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
        needs: ['fahrzeug'],
        link: { fahrzeug: 'fahrzeug' },
        values: () => ({ annahmedatum: todayIso() }),
        primary: true,
      },
    ],
    { draftKey: SLUG },
  );

  const restart = () => {
    submit.reset();
    kunde.reset();
    fahrzeug.reset();
    auftrag.reset();
    setStep(1);
  };

  if (submit.result) {
    return (
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[kunde, fahrzeug, auftrag]}
        draftKey={SLUG}
      >
        <SuccessStep
          result={submit.result}
          forms={[kunde, fahrzeug, auftrag]}
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns so schnell wie möglich bei dir.')}
          submit={submit}
          restartLabel={tx('Neue Anfrage stellen')}
          next={[{ label: tx('Neue Anfrage stellen'), onClick: restart }]}
        />
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[kunde, fahrzeug, auftrag]}
      draftKey={SLUG}
    >
      {step === 1 && (
        <>
          <Bound form={kunde} name="vorname" />
          <Bound form={kunde} name="nachname" />
          <Bound form={kunde} name="telefon" />
          <Bound form={kunde} name="email" />
          <StepNav
            onNext={() => kunde.validate(['vorname', 'nachname'])}
            nextStepLabel={tx('Fahrzeugdaten')}
            hideBack
          />
        </>
      )}
      {step === 2 && (
        <>
          <Bound form={fahrzeug} name="kennzeichen" />
          <Bound form={fahrzeug} name="marke" />
          <Bound form={fahrzeug} name="modell" />
          <Bound form={fahrzeug} name="kilometerstand" />
          <Bound form={fahrzeug} name="hu_faellig" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => fahrzeug.validate(['kennzeichen', 'marke', 'modell'])}
            nextStepLabel={tx('Auftragsbeschreibung')}
          />
        </>
      )}
      {step === 3 && (
        <>
          <Bound form={auftrag} name="kundenwunsch" rows={4} hint={tx('Beschreibe das Problem so genau wie möglich.')} />
          <Bound form={auftrag} name="fertigstellungstermin" label={tx('Wunschtermin')} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => { setStep(4); return true; }}
            nextStepLabel={tx('Prüfen & Absenden')}
          />
        </>
      )}
      {step === 4 && (
        <SummaryStep
          forms={[kunde, fahrzeug, auftrag]}
          submit={submit}
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns so schnell wie möglich bei dir.')}
        />
      )}
    </IntentWizardShell>
  );
}

export default function Reparaturanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
      if (!c?.pages[SLUG]) setUnavailable(true);
    }).catch(err => {
      setLoading(false);
      if (err instanceof PageUnavailableError) {
        setUnavailable(true);
      } else {
        setUnavailable(true);
      }
    });
  }, []);

  if (loading) {
    return <PublicShell loading />;
  }
  if (unavailable || !cfg || !page) {
    return <PublicShell unavailable />;
  }

  return (
    <PublicShell
      title={page.title}
      description={page.description}
    >
      <ReparaturanfrageInner cfg={cfg} page={page} />
    </PublicShell>
  );
}
