import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { useStepForm } from '@/lib/journey/useStepForm';
import { useJourneySubmit } from '@/lib/journey/useJourneySubmit';
import { todayIso } from '@/lib/journey/format';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

function generateAuftragsnummer(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `AU-${year}${month}${day}-${rand}`;
}

export default function Reparaturanfrage() {
  const STEPS = [
  {
    label: tx('Kontaktdaten'),
    key: 'kontakt',
    description: tx('Deine persönlichen Kontaktdaten'),
  },
  {
    label: tx('Fahrzeugdaten'),
    key: 'fahrzeug',
    description: tx('Angaben zu deinem Fahrzeug'),
  },
  {
    label: tx('Problembeschreibung'),
    key: 'problem',
    description: tx('Beschreibe das Problem und nenne deinen Wunschtermin'),
  },
  {
    label: tx('Zusammenfassung'),
    key: 'zusammenfassung',
  },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig('reparaturanfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['reparaturanfrage'] ?? null);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setPage(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const kunde = useStepForm('kunden', {
    fields: ['vorname', 'nachname', 'telefon', 'email'],
    required: { vorname: true, nachname: true, telefon: false, email: false },
    steps: { vorname: 1, nachname: 1, telefon: 1, email: 1 },
    autoComplete: true,
  });

  const fahrzeug = useStepForm('fahrzeuge', {
    fields: ['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig', 'halter'],
    required: { kennzeichen: true, marke: true, modell: true, kilometerstand: false, hu_faellig: false, halter: true },
    steps: {
      kennzeichen: 2,
      marke: 2,
      modell: 2,
      kilometerstand: 2,
      hu_faellig: 2,
    },
    autoComplete: true,
  });

  const auftrag = useStepForm('auftraege', {
    fields: ['kundenwunsch', 'fertigstellungstermin', 'fahrzeug'],
    required: { kundenwunsch: false, fertigstellungstermin: false, fahrzeug: true },
    steps: { kundenwunsch: 3, fertigstellungstermin: 3 },
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
        values: () => ({
          auftragsnummer: generateAuftragsnummer(),
          annahmedatum: todayIso(),
        }),
      },
    ],
    { draftKey: 'reparaturanfrage' },
  );

  if (loading || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={!loading && (!cfg || !page)} />;
  }

  const handleRestart = () => {
    submit.reset();
    kunde.reset();
    fahrzeug.reset();
    auftrag.reset();
    setStep(1);
  };

  return (
    <PublicShell
      title={tx('Reparaturanfrage stellen')}
      description={tx('Füll das Formular aus — wir melden uns so schnell wie möglich bei dir.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[kunde, fahrzeug, auftrag]}
        draftKey="reparaturanfrage"
      >
        {step === 1 && !submit.done && (
          <>
            <Bound form={kunde} name="vorname" />
            <Bound form={kunde} name="nachname" />
            <Bound form={kunde} name="telefon" />
            <Bound form={kunde} name="email" />
            <p className="text-sm text-muted-foreground">
              {tx('Unsere Werkstattzeiten: Montag bis Freitag, 7:30 – 16:30 Uhr. Bitte beachte, dass Reparaturanfragen ausserhalb dieser Zeiten am nächsten Werktag bearbeitet werden.')}
            </p>
            <StepNav
              hideBack
              onNext={() => {
                if (cfg && page) {
                  prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(e => e.op === 'create' && e.entity === 'kunden')?.app_id ?? ''}/records`);
                }
                return kunde.validate(['vorname', 'nachname', 'telefon', 'email']);
              }}
              nextStepLabel={tx('Fahrzeugdaten')}
            />
          </>
        )}

        {step === 2 && !submit.done && (
          <>
            <Bound form={fahrzeug} name="kennzeichen" />
            <Bound form={fahrzeug} name="marke" />
            <Bound form={fahrzeug} name="modell" />
            <Bound form={fahrzeug} name="kilometerstand" label={tx('Kilometerstand (km)')} />
            <Bound form={fahrzeug} name="hu_faellig" label={tx('HU fällig am')} />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() =>
                fahrzeug.validate(['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig'])
              }
              nextStepLabel={tx('Problembeschreibung')}
            />
          </>
        )}

        {step === 3 && !submit.done && (
          <>
            <Bound
              form={auftrag}
              name="kundenwunsch"
              label={tx('Beschreibung des Problems / Kundenwunsch')}
              rows={5}
            />
            <Bound
              form={auftrag}
              name="fertigstellungstermin"
              label={tx('Wunschtermin')}
            />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() =>
                auftrag.validate(['kundenwunsch', 'fertigstellungstermin'])
              }
              nextStepLabel={tx('Zusammenfassung')}
            />
          </>
        )}

        {step === 4 && !submit.done && !submit.result && (
          <SummaryStep
            forms={[kunde, fahrzeug, auftrag]}
            submit={submit}
            whatHappensNext={tx(
              'Wir prüfen deine Anfrage und melden uns telefonisch oder per E-Mail bei dir.',
            )}
            confirmLabel={tx('Anfrage absenden')}
          />
        )}

        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[kunde, fahrzeug, auftrag]}
            title={tx('Anfrage eingegangen!')}
            whatHappensNext={tx(
              'Deine Reparaturanfrage wurde erfolgreich übermittelt. Wir melden uns so schnell wie möglich bei dir.',
            )}
            submit={submit}
            restartLabel={tx('Neue Anfrage')}
            next={[
              {
                label: tx('Neue Anfrage'),
                onClick: handleRestart,
              },
            ]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
