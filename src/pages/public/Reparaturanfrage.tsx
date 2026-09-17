import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  todayIso,
} from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'reparaturanfrage';

const KUNDEN_APP_ID = '6aa94da65297da904085d71c';
const FAHRZEUGE_APP_ID = '6aa94daf5902b993cd4338de';

interface InnerProps {
  cfg: PublicPagesConfig;
  page: PublicPageConfig;
}

function ReparaturanfrageInner({ cfg, page }: InnerProps) {
  const STEPS: WizardStep[] = [
  {
    label: tx('Kontaktdaten'),
    key: 'kontakt',
    heading: tx('Ihre Kontaktdaten'),
    description: tx('Bitte geben Sie Ihre Kontaktdaten ein, damit wir Sie erreichen können.'),
  },
  {
    label: tx('Fahrzeug'),
    key: 'fahrzeug',
    heading: tx('Fahrzeugdaten'),
    description: tx('Bitte geben Sie die Daten Ihres Fahrzeugs ein.'),
  },
  {
    label: tx('Reparaturdetails'),
    key: 'reparatur',
    heading: tx('Reparaturdetails'),
    description: tx('Beschreiben Sie den Reparaturbedarf und Ihren Wunschtermin.'),
  },
  {
    label: tx('Prüfen & Absenden'),
    key: 'zusammenfassung',
    heading: tx('Zusammenfassung'),
  },
];

  const [step, setStep] = useState(1);

  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const today = todayIso();
  const auftragsnummer = `ANF-${today}`;

  const kundeForm = useStepForm('kunden', {
    fields: ['vorname', 'nachname', 'telefon', 'email'],
    required: { vorname: true, nachname: true, telefon: false, email: false },
    steps: { vorname: 1, nachname: 1, telefon: 1, email: 1 },
    autoComplete: true,
  });

  const fahrzeugForm = useStepForm('fahrzeuge', {
    fields: ['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig'],
    required: { kennzeichen: true, marke: true, modell: true, kilometerstand: false, hu_faellig: false },
    steps: {
      kennzeichen: 2,
      marke: 2,
      modell: 2,
      kilometerstand: 2,
      hu_faellig: 2,
    },
    autoComplete: true,
  });

  const auftragForm = useStepForm('auftraege', {
    fields: ['auftragsnummer', 'kundenwunsch', 'fertigstellungstermin'],
    required: { auftragsnummer: true, kundenwunsch: false, fertigstellungstermin: false },
    steps: { auftragsnummer: 3, kundenwunsch: 3, fertigstellungstermin: 3 },
    initial: { auftragsnummer },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [
      {
        key: 'kunde',
        entity: 'kunden',
        form: kundeForm,
        values: { kundentyp: 'privat' },
      },
      {
        key: 'fahrzeug',
        entity: 'fahrzeuge',
        form: fahrzeugForm,
        needs: ['kunde'],
        link: { halter: 'kunde' },
      },
      {
        key: 'auftrag',
        entity: 'auftraege',
        form: auftragForm,
        primary: true,
        needs: ['fahrzeug'],
        link: { fahrzeug: 'fahrzeug' },
        values: {
          annahmedatum: today,
        },
      },
    ],
    { draftKey: 'reparaturanfrage' }
  );

  const restart = () => {
    submit.reset();
    kundeForm.reset();
    fahrzeugForm.reset();
    auftragForm.reset();
    setStep(1);
  };

  return (
    <IntentWizardShell
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[kundeForm, fahrzeugForm, auftragForm]}
      draftKey="reparaturanfrage"
    >
      {step === 1 && (
        <div className="space-y-4">
          <Bound form={kundeForm} name="vorname" />
          <Bound form={kundeForm} name="nachname" />
          <Bound form={kundeForm} name="telefon" />
          <Bound form={kundeForm} name="email" />
          <StepNav
            hideBack
            onNext={() => kundeForm.validate(['vorname', 'nachname'])}
            nextStepLabel={tx('Fahrzeug')}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Bound form={fahrzeugForm} name="kennzeichen" />
          <Bound form={fahrzeugForm} name="marke" />
          <Bound form={fahrzeugForm} name="modell" />
          <Bound form={fahrzeugForm} name="kilometerstand" />
          <Bound form={fahrzeugForm} name="hu_faellig" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => fahrzeugForm.validate(['kennzeichen', 'marke', 'modell'])}
            nextStepLabel={tx('Reparaturdetails')}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Bound form={auftragForm} name="auftragsnummer" label={tx('Auftragsnummer (automatisch vergeben)')} hint={tx('Diese Nummer wird Ihrer Anfrage zugewiesen.')} />
          <Bound form={auftragForm} name="kundenwunsch" rows={5} />
          <Bound form={auftragForm} name="fertigstellungstermin" label={tx('Wunschtermin (Fertigstellung)')} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => true}
            nextStepLabel={tx('Prüfen & Absenden')}
          />
        </div>
      )}

      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[kundeForm, fahrzeugForm, auftragForm]}
          submit={submit}
          whatHappensNext={tx('Wir prüfen Ihre Anfrage und melden uns schnellstmöglich bei Ihnen.')}
          confirmLabel={tx('Anfrage absenden')}
        />
      )}

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[kundeForm, fahrzeugForm, auftragForm]}
          title={tx('Anfrage eingegangen!')}
          whatHappensNext={tx('Unser Team hat Ihre Reparaturanfrage erhalten und wird sich in Kürze bei Ihnen melden. Ihre Auftragsnummer lautet:')}
          facts={[{ label: tx('Auftragsnummer'), value: auftragsnummer }]}
          submit={submit}
          restartLabel={tx('Weitere Anfrage stellen')}
          next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
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
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        if (!c?.pages[SLUG]) setUnavailable(true);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  return (
    <PublicShell
      title={tx('Reparaturanfrage')}
      description={tx('Stellen Sie eine Reparaturanfrage ohne Login – wir melden uns bei Ihnen.')}
    >
      <ReparaturanfrageInner cfg={cfg} page={page} />
    </PublicShell>
  );
}
