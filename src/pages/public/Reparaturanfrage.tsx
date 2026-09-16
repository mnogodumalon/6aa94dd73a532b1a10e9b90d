import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import {
  useStepForm,
  useJourneySubmit,
  todayIso,
} from '@/lib/journey';
import { tx } from '@/i18n';

// Auftragsnummer: AU-YYYY-MM-DD-NNN
async function generateAuftragsnummer(
  port: ReturnType<typeof createPublicPort>,
): Promise<string> {
  const today = todayIso(); // yyyy-MM-dd
  try {
    const records = await port.list('auftraege', { fields: ['auftragsnummer'] });
    const idx = (records.length + 1).toString().padStart(3, '0');
    return `AU-${today}-${idx}`;
  } catch {
    return `AU-${today}-001`;
  }
}

export default function Reparaturanfrage() {
  const STEPS = [
  { label: tx('Kontaktdaten'), key: 'kontakt' },
  { label: tx('Fahrzeugdaten'), key: 'fahrzeug' },
  { label: tx('Anfrage'), key: 'anfrage' },
  { label: tx('Prüfen'), key: 'pruefen' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig('reparaturanfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['reparaturanfrage'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  // --- Formular: Kontaktdaten (Kunden) ---
  const kunde = useStepForm('kunden', {
    fields: ['vorname', 'nachname', 'kundentyp', 'telefon', 'email'],
    required: {
      vorname: true,
      nachname: true,
      kundentyp: true,
      telefon: false,
      email: false,
    },
    steps: {
      vorname: 1,
      nachname: 1,
      kundentyp: 1,
      telefon: 1,
      email: 1,
    },
    initial: { kundentyp: 'privat' },
    autoComplete: true,
  });

  // --- Formular: Fahrzeugdaten (Fahrzeuge) ---
  const fahrzeug = useStepForm('fahrzeuge', {
    fields: ['kennzeichen', 'marke', 'modell', 'kilometerstand', 'hu_faellig'],
    required: {
      kennzeichen: true,
      marke: true,
      modell: true,
      kilometerstand: false,
      hu_faellig: false,
    },
    steps: {
      kennzeichen: 2,
      marke: 2,
      modell: 2,
      kilometerstand: 2,
      hu_faellig: 2,
    },
    autoComplete: true,
  });

  // --- Formular: Anfrage (Auftraege) ---
  const auftrag = useStepForm('auftraege', {
    fields: ['auftragsnummer', 'annahmedatum', 'kundenwunsch', 'fertigstellungstermin'],
    required: {
      kundenwunsch: true,
      fertigstellungstermin: false,
      auftragsnummer: true,
      annahmedatum: true,
    },
    steps: {
      kundenwunsch: 3,
      fertigstellungstermin: 3,
      auftragsnummer: 3,
      annahmedatum: 3,
    },
    initial: { annahmedatum: todayIso() },
    autoComplete: true,
  });

  // --- Plan: Kunden → Fahrzeuge (halter → Kunden) → Auftraege (fahrzeug → Fahrzeuge) ---
  const submit = useJourneySubmit(
    // port is null until config is loaded; useJourneySubmit tolerates this
    // because it only runs on submit (after config is guaranteed loaded)
    port ?? ({} as ReturnType<typeof createPublicPort>),
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
    { draftKey: 'reparaturanfrage' },
  );

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  // Prepare Auftragsnummer when moving from step 2 → 3
  const handleStep2Next = async () => {
    const valid = fahrzeug.validate(['kennzeichen', 'marke', 'modell']);
    if (!valid) return false;
    // Pre-fill auftragsnummer if not yet set
    if (!auftrag.get('auftragsnummer')) {
      const nr = await generateAuftragsnummer(port);
      auftrag.set('auftragsnummer', nr);
    }
    return true;
  };

  const restart = () => {
    submit.reset();
    kunde.reset();
    fahrzeug.reset({ /* keep nothing */ });
    auftrag.reset();
    setStep(1);
  };

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
        draftKey="reparaturanfrage"
      >
        {/* Schritt 1: Kontaktdaten */}
        {step === 1 && (
          <div className="space-y-4">
            <Field form={kunde} name="vorname">
              <input
                {...kunde.field('vorname')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <Field form={kunde} name="nachname">
              <input
                {...kunde.field('nachname')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <Field form={kunde} name="kundentyp">
              <ChoiceGroup {...kunde.choice('kundentyp')} />
            </Field>
            <Field form={kunde} name="telefon">
              <input
                {...kunde.field('telefon')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <Field form={kunde} name="email" label={tx('E-Mail')}>
              <input
                {...kunde.field('email')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <StepNav
              onNext={() => kunde.validate(['vorname', 'nachname', 'kundentyp'])}
              nextStepLabel={tx('Fahrzeugdaten')}
              hideBack
            />
          </div>
        )}

        {/* Schritt 2: Fahrzeugdaten */}
        {step === 2 && (
          <div className="space-y-4">
            <Field form={fahrzeug} name="kennzeichen">
              <input
                {...fahrzeug.field('kennzeichen')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <Field form={fahrzeug} name="marke">
              <input
                {...fahrzeug.field('marke')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <Field form={fahrzeug} name="modell">
              <input
                {...fahrzeug.field('modell')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
            <Bound form={fahrzeug} name="kilometerstand" label={tx('Kilometerstand (km)')} />
            <Bound form={fahrzeug} name="hu_faellig" label={tx('HU fällig am')} />
            <StepNav
              onNext={handleStep2Next}
              nextStepLabel={tx('Anfrage')}
            />
          </div>
        )}

        {/* Schritt 3: Anfrage */}
        {step === 3 && (
          <div className="space-y-4">
            <Bound form={auftrag} name="kundenwunsch" label={tx('Problembeschreibung / Kundenwunsch')} rows={5} />
            <Bound form={auftrag} name="fertigstellungstermin" label={tx('Wunschtermin')} />
            <StepNav
              onNext={() => auftrag.validate(['kundenwunsch'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}

        {/* Schritt 4: Zusammenfassung & Absenden */}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[kunde, fahrzeug, auftrag]}
            submit={submit}
            whatHappensNext={tx('Wir melden uns schnellstmöglich bei Ihnen, um einen Termin zu vereinbaren.')}
            confirmLabel={tx('Anfrage absenden')}
          />
        )}
        {step === 4 && submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[kunde, fahrzeug, auftrag]}
            whatHappensNext={tx('Wir melden uns schnellstmöglich bei Ihnen, um einen Werkstatttermin zu vereinbaren.')}
            next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
