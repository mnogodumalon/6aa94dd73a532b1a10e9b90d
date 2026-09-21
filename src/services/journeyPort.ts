/**
 * The INTERNAL door of the journey port — authenticated, via LivingAppsService.
 * GENERATED: one lister and one creator per entity. Do not edit.
 *
 *   import { servicePort } from '@/services/journeyPort';
 *
 * Intent pages hand this to `useJourneySubmit` and to shared step blocks. It
 * exposes only list · create · ref — the public subset — so a step written
 * against it also runs on a public page. Undo, edit and delete stay on the
 * page itself (LivingAppsService), never inside a shared step.
 */
import { LivingAppsService, createRecordUrl, type RecordQuery } from '@/services/livingAppsService';
import { toWirePayload, type InternalJourneyPort, type JourneyRecord } from '@/lib/journey/port';
import { buildSearchFilter, byIdFilter, combineFilters } from '@/lib/journey/search';
import type { EntityKey } from '@/lib/journey/rules';

type RawRecord = { record_id: string; fields: Record<string, unknown>; createdat?: string | null };
type RawMutation = { record_id: string; fields?: Record<string, unknown>; created_at?: string | null };

const listers: Record<EntityKey, () => Promise<RawRecord[]>> = {
  'kunden': () => LivingAppsService.getKunden() as Promise<RawRecord[]>,
  'mitarbeiter': () => LivingAppsService.getMitarbeiter() as Promise<RawRecord[]>,
  'teilebestand': () => LivingAppsService.getTeilebestand() as Promise<RawRecord[]>,
  'fahrzeuge': () => LivingAppsService.getFahrzeuge() as Promise<RawRecord[]>,
  'auftraege': () => LivingAppsService.getAuftraege() as Promise<RawRecord[]>,
  'auftragspositionen': () => LivingAppsService.getAuftragspositionen() as Promise<RawRecord[]>,
  'rechnungen': () => LivingAppsService.getRechnungen() as Promise<RawRecord[]>,
};

/** The query/count half — the REST parameters the plain listers never send. */
const queriers: Record<EntityKey, (q: RecordQuery) => Promise<RawRecord[]>> = {
  'kunden': q => LivingAppsService.queryKunden(q) as Promise<RawRecord[]>,
  'mitarbeiter': q => LivingAppsService.queryMitarbeiter(q) as Promise<RawRecord[]>,
  'teilebestand': q => LivingAppsService.queryTeilebestand(q) as Promise<RawRecord[]>,
  'fahrzeuge': q => LivingAppsService.queryFahrzeuge(q) as Promise<RawRecord[]>,
  'auftraege': q => LivingAppsService.queryAuftraege(q) as Promise<RawRecord[]>,
  'auftragspositionen': q => LivingAppsService.queryAuftragspositionen(q) as Promise<RawRecord[]>,
  'rechnungen': q => LivingAppsService.queryRechnungen(q) as Promise<RawRecord[]>,
};

const counters: Record<EntityKey, (filter?: string, signal?: AbortSignal) => Promise<number>> = {
  'kunden': (filter, signal) => LivingAppsService.countKunden(filter, signal),
  'mitarbeiter': (filter, signal) => LivingAppsService.countMitarbeiter(filter, signal),
  'teilebestand': (filter, signal) => LivingAppsService.countTeilebestand(filter, signal),
  'fahrzeuge': (filter, signal) => LivingAppsService.countFahrzeuge(filter, signal),
  'auftraege': (filter, signal) => LivingAppsService.countAuftraege(filter, signal),
  'auftragspositionen': (filter, signal) => LivingAppsService.countAuftragspositionen(filter, signal),
  'rechnungen': (filter, signal) => LivingAppsService.countRechnungen(filter, signal),
};

const creators: Record<EntityKey, (fields: Record<string, unknown>) => Promise<RawMutation>> = {
  'kunden': fields => LivingAppsService.createKundenEntry(fields as never),
  'mitarbeiter': fields => LivingAppsService.createMitarbeiterEntry(fields as never),
  'teilebestand': fields => LivingAppsService.createTeilebestandEntry(fields as never),
  'fahrzeuge': fields => LivingAppsService.createFahrzeugeEntry(fields as never),
  'auftraege': fields => LivingAppsService.createAuftraegeEntry(fields as never),
  'auftragspositionen': fields => LivingAppsService.createAuftragspositionenEntry(fields as never),
  'rechnungen': fields => LivingAppsService.createRechnungenEntry(fields as never),
};

const updaters: Record<EntityKey, (id: string, fields: Record<string, unknown>) => Promise<RawMutation>> = {
  'kunden': (id, fields) => LivingAppsService.updateKundenEntry(id, fields as never),
  'mitarbeiter': (id, fields) => LivingAppsService.updateMitarbeiterEntry(id, fields as never),
  'teilebestand': (id, fields) => LivingAppsService.updateTeilebestandEntry(id, fields as never),
  'fahrzeuge': (id, fields) => LivingAppsService.updateFahrzeugeEntry(id, fields as never),
  'auftraege': (id, fields) => LivingAppsService.updateAuftraegeEntry(id, fields as never),
  'auftragspositionen': (id, fields) => LivingAppsService.updateAuftragspositionenEntry(id, fields as never),
  'rechnungen': (id, fields) => LivingAppsService.updateRechnungenEntry(id, fields as never),
};

function toJourneyRecord(r: RawRecord): JourneyRecord {
  return { id: r.record_id, fields: r.fields ?? {}, createdAt: r.createdat ?? null };
}

export const servicePort: InternalJourneyPort = {
  door: 'internal',
  async list(entity, opts) {
    // Only a bare list(entity) (or an empty options object) takes the historic
    // load-everything path. ANY explicit option — `limit` included — goes to the
    // server: useRecordSearch's first page of a big entity must not pull the
    // whole table (live 2026-09-02: all 263 employees travelled for a limit-50
    // first page because `limit` alone did not count as a query).
    const usesQuery = !!opts && (opts.search !== undefined || opts.offset !== undefined
      || opts.orderby !== undefined || opts.fields !== undefined || opts.signal !== undefined
      || opts.limit !== undefined || opts.filter !== undefined);
    if (!usesQuery) {
      const rows = await listers[entity]();
      const limited = opts?.limit ? rows.slice(0, opts.limit) : rows;
      return limited.map(toJourneyRecord);
    }
    const filter = combineFilters(opts.filter, opts.search ? buildSearchFilter(opts.search.query, opts.search.fields) : undefined);
    const rows = await queriers[entity]({
      filter, orderby: opts.orderby, limit: opts.limit, offset: opts.offset, fields: opts.fields, signal: opts.signal,
    });
    return rows.map(toJourneyRecord);
  },
  async count(entity, opts) {
    const filter = combineFilters(opts?.filter, opts?.search ? buildSearchFilter(opts.search.query, opts.search.fields) : undefined);
    return counters[entity](filter, opts?.signal);
  },
  async get(entity, id) {
    // One query on the server, not the whole table: `r.id` is the vSQL name
    // of the record id (a live page wrote `r.record_id` and got a 400).
    const rows = await queriers[entity]({ filter: byIdFilter(id), limit: 1 });
    return rows[0] ? toJourneyRecord(rows[0]) : null;
  },
  async create(entity, values) {
    const r = await creators[entity](toWirePayload(entity, values, servicePort));
    return { id: r.record_id, fields: r.fields ?? {}, createdAt: r.created_at ?? null };
  },
  // The same payload rules as create — plain ids in, references shaped here.
  async update(entity, id, values) {
    const r = await updaters[entity](id, toWirePayload(entity, values, servicePort));
    return { id: r.record_id || id, fields: r.fields ?? {}, createdAt: r.created_at ?? null };
  },
  ref: (appId, recordId) => createRecordUrl(appId, recordId),
};
