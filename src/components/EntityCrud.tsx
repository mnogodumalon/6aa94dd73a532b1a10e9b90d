/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'kunden'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.kunden.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.kunden.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.kunden.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.kunden              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   kunden: vorname, nachname, kundentyp, telefon, email, strasse, hausnummer, plz, …  ·  ← fahrzeuge (list + contextual +) · ← rechnungen (list + contextual +)
 *   mitarbeiter: email, vorname, nachname, rolle, stundensatz, status  ·  ← auftraege (list + contextual +) · ← auftragspositionen (list + contextual +)
 *   teilebestand: artikelnummer, bezeichnung, hersteller, einkaufspreis, verkaufspreis, bestand, mindestbestand, lagerplatz  ·  ← auftragspositionen (list + contextual +)
 *   fahrzeuge: kennzeichen, marke, modell, erstzulassung, kilometerstand, fahrgestellnummer, hu_faellig, halter  ·  → kunden · ← auftraege (list + contextual +)
 *   auftraege: auftragsnummer, fahrzeug, annahmedatum, fertigstellungstermin, kundenwunsch, status, mechaniker, kilometerstand_annahme, …  ·  → fahrzeuge · → mitarbeiter · ← auftragspositionen (list + contextual +) · ← rechnungen (list + contextual +)
 *   auftragspositionen: auftrag, positionstyp, bezeichnung, menge, einzelpreis, mechaniker, dauer_stunden, teil  ·  → auftraege · → mitarbeiter · → teilebestand
 *   rechnungen: rechnungsnummer, auftrag, kunde, rechnungsdatum, faelligkeit, nettobetrag, mwst, bruttobetrag, …  ·  → auftraege · → kunden
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Kunden, Mitarbeiter, Teilebestand, Fahrzeuge, Auftraege, Auftragspositionen, Rechnungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichFahrzeuge, enrichAuftraege, enrichAuftragspositionen, enrichRechnungen } from '@/lib/enrich';
import type { EnrichedFahrzeuge, EnrichedAuftraege, EnrichedAuftragspositionen, EnrichedRechnungen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { KundenDialog, type KundenDialogDefaults } from '@/components/dialogs/KundenDialog';
import { KundenDetails } from '@/components/details/KundenDetails';
import { MitarbeiterDialog, type MitarbeiterDialogDefaults } from '@/components/dialogs/MitarbeiterDialog';
import { MitarbeiterDetails } from '@/components/details/MitarbeiterDetails';
import { TeilebestandDialog, type TeilebestandDialogDefaults } from '@/components/dialogs/TeilebestandDialog';
import { TeilebestandDetails } from '@/components/details/TeilebestandDetails';
import { FahrzeugeDialog, type FahrzeugeDialogDefaults } from '@/components/dialogs/FahrzeugeDialog';
import { FahrzeugeDetails } from '@/components/details/FahrzeugeDetails';
import { AuftraegeDialog, type AuftraegeDialogDefaults } from '@/components/dialogs/AuftraegeDialog';
import { AuftraegeDetails } from '@/components/details/AuftraegeDetails';
import { AuftragspositionenDialog, type AuftragspositionenDialogDefaults } from '@/components/dialogs/AuftragspositionenDialog';
import { AuftragspositionenDetails } from '@/components/details/AuftragspositionenDetails';
import { RechnungenDialog, type RechnungenDialogDefaults } from '@/components/dialogs/RechnungenDialog';
import { RechnungenDetails } from '@/components/details/RechnungenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'kunden'; record: Kunden }
  | { type: 'mitarbeiter'; record: Mitarbeiter }
  | { type: 'teilebestand'; record: Teilebestand }
  | { type: 'fahrzeuge'; record: EnrichedFahrzeuge }
  | { type: 'auftraege'; record: EnrichedAuftraege }
  | { type: 'auftragspositionen'; record: EnrichedAuftragspositionen }
  | { type: 'rechnungen'; record: EnrichedRechnungen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  kunden: EntityCrudApi<Kunden, KundenDialogDefaults>;
  mitarbeiter: EntityCrudApi<Mitarbeiter, MitarbeiterDialogDefaults>;
  teilebestand: EntityCrudApi<Teilebestand, TeilebestandDialogDefaults>;
  fahrzeuge: EntityCrudApi<Fahrzeuge, FahrzeugeDialogDefaults>;
  auftraege: EntityCrudApi<Auftraege, AuftraegeDialogDefaults>;
  auftragspositionen: EntityCrudApi<Auftragspositionen, AuftragspositionenDialogDefaults>;
  rechnungen: EntityCrudApi<Rechnungen, RechnungenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { kunden: Kunden[]; mitarbeiter: Mitarbeiter[]; teilebestand: Teilebestand[]; fahrzeuge: EnrichedFahrzeuge[]; auftraege: EnrichedAuftraege[]; auftragspositionen: EnrichedAuftragspositionen[]; rechnungen: EnrichedRechnungen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [kundenDialog, setKundenDialog] = useState<{ defaults?: KundenDialogDefaults; editing?: Kunden } | null>(null);
  const [mitarbeiterDialog, setMitarbeiterDialog] = useState<{ defaults?: MitarbeiterDialogDefaults; editing?: Mitarbeiter } | null>(null);
  const [teilebestandDialog, setTeilebestandDialog] = useState<{ defaults?: TeilebestandDialogDefaults; editing?: Teilebestand } | null>(null);
  const [fahrzeugeDialog, setFahrzeugeDialog] = useState<{ defaults?: FahrzeugeDialogDefaults; editing?: Fahrzeuge } | null>(null);
  const [auftraegeDialog, setAuftraegeDialog] = useState<{ defaults?: AuftraegeDialogDefaults; editing?: Auftraege } | null>(null);
  const [auftragspositionenDialog, setAuftragspositionenDialog] = useState<{ defaults?: AuftragspositionenDialogDefaults; editing?: Auftragspositionen } | null>(null);
  const [rechnungenDialog, setRechnungenDialog] = useState<{ defaults?: RechnungenDialogDefaults; editing?: Rechnungen } | null>(null);
  const enrichedFahrzeuge = useMemo(() => enrichFahrzeuge(data.fahrzeuge, { kundenMap: data.kundenMap }), [data.fahrzeuge, data.kundenMap]);
  const enrichedAuftraege = useMemo(() => enrichAuftraege(data.auftraege, { fahrzeugeMap: data.fahrzeugeMap, mitarbeiterMap: data.mitarbeiterMap }), [data.auftraege, data.fahrzeugeMap, data.mitarbeiterMap]);
  const enrichedAuftragspositionen = useMemo(() => enrichAuftragspositionen(data.auftragspositionen, { auftraegeMap: data.auftraegeMap, mitarbeiterMap: data.mitarbeiterMap, teilebestandMap: data.teilebestandMap }), [data.auftragspositionen, data.auftraegeMap, data.mitarbeiterMap, data.teilebestandMap]);
  const enrichedRechnungen = useMemo(() => enrichRechnungen(data.rechnungen, { auftraegeMap: data.auftraegeMap, kundenMap: data.kundenMap }), [data.rechnungen, data.auftraegeMap, data.kundenMap]);

  function detailKunden(record: Kunden, push = false) {
    const item: OverlayItem = { type: 'kunden', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitKunden(fields: Kunden['fields']) {
    const editing = kundenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setKunden(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateKundenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('kunden')} — ${t('crud_updated')}`, async () => {
        data.setKunden(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateKundenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createKundenEntry(fields);
      undoToast(`${appLabel('kunden')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailMitarbeiter(record: Mitarbeiter, push = false) {
    const item: OverlayItem = { type: 'mitarbeiter', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitMitarbeiter(fields: Mitarbeiter['fields']) {
    const editing = mitarbeiterDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setMitarbeiter(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateMitarbeiterEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('mitarbeiter')} — ${t('crud_updated')}`, async () => {
        data.setMitarbeiter(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateMitarbeiterEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createMitarbeiterEntry(fields);
      undoToast(`${appLabel('mitarbeiter')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTeilebestand(record: Teilebestand, push = false) {
    const item: OverlayItem = { type: 'teilebestand', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTeilebestand(fields: Teilebestand['fields']) {
    const editing = teilebestandDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTeilebestand(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTeilebestandEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('teilebestand')} — ${t('crud_updated')}`, async () => {
        data.setTeilebestand(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTeilebestandEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTeilebestandEntry(fields);
      undoToast(`${appLabel('teilebestand')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailFahrzeuge(record: Fahrzeuge, push = false) {
    const rec = enrichedFahrzeuge.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'fahrzeuge', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitFahrzeuge(fields: Fahrzeuge['fields']) {
    const editing = fahrzeugeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setFahrzeuge(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateFahrzeugeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('fahrzeuge')} — ${t('crud_updated')}`, async () => {
        data.setFahrzeuge(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateFahrzeugeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createFahrzeugeEntry(fields);
      undoToast(`${appLabel('fahrzeuge')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAuftraege(record: Auftraege, push = false) {
    const rec = enrichedAuftraege.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'auftraege', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAuftraege(fields: Auftraege['fields']) {
    const editing = auftraegeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAuftraege(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAuftraegeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('auftraege')} — ${t('crud_updated')}`, async () => {
        data.setAuftraege(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAuftraegeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAuftraegeEntry(fields);
      undoToast(`${appLabel('auftraege')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAuftragspositionen(record: Auftragspositionen, push = false) {
    const rec = enrichedAuftragspositionen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'auftragspositionen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAuftragspositionen(fields: Auftragspositionen['fields']) {
    const editing = auftragspositionenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAuftragspositionen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAuftragspositionenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('auftragspositionen')} — ${t('crud_updated')}`, async () => {
        data.setAuftragspositionen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAuftragspositionenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAuftragspositionenEntry(fields);
      undoToast(`${appLabel('auftragspositionen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailRechnungen(record: Rechnungen, push = false) {
    const rec = enrichedRechnungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'rechnungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitRechnungen(fields: Rechnungen['fields']) {
    const editing = rechnungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setRechnungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateRechnungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('rechnungen')} — ${t('crud_updated')}`, async () => {
        data.setRechnungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateRechnungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createRechnungenEntry(fields);
      undoToast(`${appLabel('rechnungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <KundenDialog
        open={kundenDialog !== null}
        onClose={() => setKundenDialog(null)}
        onSubmit={submitKunden}
        defaultValues={kundenDialog?.defaults}
        recordId={kundenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Kunden']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kunden']}
      />
      <MitarbeiterDialog
        open={mitarbeiterDialog !== null}
        onClose={() => setMitarbeiterDialog(null)}
        onSubmit={submitMitarbeiter}
        defaultValues={mitarbeiterDialog?.defaults}
        recordId={mitarbeiterDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Mitarbeiter']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitarbeiter']}
      />
      <TeilebestandDialog
        open={teilebestandDialog !== null}
        onClose={() => setTeilebestandDialog(null)}
        onSubmit={submitTeilebestand}
        defaultValues={teilebestandDialog?.defaults}
        recordId={teilebestandDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Teilebestand']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Teilebestand']}
      />
      <FahrzeugeDialog
        open={fahrzeugeDialog !== null}
        onClose={() => setFahrzeugeDialog(null)}
        onSubmit={submitFahrzeuge}
        defaultValues={fahrzeugeDialog?.defaults}
        recordId={fahrzeugeDialog?.editing?.record_id}
        kundenList={data.kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Fahrzeuge']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Fahrzeuge']}
      />
      <AuftraegeDialog
        open={auftraegeDialog !== null}
        onClose={() => setAuftraegeDialog(null)}
        onSubmit={submitAuftraege}
        defaultValues={auftraegeDialog?.defaults}
        recordId={auftraegeDialog?.editing?.record_id}
        fahrzeugeList={data.fahrzeuge}
        mitarbeiterList={data.mitarbeiter}
        enablePhotoScan={AI_PHOTO_SCAN['Auftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Auftraege']}
      />
      <AuftragspositionenDialog
        open={auftragspositionenDialog !== null}
        onClose={() => setAuftragspositionenDialog(null)}
        onSubmit={submitAuftragspositionen}
        defaultValues={auftragspositionenDialog?.defaults}
        recordId={auftragspositionenDialog?.editing?.record_id}
        auftraegeList={data.auftraege}
        mitarbeiterList={data.mitarbeiter}
        teilebestandList={data.teilebestand}
        enablePhotoScan={AI_PHOTO_SCAN['Auftragspositionen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Auftragspositionen']}
      />
      <RechnungenDialog
        open={rechnungenDialog !== null}
        onClose={() => setRechnungenDialog(null)}
        onSubmit={submitRechnungen}
        defaultValues={rechnungenDialog?.defaults}
        recordId={rechnungenDialog?.editing?.record_id}
        auftraegeList={data.auftraege}
        kundenList={data.kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'kunden') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('kunden')} subtitle={undefined} />
                <KundenDetails
                  record={top.record}
                  fahrzeugeList={data.fahrzeuge}
                  onOpenFahrzeuge={(r) => detailFahrzeuge(r, true)}
                  onAddFahrzeuge={() => setFahrzeugeDialog({ defaults: { halter: createRecordUrl(APP_IDS.KUNDEN, top.record.record_id) } })}
                  rechnungenList={data.rechnungen}
                  onOpenRechnungen={(r) => detailRechnungen(r, true)}
                  onAddRechnungen={() => setRechnungenDialog({ defaults: { kunde: createRecordUrl(APP_IDS.KUNDEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'mitarbeiter') {
            return (
              <>
                <RecordHeader title={top.record.fields.email ?? appLabel('mitarbeiter')} subtitle={undefined} />
                <MitarbeiterDetails
                  record={top.record}
                  auftraegeList={data.auftraege}
                  onOpenAuftraege={(r) => detailAuftraege(r, true)}
                  onAddAuftraege={() => setAuftraegeDialog({ defaults: { mechaniker: createRecordUrl(APP_IDS.MITARBEITER, top.record.record_id) } })}
                  auftragspositionenList={data.auftragspositionen}
                  onOpenAuftragspositionen={(r) => detailAuftragspositionen(r, true)}
                  onAddAuftragspositionen={() => setAuftragspositionenDialog({ defaults: { mechaniker: createRecordUrl(APP_IDS.MITARBEITER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'teilebestand') {
            return (
              <>
                <RecordHeader title={top.record.fields.artikelnummer ?? appLabel('teilebestand')} subtitle={undefined} />
                <TeilebestandDetails
                  record={top.record}
                  auftragspositionenList={data.auftragspositionen}
                  onOpenAuftragspositionen={(r) => detailAuftragspositionen(r, true)}
                  onAddAuftragspositionen={() => setAuftragspositionenDialog({ defaults: { teil: createRecordUrl(APP_IDS.TEILEBESTAND, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'fahrzeuge') {
            return (
              <>
                <RecordHeader title={top.record.fields.kennzeichen ?? appLabel('fahrzeuge')} subtitle={top.record.fields.erstzulassung ? formatDate(top.record.fields.erstzulassung) : undefined} />
                <FahrzeugeDetails
                  record={top.record}
                  kundenList={data.kunden}
                  onOpenKunden={(r) => detailKunden(r, true)}
                  auftraegeList={data.auftraege}
                  onOpenAuftraege={(r) => detailAuftraege(r, true)}
                  onAddAuftraege={() => setAuftraegeDialog({ defaults: { fahrzeug: createRecordUrl(APP_IDS.FAHRZEUGE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'auftraege') {
            return (
              <>
                <RecordHeader title={top.record.fields.auftragsnummer ?? appLabel('auftraege')} subtitle={top.record.fields.annahmedatum ? formatDate(top.record.fields.annahmedatum) : undefined} />
                <AuftraegeDetails
                  record={top.record}
                  fahrzeugeList={data.fahrzeuge}
                  onOpenFahrzeuge={(r) => detailFahrzeuge(r, true)}
                  mitarbeiterList={data.mitarbeiter}
                  onOpenMitarbeiter={(r) => detailMitarbeiter(r, true)}
                  auftragspositionenList={data.auftragspositionen}
                  onOpenAuftragspositionen={(r) => detailAuftragspositionen(r, true)}
                  onAddAuftragspositionen={() => setAuftragspositionenDialog({ defaults: { auftrag: createRecordUrl(APP_IDS.AUFTRAEGE, top.record.record_id) } })}
                  rechnungenList={data.rechnungen}
                  onOpenRechnungen={(r) => detailRechnungen(r, true)}
                  onAddRechnungen={() => setRechnungenDialog({ defaults: { auftrag: createRecordUrl(APP_IDS.AUFTRAEGE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'auftragspositionen') {
            return (
              <>
                <RecordHeader title={top.record.fields.bezeichnung ?? appLabel('auftragspositionen')} subtitle={undefined} />
                <AuftragspositionenDetails
                  record={top.record}
                  auftraegeList={data.auftraege}
                  onOpenAuftraege={(r) => detailAuftraege(r, true)}
                  mitarbeiterList={data.mitarbeiter}
                  onOpenMitarbeiter={(r) => detailMitarbeiter(r, true)}
                  teilebestandList={data.teilebestand}
                  onOpenTeilebestand={(r) => detailTeilebestand(r, true)}
                />
              </>
            );
          }
          if (top.type === 'rechnungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.rechnungsnummer ?? appLabel('rechnungen')} subtitle={top.record.fields.rechnungsdatum ? formatDate(top.record.fields.rechnungsdatum) : undefined} />
                <RechnungenDetails
                  record={top.record}
                  auftraegeList={data.auftraege}
                  onOpenAuftraege={(r) => detailAuftraege(r, true)}
                  kundenList={data.kunden}
                  onOpenKunden={(r) => detailKunden(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'kunden') setKundenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'mitarbeiter') setMitarbeiterDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'teilebestand') setTeilebestandDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'fahrzeuge') setFahrzeugeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'auftraege') setAuftraegeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'auftragspositionen') setAuftragspositionenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'rechnungen') setRechnungenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    kunden: {
      openCreate: (defaults?: KundenDialogDefaults) => setKundenDialog({ defaults }),
      openEdit: (record: Kunden) => setKundenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Kunden) => detailKunden(record, false),
    },
    mitarbeiter: {
      openCreate: (defaults?: MitarbeiterDialogDefaults) => setMitarbeiterDialog({ defaults }),
      openEdit: (record: Mitarbeiter) => setMitarbeiterDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Mitarbeiter) => detailMitarbeiter(record, false),
    },
    teilebestand: {
      openCreate: (defaults?: TeilebestandDialogDefaults) => setTeilebestandDialog({ defaults }),
      openEdit: (record: Teilebestand) => setTeilebestandDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Teilebestand) => detailTeilebestand(record, false),
    },
    fahrzeuge: {
      openCreate: (defaults?: FahrzeugeDialogDefaults) => setFahrzeugeDialog({ defaults }),
      openEdit: (record: Fahrzeuge) => setFahrzeugeDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Fahrzeuge) => detailFahrzeuge(record, false),
    },
    auftraege: {
      openCreate: (defaults?: AuftraegeDialogDefaults) => setAuftraegeDialog({ defaults }),
      openEdit: (record: Auftraege) => setAuftraegeDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Auftraege) => detailAuftraege(record, false),
    },
    auftragspositionen: {
      openCreate: (defaults?: AuftragspositionenDialogDefaults) => setAuftragspositionenDialog({ defaults }),
      openEdit: (record: Auftragspositionen) => setAuftragspositionenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Auftragspositionen) => detailAuftragspositionen(record, false),
    },
    rechnungen: {
      openCreate: (defaults?: RechnungenDialogDefaults) => setRechnungenDialog({ defaults }),
      openEdit: (record: Rechnungen) => setRechnungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Rechnungen) => detailRechnungen(record, false),
    },
    enriched: { kunden: data.kunden, mitarbeiter: data.mitarbeiter, teilebestand: data.teilebestand, fahrzeuge: enrichedFahrzeuge, auftraege: enrichedAuftraege, auftragspositionen: enrichedAuftragspositionen, rechnungen: enrichedRechnungen },
  };
}
