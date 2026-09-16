/**
 * Auftrag abrechnen — 4-Schritt-Wizard.
 * Steps: 1) Fertigen Auftrag wählen → 2) Rechnungsdaten erfassen → 3) Prüfen & anlegen → Erfolg.
 * Reads: auftraege (filter: fertig), fahrzeuge (halter-Kette), kunden, rechnungen (für Nummerngenerierung).
 * Writes: auftraege (status → abgerechnet), rechnungen (create).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep,
 *           Bound, Field, ChoiceGroup, DatePicker.
 */
import { useState, useEffect } from 'react';
import { addDays, format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { DatePicker } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldText,
  fieldLookup,
  fieldRef,
  fieldNumber,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

function nextRechnungsnummer(existing: string[]): string {
  const year = format(new Date(), 'yyyy');
  const pattern = new RegExp(`^R-${year}-(\\d+)$`);
  let max = 0;
  for (const n of existing) {
    const m = pattern.exec(n);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > max) max = num;
    }
  }
  const next = String(max + 1).padStart(3, '0');
  return `R-${year}-${next}`;
}

export default function AuftragAbrechnungPage() {
  const [step, setStep] = useState(1);
  const [kundeId, setKundeId] = useState<string | null>(null);
  const [kundeLabel, setKundeLabel] = useState<string | undefined>(undefined);
  const [nettobetragVorschlag, setNettobetragVorschlag] = useState<number | null>(null);

  const auftraege = useRecordSearch(servicePort, 'auftraege', {
    filter: "r.v_status == 'fertig'", /* i18n-exempt */
    where: r => fieldLookup(r, 'status')?.key === 'fertig',
    searchFields: ['auftragsnummer'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'auftragsnummer'),
      subtitle: fieldLookup(a, 'status')?.label ?? '',
      status: fieldLookup(a, 'status') ?? undefined,
    }),
  });

  const kunden = useRecordSearch(servicePort, 'kunden', {
    searchFields: ['vorname', 'nachname'],
    toItem: k => ({
      id: k.id,
      title: `${fieldText(k, 'vorname')} ${fieldText(k, 'nachname')}`.trim(),
      subtitle: fieldText(k, 'email'),
    }),
  });

  const auftragForm = useStepForm('auftraege', {
    fields: ['status'],
    steps: { status: 1 },
  });

  const today = todayIso();
  const faelligkeitDefault = format(addDays(new Date(), 14), 'yyyy-MM-dd');

  const rechnungForm = useStepForm('rechnungen', {
    steps: {
      rechnungsnummer: 2,
      kunde: 2,
      rechnungsdatum: 2,
      faelligkeit: 2,
      nettobetrag: 2,
      mwst: 2,
      bruttobetrag: 2,
      status: 2,
    },
    initial: {
      rechnungsdatum: today,
      faelligkeit: faelligkeitDefault,
      mwst: 19,
      status: 'offen',
    },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'statusUpdate',
      entity: 'auftraege',
      updates: auftragForm.get('_auftragId') as string,
      values: { status: 'abgerechnet' },
      label: tx('Auftrag als abgerechnet markieren'),
    },
    {
      key: 'rechnung',
      entity: 'rechnungen',
      form: rechnungForm,
      values: () => ({
        auftrag: auftragForm.get('_auftragId') as string,
      }),
      primary: true,
      label: tx('Rechnung anlegen'),
    },
  ], { draftKey: 'auftrag-abrechnen' });

  // Lade Rechnungsnummern und berechne die nächste
  useEffect(() => {
    servicePort.list('rechnungen', { fields: ['rechnungsnummer'] }).then(recs => {
      const nummern = recs.map(r => fieldText(r, 'rechnungsnummer')).filter(Boolean);
      const next = nextRechnungsnummer(nummern);
      if (!rechnungForm.get('rechnungsnummer')) {
        rechnungForm.set('rechnungsnummer', next);
      }
    }).catch(() => {/* noop */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bruttobetrag berechnen wenn netto oder mwst sich ändern
  const netto = parseFloat(String(rechnungForm.get('nettobetrag') ?? ''));
  const mwst = parseFloat(String(rechnungForm.get('mwst') ?? ''));
  useEffect(() => {
    if (!isNaN(netto) && !isNaN(mwst)) {
      const brutto = netto * (1 + mwst / 100);
      rechnungForm.set('bruttobetrag', Math.round(brutto * 100) / 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netto, mwst]);

  // Vorausfüllen: Kunde aus Fahrzeug→Halter-Kette + Nettobetrag aus Positionen
  const handleAuftragSelect = async (id: string) => {
    const auftrag = auftraege.recordOf(id);
    auftragForm.set('_auftragId', id);
    // Kunde via fahrzeug → halter
    const fahrzeugId = auftrag ? fieldRef(auftrag, 'fahrzeug') : null;
    if (fahrzeugId) {
      const fahrzeug = await servicePort.get('fahrzeuge', fahrzeugId);
      if (fahrzeug) {
        const halterId = fieldRef(fahrzeug, 'halter');
        if (halterId) {
          setKundeId(halterId);
          const kundeRec = await servicePort.get('kunden', halterId);
          if (kundeRec) {
            const label = `${fieldText(kundeRec, 'vorname')} ${fieldText(kundeRec, 'nachname')}`.trim();
            setKundeLabel(label);
            rechnungForm.set('kunde', halterId, label);
          }
        }
      }
    }
    // Nettobetrag aus Positionen
    const positionen = await servicePort.list('auftragspositionen', {
      filter: tx`'${id}' in str(r.v_auftrag)`,
    });
    let summe = 0;
    for (const pos of positionen) {
      const menge = fieldNumber(pos, 'menge') ?? 0;
      const einzelpreis = fieldNumber(pos, 'einzelpreis') ?? 0;
      summe += menge * einzelpreis;
    }
    setNettobetragVorschlag(summe);
    rechnungForm.set('nettobetrag', Math.round(summe * 100) / 100);
    setStep(2);
  };

  const auftragId = auftragForm.get('_auftragId') as string | undefined;
  const selectedAuftragLabel = auftragId ? auftraege.labelOf(auftragId) : undefined;

  const restart = () => {
    submit.reset();
    auftragForm.reset();
    rechnungForm.reset({
      rechnungsdatum: todayIso(),
      faelligkeit: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
      mwst: 19,
      status: 'offen',
    });
    setKundeId(null);
    setKundeLabel(undefined);
    setNettobetragVorschlag(null);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Auftrag abrechnen')}
      subtitle={tx('Status auf „Abgerechnet" setzen und Rechnung anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[rechnungForm]}
      draftKey="auftrag-abrechnen"
      intro={{
        description: tx('Einen fertigen Auftrag abschließen und die Rechnung für den Kunden erstellen.'),
        needs: [tx('Auftragsnummer des fertigen Auftrags')],
      }}
    >
      <WizardStep
        label={tx('Auftrag')}
        description={tx('Einen fertigen Auftrag für die Abrechnung auswählen.')}
      >
        <EntitySelectStep
          {...auftraege.select}
          selectedId={auftragId ?? null}
          onSelect={handleAuftragSelect}
          emptyText={tx('Keine Aufträge mit Status „Fertig" gefunden.')}
          searchPlaceholder={tx('Auftragsnummer suchen …')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep
        label={tx('Rechnungsdaten')}
        description={tx('Rechnungsnummer, Kunde und Beträge prüfen und anpassen.')}
        needs={['_auftragId']}
      >
        {auftragId ? (
          <div className="space-y-5">
            {selectedAuftragLabel && (
              <p className="text-sm text-muted-foreground">
                {tx('Auftrag')}: <span className="font-medium text-foreground">{selectedAuftragLabel}</span>
              </p>
            )}

            <Field form={rechnungForm} name="rechnungsnummer">
              <Input {...rechnungForm.field('rechnungsnummer')} />
            </Field>

            {/* Kunde: vorausgefüllt aus Halter-Kette, aber änderbar */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{tx('Kunde')}</p>
              {kundeLabel && (
                <p className="text-sm text-muted-foreground mb-1">
                  {tx('Vorausgefüllt aus Fahrzeughalter')}: <span className="font-medium text-foreground">{kundeLabel}</span>
                </p>
              )}
              <EntitySelectStep
                {...kunden.select}
                selectedId={rechnungForm.get('kunde') as string | null}
                onSelect={id => {
                  rechnungForm.set('kunde', id, kunden.labelOf(id));
                  setKundeId(id);
                  setKundeLabel(kunden.labelOf(id));
                }}
                avatar="initials"
                searchPlaceholder={tx('Kunde suchen …')}
                columns={2}
              />
            </div>

            <Field form={rechnungForm} name="rechnungsdatum">
              <DatePicker {...rechnungForm.date('rechnungsdatum')} />
            </Field>

            <Field form={rechnungForm} name="faelligkeit">
              <DatePicker {...rechnungForm.date('faelligkeit')} />
            </Field>

            <Field
              form={rechnungForm}
              name="nettobetrag"
              hint={nettobetragVorschlag !== null
                ? tx('Summe aus Auftragspositionen') + `: ${nettobetragVorschlag.toFixed(2)} €`
                : undefined}
            >
              <Input {...rechnungForm.number('nettobetrag')} />
            </Field>

            <Field form={rechnungForm} name="mwst" hint={tx('Prozent, z. B. 19')}>
              <Input {...rechnungForm.number('mwst')} />
            </Field>

            <Field form={rechnungForm} name="bruttobetrag" hint={tx('Wird automatisch berechnet')}>
              <Input {...rechnungForm.number('bruttobetrag')} readOnly />
            </Field>

            <Field form={rechnungForm} name="status">
              <ChoiceGroup {...rechnungForm.choice('status')} />
            </Field>

            <StepNav
              onBack={() => setStep(1)}
              onNext={() => rechnungForm.validate(['rechnungsnummer', 'kunde', 'rechnungsdatum', 'nettobetrag', 'mwst', 'bruttobetrag', 'status'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst einen Auftrag auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done ? (
          <SummaryStep
            forms={[rechnungForm]}
            submit={submit}
            items={[
              { key: '_auftrag', label: tx('Auftrag'), value: selectedAuftragLabel ?? '—', step: 1 },
            ]}
            whatHappensNext={tx('Der Auftrag wird auf „Abgerechnet" gesetzt und eine Rechnung angelegt.')}
            confirmLabel={tx('Jetzt abrechnen')}
          />
        ) : null}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[rechnungForm]}
          next={[
            { label: tx('Weiteren Auftrag abrechnen'), onClick: restart },
            { label: tx('Neuen Auftrag anlegen'), href: '#/intents/auftrag-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Rechnung ist gespeichert. Du kannst jetzt einen weiteren Auftrag abrechnen oder einen neuen anlegen.')}
          submit={submit}
          restartLabel={tx('Weiteren Auftrag abrechnen')}
        />
      )}
    </IntentWizardShell>
  );
}
