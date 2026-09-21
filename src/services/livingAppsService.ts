// AUTOMATICALLY GENERATED SERVICE
import { APP_IDS, LOOKUP_OPTIONS, FIELD_TYPES } from '@/types/app';
import { ensureUploadableImage } from '@/lib/ai';
import { REST_URL } from '@/lib/origin';
import type { Kunden, Mitarbeiter, Teilebestand, Fahrzeuge, Auftraege, Auftragspositionen, Rechnungen, CreateKunden, CreateMitarbeiter, CreateTeilebestand, CreateFahrzeuge, CreateAuftraege, CreateAuftragspositionen, CreateRechnungen } from '@/types/app';

// Base Configuration — the host is a RUNTIME fact (lib/origin.ts):
// a bundle copied to another LA instance must talk to THAT instance.
const API_BASE_URL = REST_URL;

// --- HELPER FUNCTIONS ---
export function extractRecordId(url: unknown): string | null {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  const match = url.match(/([a-f0-9]{24})$/i);
  return match ? match[1] : null;
}

// multipleapplookup form-state is Array<URL>. The MultiCombobox picker
// works on record-ids; this helper maps a raw form value (which may be
// undefined, null, a single URL string from a legacy single-Combobox
// render, or the expected URL array) to a clean string[] of ids.
export function extractRecordIds(urls: unknown): string[] {
  if (!urls) return [];
  const arr = Array.isArray(urls) ? urls : [urls];
  const out: string[] = [];
  for (const u of arr) {
    const id = extractRecordId(u);
    if (id) out.push(id);
  }
  return out;
}

export function createRecordUrl(appId: string, recordId: string): string {
  return `${API_BASE_URL}/apps/${appId}/records/${recordId}`;
}

export class LivingAppsApiError extends Error {
  status: number;
  type?: string;
  control_identifier?: string;
  control_type?: string;
  field_type?: string;
  detail?: string;
  constructor(message: string, status: number, raw?: Record<string, unknown>) {
    super(message);
    this.name = 'LivingAppsApiError';
    this.status = status;
    if (raw) {
      this.type = typeof raw.type === 'string' ? raw.type : undefined;
      this.control_identifier = typeof raw.control_identifier === 'string' ? raw.control_identifier : undefined;
      this.control_type = typeof raw.control_type === 'string' ? raw.control_type : undefined;
      this.field_type = typeof raw.field_type === 'string' ? raw.field_type : undefined;
      this.detail = typeof raw.detail === 'string' ? raw.detail : undefined;
    }
  }
}

async function parseErrorBody(response: Response): Promise<{ message: string; raw?: Record<string, unknown> }> {
  const text = await response.text();
  if (!text) return { message: `HTTP ${response.status}` };
  try {
    const raw = JSON.parse(text);
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const message = typeof obj.detail === 'string' ? obj.detail
        : typeof obj.title === 'string' ? obj.title
        : text;
      return { message, raw: obj };
    }
  } catch { /* fall through to text */ }
  return { message: text };
}

export interface CallApiOptions {
  /** Skip errorbus dispatch for expected failures (e.g. optional-param 404s). */
  silent?: boolean;
  /** Abort the request (a keystroke replacing the previous search). */
  signal?: AbortSignal;
}

/** Query options of GET /apps/{id}/records — filter/orderby are vSQL (see the journey layer's
 *  buildSearchFilter; never concatenate user input into them yourself). */
export interface RecordQuery {
  filter?: string;
  orderby?: string[];
  limit?: number;
  offset?: number;
  /** Field projection (`field=` repeated). The record's `fields` then holds ONLY these keys. */
  fields?: string[];
  signal?: AbortSignal;
}
// URLSearchParams encodes spaces as `+` — the API accepts it (verified live
// 2026-09-02: orderby=r.v_nachname+asc → 200, sorted; filter with + → 200).
export function recordQueryString(q: RecordQuery): string {
  const p = new URLSearchParams();
  if (q.filter) p.set('filter', q.filter);
  for (const o of q.orderby ?? []) p.append('orderby', o);
  for (const f of q.fields ?? []) p.append('field', f);
  if (q.limit !== undefined) p.set('limit', String(Math.max(1, Math.floor(q.limit))));
  if (q.offset !== undefined) p.set('offset', String(Math.max(0, Math.floor(q.offset))));
  const s = p.toString();
  return s ? `?${s}` : '';
}
/** `[[n]]` from aggregate_records?value=count() -> n; `[]` -> 0; anything else -> 0 (never NaN). */
export function parseAggregateCount(data: unknown): number {
  if (!Array.isArray(data)) return 0;
  if (data.length === 0) return 0;
  const first = data[0];
  const n = Array.isArray(first) ? Number(first[0]) : Number(first);
  return Number.isFinite(n) ? n : 0;
}

/** What the create and update helpers resolve to. Same `record_id`
 *  the read helpers expose, so the whole family behaves alike — the
 *  raw REST answer only
 *  carries `id`, and code that guessed (e.g. Object.keys(res)[0]) built
 *  `/records/id` and got a 400 on the next write. */
export interface MutationResult {
  record_id: string;
  id: string;
  fields: Record<string, any>;
  [key: string]: any;
}

async function callApi(method: string, endpoint: string, data?: any, options?: CallApiOptions) {
  const silent = options?.silent === true;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // Nutze Session Cookies für Auth
      signal: options?.signal,
      body: data ? JSON.stringify(data) : undefined
    });
  } catch (netErr) {
    // A search the user typed past is cancelled, not broken — it must not
    // raise an error toast on its way out.
    if (netErr instanceof Error && netErr.name === 'AbortError') throw netErr;
    const message = netErr instanceof Error ? netErr.message : String(netErr);
    if (!silent) {
      window.dispatchEvent(new CustomEvent('errorbus:emit', { detail: {
        source: 'network', message, status: 0,
      } }));
    }
    throw netErr;
  }
  if (!response.ok) {
    // 401/403 go to the login screen only — never to the errorbus (repair can't fix auth).
    const isAuthError = response.status === 401 || response.status === 403;
    if (isAuthError) window.dispatchEvent(new Event('auth-error'));
    const { message, raw } = await parseErrorBody(response);
    const err = new LivingAppsApiError(message, response.status, raw);
    if (!silent && !isAuthError) {
      window.dispatchEvent(new CustomEvent('errorbus:emit', { detail: {
        source: 'api',
        status: err.status,
        type: err.type,
        control_identifier: err.control_identifier,
        control_type: err.control_type,
        field_type: err.field_type,
        detail: err.detail,
        message: err.message,
      } }));
    }
    throw err;
  }
  // DELETE returns often empty body or simple status
  if (method === 'DELETE') return true;
  return response.json();
}

/** Upload a file to LivingApps. Returns the file URL for use in record fields. */
export async function uploadFile(file: File | Blob, filename?: string): Promise<string> {
  // HEIC/HEIF (iPhone photos) crash the server-side image decoder (500).
  // Convert to JPEG in the browser BEFORE upload — every upload path routes
  // through here, so this one guard covers form fields AND attachments.
  if (file instanceof File) file = await ensureUploadableImage(file);
  const formData = new FormData();
  formData.append('file', file, filename ?? (file instanceof File ? file.name : 'upload'));
  const res = await fetch(`${API_BASE_URL}/files`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event('auth-error'));
    throw new Error(`File upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.url;
}

// --- ATTACHMENT API ---
// Record-attachments: file/note/url/json blobs attached to a single record.
// `getAttachments` returns a dict keyed by attachment id; we flatten to an array.
export async function getRecordAttachments(appId: string, recordId: string) {
  const data = await callApi('GET', `/apps/${appId}/records/${recordId}/attachments`, undefined, { silent: true }).catch(() => ({}));
  if (!data || typeof data !== 'object') return [] as import('@/types/app').Attachment[];
  return Object.entries(data).map(([id, att]) => ({ id, ...(att as Record<string, unknown>) })) as import('@/types/app').Attachment[];
}

export async function createRecordAttachment(appId: string, recordId: string, input: import('@/types/app').AttachmentInput) {
  return callApi('POST', `/apps/${appId}/records/${recordId}/attachments`, input) as Promise<import('@/types/app').Attachment>;
}

export async function updateRecordAttachment(appId: string, recordId: string, attachmentId: string, input: Partial<import('@/types/app').AttachmentInput>) {
  return callApi('PATCH', `/apps/${appId}/records/${recordId}/attachments/${attachmentId}`, input) as Promise<import('@/types/app').Attachment>;
}

export async function deleteRecordAttachment(appId: string, recordId: string, attachmentId: string) {
  return callApi('DELETE', `/apps/${appId}/records/${recordId}/attachments/${attachmentId}`);
}

function enrichLookupFields<T extends { fields: Record<string, unknown> }>(
  records: T[], entityKey: string
): T[] {
  const opts = LOOKUP_OPTIONS[entityKey];
  if (!opts) return records;
  return records.map(r => {
    const fields = { ...r.fields };
    for (const [fieldKey, options] of Object.entries(opts)) {
      const val = fields[fieldKey];
      if (typeof val === 'string') {
        const m = options.find(o => o.key === val);
        fields[fieldKey] = m ?? { key: val, label: val };
      } else if (Array.isArray(val)) {
        fields[fieldKey] = val.map(v => {
          if (typeof v === 'string') {
            const m = options.find(o => o.key === v);
            return m ?? { key: v, label: v };
          }
          return v;
        });
      }
    }
    return { ...r, fields } as T;
  });
}

/** A textarea that HOLDS A LIST but was typed on one line.
 *
 *  Rendering such a field as tiles/bullets is the natural thing to do, and
 *  the natural way to write it is `value.split('\n')` — one item per line
 *  is the convention every form implies. Owners type differently though:
 *  a live landing page collapsed five services into ONE tile because the
 *  record held 'Tagesbetreuung, Übernachtung, …' without a single line
 *  break. Normalizing HERE makes that natural split correct whatever was
 *  typed, instead of asking every page to re-derive the heuristic.
 *
 *  Deliberately conservative — prose must survive untouched:
 *    · already has line breaks  → left alone (the author's own structure)
 *    · ; • · |                  → unambiguous separators, 2 parts suffice
 *    · commas                   → only with 3+ parts that all read like
 *                                 labels: short, at most four words, no
 *                                 sentence punctuation. A prose clause like
 *                                 "Katzen und Kleintiere aller Rassen" is
 *                                 short enough but not wordy-short.
 *  Anything else stays as it is, so a wrong guess degrades to today's
 *  behaviour (one item), never to mangled prose. */
const LIST_LABEL_MAX = 40;
const LIST_LABEL_MAX_WORDS = 4;
function listTextToLines(text: string): string {
  if (!text || /\r?\n/.test(text)) return text;
  const bulleted = text.split(/\s*[;•·|]\s*/).map(s => s.trim()).filter(Boolean);
  if (bulleted.length >= 2) return bulleted.join('\n');
  const parts = text.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  const looksLikeLabels = parts.length >= 3 && parts.every(p =>
    p.length <= LIST_LABEL_MAX
    && p.split(/\s+/).length <= LIST_LABEL_MAX_WORDS
    && !/[.!?:]$/.test(p));
  return looksLikeLabels ? parts.join('\n') : text;
}

function normalizeListTextareas<T extends { fields: Record<string, unknown> }>(
  records: T[], entityKey: string
): T[] {
  const types = FIELD_TYPES[entityKey];
  if (!types) return records;
  const areas = Object.keys(types).filter(k => types[k] === 'string/textarea');
  if (areas.length === 0) return records;
  return records.map(r => {
    let touched = false;
    const fields = { ...r.fields };
    for (const key of areas) {
      const val = fields[key];
      if (typeof val !== 'string') continue;
      const next = listTextToLines(val);
      if (next !== val) { fields[key] = next; touched = true; }
    }
    return touched ? ({ ...r, fields } as T) : r;
  });
}

/** The one post-processing step every READ goes through: lookup objects
 *  attached, list-ish textareas line-broken. Read helpers call this, not
 *  the individual passes. */
function hydrateRecords<T extends { fields: Record<string, unknown> }>(
  records: T[], entityKey: string
): T[] {
  return normalizeListTextareas(enrichLookupFields(records, entityKey), entityKey);
}

/** Normalize fields for API writes: strip lookup objects to keys, fix date formats. */
export function cleanFieldsForApi(
  fields: Record<string, unknown>,
  entityKey: string
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...fields };
  // Strip virtual / unknown keys before they hit the API. Sub-agent invents
  // computed-only keys (e.g. `_netto`, `_bestellung_gesamtbetrag`) for the
  // 'Berechnungen' display, and a leaky submit-backfill would otherwise send
  // them to the Living-Apps backend which rejects with 'field does not exist'.
  const known = FIELD_TYPES[entityKey];
  if (known) {
    for (const k of Object.keys(clean)) {
      if (!(k in known)) delete clean[k];
    }
  }
  for (const [k, v] of Object.entries(clean)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'key' in v) clean[k] = (v as any).key;
    if (Array.isArray(v)) clean[k] = v.map((item: any) => item && typeof item === 'object' && 'key' in item ? item.key : item);
  }
  const types = FIELD_TYPES[entityKey];
  if (types) {
    for (const [k, ft] of Object.entries(types)) {
      if (!(k in clean)) continue;
      const val = clean[k];
      // applookup fields: undefined → null (clear single reference)
      if ((ft === 'applookup/select' || ft === 'applookup/choice') && val === undefined) { clean[k] = null; continue; }
      // multipleapplookup fields: undefined/null → [] (clear multi reference)
      if ((ft === 'multipleapplookup/select' || ft === 'multipleapplookup/choice') && (val === undefined || val === null)) { clean[k] = []; continue; }
      // lookup fields: undefined → null (clear single lookup)
      if ((ft.startsWith('lookup/')) && val === undefined) { clean[k] = null; continue; }
      // multiplelookup fields: undefined/null → [] (clear multi lookup)
      if ((ft.startsWith('multiplelookup/')) && (val === undefined || val === null)) { clean[k] = []; continue; }
      if (typeof val !== 'string' || !val) continue;
      if (ft === 'date/datetimeminute') clean[k] = val.slice(0, 16);
      else if (ft === 'date/date') clean[k] = val.slice(0, 10);
    }
  }
  return clean;
}

let _cachedUserProfile: Record<string, unknown> | null = null;

export async function getUserProfile(): Promise<Record<string, unknown>> {
  if (_cachedUserProfile) return _cachedUserProfile;
  const raw = await callApi('GET', '/user');
  const skip = new Set(['id', 'image', 'lang', 'gender', 'title', 'fax', 'menus', 'initials']);
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && !skip.has(k)) data[k] = v;
  }
  _cachedUserProfile = data;
  return data;
}

export interface HeaderProfile {
  firstname: string;
  surname: string;
  email: string;
  image: string | null;
  company: string | null;
}

let _cachedHeaderProfile: HeaderProfile | null = null;

export async function getHeaderProfile(): Promise<HeaderProfile> {
  if (_cachedHeaderProfile) return _cachedHeaderProfile;
  const raw = await callApi('GET', '/user');
  _cachedHeaderProfile = {
    firstname: raw.firstname ?? '',
    surname: raw.surname ?? '',
    email: raw.email ?? '',
    image: raw.image ?? null,
    company: raw.company ?? null,
  };
  return _cachedHeaderProfile;
}

export interface AppGroupInfo {
  id: string;
  name: string;
  image: string | null;
  createdat: string;
  /** Resolved link: /objects/{id}/ if the dashboard exists, otherwise /gateway/apps/{firstAppId}?template=list_page */
  href: string;
}

let _cachedAppGroups: AppGroupInfo[] | null = null;

export async function getAppGroups(): Promise<AppGroupInfo[]> {
  if (_cachedAppGroups) return _cachedAppGroups;
  const raw = await callApi('GET', '/appgroups?with=apps');
  const groups: AppGroupInfo[] = Object.values(raw)
    .map((g: any) => {
      const firstAppId = Object.keys(g.apps ?? {})[0] ?? g.id;
      return {
        id: g.id,
        name: g.name,
        image: g.image ?? null,
        // API field is created_at (snake_case) — the old camelCase read
        // left every group '', silently disabling the newest-first sort.
        createdat: g.created_at ?? g.createdat ?? '',
        href: `/gateway/apps/${firstAppId}?template=list_page`,
        _firstAppId: firstAppId,
      };
    })
    .sort((a, b) => b.createdat.localeCompare(a.createdat));

  // Check which appgroups have a deployed dashboard via app params
  const paramChecks = await Promise.allSettled(
    groups.map(g => callApi('GET', `/apps/${(g as any)._firstAppId}/params/la_page_header_additional_url`, undefined, { silent: true }))
  );
  paramChecks.forEach((result, i) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const url = result.value.value;
    if (typeof url === 'string' && url.length > 0) {
      try { groups[i].href = new URL(url).pathname; } catch { groups[i].href = url; }
    }
  });

  // Clean up internal helper property
  groups.forEach(g => delete (g as any)._firstAppId);

  _cachedAppGroups = groups;
  return _cachedAppGroups;
}

export class LivingAppsService {
  // --- KUNDEN ---
  static async getKunden(): Promise<Kunden[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.KUNDEN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Kunden[];
    return hydrateRecords(records, 'kunden');
  }
  static async queryKunden(q: RecordQuery = {}): Promise<Kunden[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.KUNDEN}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Kunden[];
    return hydrateRecords(records, 'kunden');
  }
  static async countKunden(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.KUNDEN}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getKundenEntry(id: string): Promise<Kunden | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.KUNDEN}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Kunden;
    return hydrateRecords([record], 'kunden')[0];
  }
  static async createKundenEntry(fields: CreateKunden): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.KUNDEN}/records`, { fields: cleanFieldsForApi(fields as any, 'kunden') });
    return { ...data, record_id: data.id };
  }
  static async updateKundenEntry(id: string, fields: Partial<CreateKunden>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.KUNDEN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'kunden') });
    return { ...data, record_id: data.id };
  }
  static async deleteKundenEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.KUNDEN}/records/${id}`);
  }

  // --- MITARBEITER ---
  static async getMitarbeiter(): Promise<Mitarbeiter[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.MITARBEITER}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Mitarbeiter[];
    return hydrateRecords(records, 'mitarbeiter');
  }
  static async queryMitarbeiter(q: RecordQuery = {}): Promise<Mitarbeiter[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.MITARBEITER}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Mitarbeiter[];
    return hydrateRecords(records, 'mitarbeiter');
  }
  static async countMitarbeiter(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.MITARBEITER}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getMitarbeiterEntry(id: string): Promise<Mitarbeiter | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.MITARBEITER}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Mitarbeiter;
    return hydrateRecords([record], 'mitarbeiter')[0];
  }
  static async createMitarbeiterEntry(fields: CreateMitarbeiter): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.MITARBEITER}/records`, { fields: cleanFieldsForApi(fields as any, 'mitarbeiter') });
    return { ...data, record_id: data.id };
  }
  static async updateMitarbeiterEntry(id: string, fields: Partial<CreateMitarbeiter>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.MITARBEITER}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'mitarbeiter') });
    return { ...data, record_id: data.id };
  }
  static async deleteMitarbeiterEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.MITARBEITER}/records/${id}`);
  }

  // --- TEILEBESTAND ---
  static async getTeilebestand(): Promise<Teilebestand[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.TEILEBESTAND}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Teilebestand[];
    return hydrateRecords(records, 'teilebestand');
  }
  static async queryTeilebestand(q: RecordQuery = {}): Promise<Teilebestand[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.TEILEBESTAND}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Teilebestand[];
    return hydrateRecords(records, 'teilebestand');
  }
  static async countTeilebestand(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.TEILEBESTAND}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getTeilebestandEntry(id: string): Promise<Teilebestand | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.TEILEBESTAND}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Teilebestand;
    return hydrateRecords([record], 'teilebestand')[0];
  }
  static async createTeilebestandEntry(fields: CreateTeilebestand): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.TEILEBESTAND}/records`, { fields: cleanFieldsForApi(fields as any, 'teilebestand') });
    return { ...data, record_id: data.id };
  }
  static async updateTeilebestandEntry(id: string, fields: Partial<CreateTeilebestand>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.TEILEBESTAND}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'teilebestand') });
    return { ...data, record_id: data.id };
  }
  static async deleteTeilebestandEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.TEILEBESTAND}/records/${id}`);
  }

  // --- FAHRZEUGE ---
  static async getFahrzeuge(): Promise<Fahrzeuge[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.FAHRZEUGE}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Fahrzeuge[];
    return hydrateRecords(records, 'fahrzeuge');
  }
  static async queryFahrzeuge(q: RecordQuery = {}): Promise<Fahrzeuge[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.FAHRZEUGE}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Fahrzeuge[];
    return hydrateRecords(records, 'fahrzeuge');
  }
  static async countFahrzeuge(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.FAHRZEUGE}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getFahrzeugeEntry(id: string): Promise<Fahrzeuge | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.FAHRZEUGE}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Fahrzeuge;
    return hydrateRecords([record], 'fahrzeuge')[0];
  }
  static async createFahrzeugeEntry(fields: CreateFahrzeuge): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.FAHRZEUGE}/records`, { fields: cleanFieldsForApi(fields as any, 'fahrzeuge') });
    return { ...data, record_id: data.id };
  }
  static async updateFahrzeugeEntry(id: string, fields: Partial<CreateFahrzeuge>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.FAHRZEUGE}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'fahrzeuge') });
    return { ...data, record_id: data.id };
  }
  static async deleteFahrzeugeEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.FAHRZEUGE}/records/${id}`);
  }

  // --- AUFTRAEGE ---
  static async getAuftraege(): Promise<Auftraege[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAEGE}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Auftraege[];
    return hydrateRecords(records, 'auftraege');
  }
  static async queryAuftraege(q: RecordQuery = {}): Promise<Auftraege[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAEGE}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Auftraege[];
    return hydrateRecords(records, 'auftraege');
  }
  static async countAuftraege(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAEGE}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getAuftraegeEntry(id: string): Promise<Auftraege | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAEGE}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Auftraege;
    return hydrateRecords([record], 'auftraege')[0];
  }
  static async createAuftraegeEntry(fields: CreateAuftraege): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.AUFTRAEGE}/records`, { fields: cleanFieldsForApi(fields as any, 'auftraege') });
    return { ...data, record_id: data.id };
  }
  static async updateAuftraegeEntry(id: string, fields: Partial<CreateAuftraege>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.AUFTRAEGE}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'auftraege') });
    return { ...data, record_id: data.id };
  }
  static async deleteAuftraegeEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.AUFTRAEGE}/records/${id}`);
  }

  // --- AUFTRAGSPOSITIONEN ---
  static async getAuftragspositionen(): Promise<Auftragspositionen[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Auftragspositionen[];
    return hydrateRecords(records, 'auftragspositionen');
  }
  static async queryAuftragspositionen(q: RecordQuery = {}): Promise<Auftragspositionen[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Auftragspositionen[];
    return hydrateRecords(records, 'auftragspositionen');
  }
  static async countAuftragspositionen(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getAuftragspositionenEntry(id: string): Promise<Auftragspositionen | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Auftragspositionen;
    return hydrateRecords([record], 'auftragspositionen')[0];
  }
  static async createAuftragspositionenEntry(fields: CreateAuftragspositionen): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/records`, { fields: cleanFieldsForApi(fields as any, 'auftragspositionen') });
    return { ...data, record_id: data.id };
  }
  static async updateAuftragspositionenEntry(id: string, fields: Partial<CreateAuftragspositionen>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'auftragspositionen') });
    return { ...data, record_id: data.id };
  }
  static async deleteAuftragspositionenEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.AUFTRAGSPOSITIONEN}/records/${id}`);
  }

  // --- RECHNUNGEN ---
  static async getRechnungen(): Promise<Rechnungen[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.RECHNUNGEN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Rechnungen[];
    return hydrateRecords(records, 'rechnungen');
  }
  static async queryRechnungen(q: RecordQuery = {}): Promise<Rechnungen[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.RECHNUNGEN}/records${recordQueryString(q)}`, undefined, { signal: q.signal });
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec,
      createdat: rec.created_at ?? '', updatedat: rec.updated_at ?? null,
    })) as Rechnungen[];
    return hydrateRecords(records, 'rechnungen');
  }
  static async countRechnungen(filter?: string, signal?: AbortSignal): Promise<number> {
    const data = await callApi('GET', `/apps/${APP_IDS.RECHNUNGEN}/aggregate_records${recordQueryString({ filter })}${filter ? '&' : '?'}value=count()`, undefined, { signal, silent: true });
    return parseAggregateCount(data);
  }
  static async getRechnungenEntry(id: string): Promise<Rechnungen | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.RECHNUNGEN}/records/${id}`);
    const record = { record_id: data.id, ...data, createdat: data.created_at ?? '', updatedat: data.updated_at ?? null } as Rechnungen;
    return hydrateRecords([record], 'rechnungen')[0];
  }
  static async createRechnungenEntry(fields: CreateRechnungen): Promise<MutationResult> {
    const data = await callApi('POST', `/apps/${APP_IDS.RECHNUNGEN}/records`, { fields: cleanFieldsForApi(fields as any, 'rechnungen') });
    return { ...data, record_id: data.id };
  }
  static async updateRechnungenEntry(id: string, fields: Partial<CreateRechnungen>): Promise<MutationResult> {
    const data = await callApi('PATCH', `/apps/${APP_IDS.RECHNUNGEN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'rechnungen') });
    return { ...data, record_id: data.id };
  }
  static async deleteRechnungenEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.RECHNUNGEN}/records/${id}`);
  }

}