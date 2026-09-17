import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  prepareChallenge,
  type PublicPageConfig,
  type PublicPagesConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit, todayIso } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'reparaturanfrage';

const APP_IDS = {
  KUNDEN: '6aa94da65297da904085d71c',
  FAHRZEUGE: '6aa94daf5902b993cd4338de',
};

function makeAuftragsnummer(): string {
  const now = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `AU-${yyyy}-${MM}-${dd}-${HH}${mm}${ss}`;
}

export default function Reparaturanfrage() {
  const STEPS = [
  { label: tx('Kontaktdaten'), key: 'kontakt' },
  { label: tx('Fahrzeugdaten'), key: 'fahrzeug' },
  { label: tx('Anliegen & Termin'), key: 'anliegen' },
  { label: tx('Prüfen & Absenden'), key: 'zusammenfassung' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(e => {
        if (e instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
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
    fields: ['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig'],
    required: { kennzeichen: true, marke: true, modell: true },
    steps: { kennzeichen: 2, marke: 2, modell: 2, kilometerstand: 2, hu_faellig: 2 },
    autoComplete: true,
  });

  const auftrag = useStepForm('auftraege', {
    fields: ['kundenwunsch', 'fertigstellungstermin'],
    required: { kundenwunsch: false, fertigstellungstermin: false },
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
          auftragsnummer: makeAuftragsnummer(),
          annahmedatum: todayIso(),
        }),
      },
    ],
    { draftKey: 'reparaturanfrage' },
  );

  if (loading || (!cfg && !unavailable)) {
    return <PublicShell loading />;
  }
  if (unavailable || !page || !port) {
    return <PublicShell unavailable />;
  }

  const kundenEp = page.endpoints?.find(e => e.entity === 'kunden' && e.op === 'create');

  function handleFirstInteraction() {
    if (kundenEp?.app_id) {
      prepareChallenge(cfg!, page!, 'POST', `/apps/${kundenEp.app_id}/records`);
    }
  }

  function restart() {
    kunde.reset();
    fahrzeug.reset();
    auftrag.reset();
    submit.reset();
    setStep(1);
  }

  return (
    <PublicShell
      title={tx('Reparaturanfrage stellen')}
      description={tx('Teilen Sie uns Ihr Fahrzeug und Ihr Anliegen mit — wir melden uns schnellstmöglich.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[kunde, fahrzeug, auftrag]}
        draftKey="reparaturanfrage"
      >
        {/* Schritt 1 — Kontaktdaten */}
        {step === 1 && !submit.result && (
          <div className="space-y-4" onFocus={handleFirstInteraction}>
            <Field form={kunde} name="vorname">
              <Bound form={kunde} name="vorname" />
            </Field>
            <Field form={kunde} name="nachname">
              <Bound form={kunde} name="nachname" />
            </Field>
            <Field form={kunde} name="telefon">
              <Bound form={kunde} name="telefon" />
            </Field>
            <Field form={kunde} name="email">
              <Bound form={kunde} name="email" />
            </Field>
            <StepNav
              onNext={() => kunde.validate(['vorname', 'nachname'])}
              nextStepLabel={tx('Fahrzeugdaten')}
              hideBack
            />
          </div>
        )}

        {/* Schritt 2 — Fahrzeugdaten */}
        {step === 2 && !submit.result && (
          <div className="space-y-4">
            <Field form={fahrzeug} name="kennzeichen">
              <Bound form={fahrzeug} name="kennzeichen" />
            </Field>
            <Field form={fahrzeug} name="marke">
              <Bound form={fahrzeug} name="marke" />
            </Field>
            <Field form={fahrzeug} name="modell">
              <Bound form={fahrzeug} name="modell" />
            </Field>
            <Field form={fahrzeug} name="kilometerstand" label={tx('Kilometerstand (km)')}>
              <Bound form={fahrzeug} name="kilometerstand" label={tx('Kilometerstand (km)')} />
            </Field>
            <Field form={fahrzeug} name="hu_faellig" label={tx('HU fällig am')}>
              <Bound form={fahrzeug} name="hu_faellig" label={tx('HU fällig am')} />
            </Field>
            <StepNav
              onNext={() => fahrzeug.validate(['kennzeichen', 'marke', 'modell'])}
              nextStepLabel={tx('Anliegen & Termin')}
            />
          </div>
        )}

        {/* Schritt 3 — Anliegen & Wunschtermin */}
        {step === 3 && !submit.result && (
          <div className="space-y-4">
            <Field form={auftrag} name="kundenwunsch" label={tx('Ihr Anliegen / Kundenwunsch')}>
              <Bound form={auftrag} name="kundenwunsch" label={tx('Ihr Anliegen / Kundenwunsch')} rows={4} />
            </Field>
            <Field form={auftrag} name="fertigstellungstermin" label={tx('Wunschtermin')}>
              <Bound form={auftrag} name="fertigstellungstermin" label={tx('Wunschtermin')} />
            </Field>
            <StepNav
              onNext={() => true}
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        )}

        {/* Schritt 4 — Zusammenfassung */}
        {step === 4 && !submit.result && (
          <SummaryStep
            forms={[kunde, fahrzeug, auftrag]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen Ihre Anfrage und melden uns so schnell wie möglich bei Ihnen.')}
            confirmLabel={tx('Reparaturanfrage absenden')}
          />
        )}

        {/* Erfolg */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[kunde, fahrzeug, auftrag]}
            whatHappensNext={tx('Wir haben Ihre Reparaturanfrage erhalten und melden uns in Kürze.')}
            submit={submit}
            restartLabel={tx('Neue Anfrage stellen')}
            next={[{ label: tx('Neue Anfrage stellen'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
