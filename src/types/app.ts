import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Kunden {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    kundentyp?: LookupValue;
    telefon?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    notizen?: string;
  };
}

export interface Mitarbeiter {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    email?: string;
    vorname?: string;
    nachname?: string;
    rolle?: LookupValue;
    stundensatz?: number;
    status?: LookupValue;
  };
}

export interface Teilebestand {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    artikelnummer?: string;
    bezeichnung?: string;
    hersteller?: string;
    einkaufspreis?: number;
    verkaufspreis?: number;
    bestand?: number;
    mindestbestand?: number;
    lagerplatz?: string;
  };
}

export interface Fahrzeuge {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    kennzeichen?: string;
    marke?: string;
    modell?: string;
    erstzulassung?: string; // Format: YYYY-MM-DD oder ISO String
    kilometerstand?: number;
    fahrgestellnummer?: string;
    hu_faellig?: string; // Format: YYYY-MM-DD oder ISO String
    halter?: RecordUrl; // applookup -> URL zu 'Kunden' Record
  };
}

export interface Auftraege {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    auftragsnummer?: string;
    fahrzeug?: RecordUrl; // applookup -> URL zu 'Fahrzeuge' Record
    annahmedatum?: string; // Format: YYYY-MM-DD oder ISO String
    fertigstellungstermin?: string; // Format: YYYY-MM-DD oder ISO String
    kundenwunsch?: string;
    status?: LookupValue;
    mechaniker?: RecordUrl; // applookup -> URL zu 'Mitarbeiter' Record
    kilometerstand_annahme?: number;
    notizen?: string;
  };
}

export interface Auftragspositionen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    auftrag?: RecordUrl; // applookup -> URL zu 'Auftraege' Record
    positionstyp?: LookupValue;
    bezeichnung?: string;
    menge?: number;
    einzelpreis?: number;
    mechaniker?: RecordUrl; // applookup -> URL zu 'Mitarbeiter' Record
    dauer_stunden?: number;
    teil?: RecordUrl; // applookup -> URL zu 'Teilebestand' Record
  };
}

export interface Rechnungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    rechnungsnummer?: string;
    auftrag?: RecordUrl; // applookup -> URL zu 'Auftraege' Record
    kunde?: RecordUrl; // applookup -> URL zu 'Kunden' Record
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    faelligkeit?: string; // Format: YYYY-MM-DD oder ISO String
    nettobetrag?: number;
    mwst?: number;
    bruttobetrag?: number;
    status?: LookupValue;
    zahlungseingang?: string; // Format: YYYY-MM-DD oder ISO String
    pdf?: string;
  };
}

export const APP_IDS = {
  KUNDEN: '6aa94da65297da904085d71c',
  MITARBEITER: '6aa94dad44457dfc3ca4921c',
  TEILEBESTAND: '6aa94dae08a22adc1b6489f1',
  FAHRZEUGE: '6aa94daf5902b993cd4338de',
  AUFTRAEGE: '6aa94daf32649f17d9cf9867',
  AUFTRAGSPOSITIONEN: '6aa94db0a3a322a817b5d5a2',
  RECHNUNGEN: '6aa94db0b8f915fad738ff80',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'kunden': {
    kundentyp: [{ key: "privat", get label() { return lookupLabel('kunden', 'kundentyp', "privat") ?? "Privat"; } }, { key: "gewerbe", get label() { return lookupLabel('kunden', 'kundentyp', "gewerbe") ?? "Gewerbe"; } }],
  },
  'mitarbeiter': {
    rolle: [{ key: "annahme", get label() { return lookupLabel('mitarbeiter', 'rolle', "annahme") ?? "Annahme"; } }, { key: "mechaniker", get label() { return lookupLabel('mitarbeiter', 'rolle', "mechaniker") ?? "Mechaniker"; } }, { key: "chef", get label() { return lookupLabel('mitarbeiter', 'rolle', "chef") ?? "Chef"; } }],
    status: [{ key: "aktiv", get label() { return lookupLabel('mitarbeiter', 'status', "aktiv") ?? "Aktiv"; } }, { key: "krank", get label() { return lookupLabel('mitarbeiter', 'status', "krank") ?? "Krank"; } }, { key: "urlaub", get label() { return lookupLabel('mitarbeiter', 'status', "urlaub") ?? "Urlaub"; } }],
  },
  'auftraege': {
    status: [{ key: "angenommen", get label() { return lookupLabel('auftraege', 'status', "angenommen") ?? "Angenommen"; } }, { key: "in_arbeit", get label() { return lookupLabel('auftraege', 'status', "in_arbeit") ?? "In Arbeit"; } }, { key: "fertig", get label() { return lookupLabel('auftraege', 'status', "fertig") ?? "Fertig"; } }, { key: "abgerechnet", get label() { return lookupLabel('auftraege', 'status', "abgerechnet") ?? "Abgerechnet"; } }, { key: "abgeholt", get label() { return lookupLabel('auftraege', 'status', "abgeholt") ?? "Abgeholt"; } }],
  },
  'auftragspositionen': {
    positionstyp: [{ key: "arbeit", get label() { return lookupLabel('auftragspositionen', 'positionstyp', "arbeit") ?? "Arbeit"; } }, { key: "teil", get label() { return lookupLabel('auftragspositionen', 'positionstyp', "teil") ?? "Teil"; } }],
  },
  'rechnungen': {
    status: [{ key: "offen", get label() { return lookupLabel('rechnungen', 'status', "offen") ?? "Offen"; } }, { key: "bezahlt", get label() { return lookupLabel('rechnungen', 'status', "bezahlt") ?? "Bezahlt"; } }, { key: "storniert", get label() { return lookupLabel('rechnungen', 'status', "storniert") ?? "Storniert"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kunden': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'kundentyp': 'lookup/radio',
    'telefon': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'notizen': 'string/textarea',
  },
  'mitarbeiter': {
    'email': 'string/email',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'rolle': 'lookup/radio',
    'stundensatz': 'number',
    'status': 'lookup/radio',
  },
  'teilebestand': {
    'artikelnummer': 'string/text',
    'bezeichnung': 'string/text',
    'hersteller': 'string/text',
    'einkaufspreis': 'number',
    'verkaufspreis': 'number',
    'bestand': 'number',
    'mindestbestand': 'number',
    'lagerplatz': 'string/text',
  },
  'fahrzeuge': {
    'kennzeichen': 'string/text',
    'marke': 'string/text',
    'modell': 'string/text',
    'erstzulassung': 'date/date',
    'kilometerstand': 'number',
    'fahrgestellnummer': 'string/text',
    'hu_faellig': 'date/date',
    'halter': 'applookup/select',
  },
  'auftraege': {
    'auftragsnummer': 'string/text',
    'fahrzeug': 'applookup/select',
    'annahmedatum': 'date/date',
    'fertigstellungstermin': 'date/date',
    'kundenwunsch': 'string/textarea',
    'status': 'lookup/select',
    'mechaniker': 'applookup/select',
    'kilometerstand_annahme': 'number',
    'notizen': 'string/textarea',
  },
  'auftragspositionen': {
    'auftrag': 'applookup/select',
    'positionstyp': 'lookup/radio',
    'bezeichnung': 'string/text',
    'menge': 'number',
    'einzelpreis': 'number',
    'mechaniker': 'applookup/select',
    'dauer_stunden': 'number',
    'teil': 'applookup/select',
  },
  'rechnungen': {
    'rechnungsnummer': 'string/text',
    'auftrag': 'applookup/select',
    'kunde': 'applookup/select',
    'rechnungsdatum': 'date/date',
    'faelligkeit': 'date/date',
    'nettobetrag': 'number',
    'mwst': 'number',
    'bruttobetrag': 'number',
    'status': 'lookup/radio',
    'zahlungseingang': 'date/date',
    'pdf': 'file',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKunden = StripLookup<Kunden['fields']>;
export type CreateMitarbeiter = StripLookup<Mitarbeiter['fields']>;
export type CreateTeilebestand = StripLookup<Teilebestand['fields']>;
export type CreateFahrzeuge = StripLookup<Fahrzeuge['fields']>;
export type CreateAuftraege = StripLookup<Auftraege['fields']>;
export type CreateAuftragspositionen = StripLookup<Auftragspositionen['fields']>;
export type CreateRechnungen = StripLookup<Rechnungen['fields']>;