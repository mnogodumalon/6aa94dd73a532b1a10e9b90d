/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'kunden' | 'mitarbeiter' | 'teilebestand' | 'fahrzeuge' | 'auftraege' | 'auftragspositionen' | 'rechnungen';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "kunden": "vorname" | "nachname" | "telefon" | "email" | "strasse" | "hausnummer" | "plz" | "ort" | "notizen";
  "mitarbeiter": "email" | "vorname" | "nachname";
  "teilebestand": "artikelnummer" | "bezeichnung" | "hersteller" | "lagerplatz";
  "fahrzeuge": "kennzeichen" | "marke" | "modell" | "fahrgestellnummer";
  "auftraege": "auftragsnummer" | "kundenwunsch" | "notizen";
  "auftragspositionen": "bezeichnung";
  "rechnungen": "rechnungsnummer";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

/** The applookup fields of each entity (generated). A pick stored through
 *  `form.set` on one of these must carry its display name — at compile time
 *  (`StepForm.set`), because the review would otherwise show the id. */
export interface RecordFields {
  "kunden": never;
  "mitarbeiter": never;
  "teilebestand": never;
  "fahrzeuge": "halter";
  "auftraege": "fahrzeug" | "mechaniker";
  "auftragspositionen": "auftrag" | "mechaniker" | "teil";
  "rechnungen": "auftrag" | "kunde";
}
export type RecordFieldKey<E extends EntityKey> = E extends keyof RecordFields ? RecordFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it (`file` is upload-only, never via a journey). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "kunden": {
    "key": "kunden",
    "appId": "6aa94da65297da904085d71c",
    "label": "Kunden",
    "pascal": "Kunden",
    "single": "KundenEntry"
  },
  "mitarbeiter": {
    "key": "mitarbeiter",
    "appId": "6aa94dad44457dfc3ca4921c",
    "label": "Mitarbeiter",
    "pascal": "Mitarbeiter",
    "single": "MitarbeiterEntry"
  },
  "teilebestand": {
    "key": "teilebestand",
    "appId": "6aa94dae08a22adc1b6489f1",
    "label": "Teilebestand",
    "pascal": "Teilebestand",
    "single": "TeilebestandEntry"
  },
  "fahrzeuge": {
    "key": "fahrzeuge",
    "appId": "6aa94daf5902b993cd4338de",
    "label": "Fahrzeuge",
    "pascal": "Fahrzeuge",
    "single": "FahrzeugeEntry"
  },
  "auftraege": {
    "key": "auftraege",
    "appId": "6aa94daf32649f17d9cf9867",
    "label": "Aufträge",
    "pascal": "Auftraege",
    "single": "AuftraegeEntry"
  },
  "auftragspositionen": {
    "key": "auftragspositionen",
    "appId": "6aa94db0a3a322a817b5d5a2",
    "label": "Auftragspositionen",
    "pascal": "Auftragspositionen",
    "single": "AuftragspositionenEntry"
  },
  "rechnungen": {
    "key": "rechnungen",
    "appId": "6aa94db0b8f915fad738ff80",
    "label": "Rechnungen",
    "pascal": "Rechnungen",
    "single": "RechnungenEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "kunden": {
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "kundentyp": {
      "key": "kundentyp",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Kundentyp",
      "writable": true,
      "options": [
        "privat",
        "gewerbe"
      ]
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefon",
      "writable": true,
      "autoComplete": "tel"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    },
    "strasse": {
      "key": "strasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Straße",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-line1"
    },
    "hausnummer": {
      "key": "hausnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausnummer",
      "writable": true,
      "maxLength": 4000
    },
    "plz": {
      "key": "plz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Postleitzahl",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "postal-code"
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "notizen": {
      "key": "notizen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Notizen",
      "writable": true
    }
  },
  "mitarbeiter": {
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    },
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "rolle": {
      "key": "rolle",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Rolle",
      "writable": true,
      "options": [
        "annahme",
        "mechaniker",
        "chef"
      ]
    },
    "stundensatz": {
      "key": "stundensatz",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Stundensatz (€)",
      "writable": true,
      "format": "currency"
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "aktiv",
        "krank",
        "urlaub"
      ]
    }
  },
  "teilebestand": {
    "artikelnummer": {
      "key": "artikelnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Artikelnummer",
      "writable": true,
      "maxLength": 4000
    },
    "bezeichnung": {
      "key": "bezeichnung",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Bezeichnung",
      "writable": true,
      "maxLength": 4000
    },
    "hersteller": {
      "key": "hersteller",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hersteller",
      "writable": true,
      "maxLength": 4000
    },
    "einkaufspreis": {
      "key": "einkaufspreis",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Einkaufspreis (€)",
      "writable": true,
      "format": "currency"
    },
    "verkaufspreis": {
      "key": "verkaufspreis",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Verkaufspreis (€)",
      "writable": true,
      "format": "currency"
    },
    "bestand": {
      "key": "bestand",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Bestand (Stück)",
      "writable": true
    },
    "mindestbestand": {
      "key": "mindestbestand",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Mindestbestand (Stück)",
      "writable": true
    },
    "lagerplatz": {
      "key": "lagerplatz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Lagerplatz",
      "writable": true,
      "maxLength": 4000
    }
  },
  "fahrzeuge": {
    "kennzeichen": {
      "key": "kennzeichen",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Kennzeichen",
      "writable": true,
      "maxLength": 4000
    },
    "marke": {
      "key": "marke",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Marke",
      "writable": true,
      "maxLength": 4000
    },
    "modell": {
      "key": "modell",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Modell",
      "writable": true,
      "maxLength": 4000
    },
    "erstzulassung": {
      "key": "erstzulassung",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Erstzulassung",
      "writable": true
    },
    "kilometerstand": {
      "key": "kilometerstand",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Kilometerstand (km)",
      "writable": true
    },
    "fahrgestellnummer": {
      "key": "fahrgestellnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Fahrgestellnummer",
      "writable": true,
      "maxLength": 4000
    },
    "hu_faellig": {
      "key": "hu_faellig",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "HU fällig",
      "writable": true
    },
    "halter": {
      "key": "halter",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Halter (Kunde)",
      "writable": true,
      "targetAppId": "6aa94da65297da904085d71c",
      "targetEntity": "kunden"
    }
  },
  "auftraege": {
    "auftragsnummer": {
      "key": "auftragsnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Auftragsnummer",
      "writable": true,
      "maxLength": 4000
    },
    "fahrzeug": {
      "key": "fahrzeug",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Fahrzeug",
      "writable": true,
      "targetAppId": "6aa94daf5902b993cd4338de",
      "targetEntity": "fahrzeuge"
    },
    "annahmedatum": {
      "key": "annahmedatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Annahmedatum",
      "writable": true
    },
    "fertigstellungstermin": {
      "key": "fertigstellungstermin",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Zugesagter Fertigstellungstermin",
      "writable": true
    },
    "kundenwunsch": {
      "key": "kundenwunsch",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Kundenwunsch",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "angenommen",
        "in_arbeit",
        "fertig",
        "abgerechnet",
        "abgeholt"
      ]
    },
    "mechaniker": {
      "key": "mechaniker",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Zuständiger Mechaniker",
      "writable": true,
      "targetAppId": "6aa94dad44457dfc3ca4921c",
      "targetEntity": "mitarbeiter"
    },
    "kilometerstand_annahme": {
      "key": "kilometerstand_annahme",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Kilometerstand bei Annahme (km)",
      "writable": true
    },
    "notizen": {
      "key": "notizen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Notizen",
      "writable": true
    }
  },
  "auftragspositionen": {
    "auftrag": {
      "key": "auftrag",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Auftrag",
      "writable": true,
      "targetAppId": "6aa94daf32649f17d9cf9867",
      "targetEntity": "auftraege"
    },
    "positionstyp": {
      "key": "positionstyp",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Positionstyp",
      "writable": true,
      "options": [
        "arbeit",
        "teil"
      ]
    },
    "bezeichnung": {
      "key": "bezeichnung",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Bezeichnung",
      "writable": true,
      "maxLength": 4000
    },
    "menge": {
      "key": "menge",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Menge",
      "writable": true
    },
    "einzelpreis": {
      "key": "einzelpreis",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Einzelpreis (€)",
      "writable": true,
      "format": "currency"
    },
    "mechaniker": {
      "key": "mechaniker",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Mechaniker",
      "writable": true,
      "targetAppId": "6aa94dad44457dfc3ca4921c",
      "targetEntity": "mitarbeiter"
    },
    "dauer_stunden": {
      "key": "dauer_stunden",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Dauer (Stunden)",
      "writable": true
    },
    "teil": {
      "key": "teil",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Verwendetes Teil",
      "writable": true,
      "targetAppId": "6aa94dae08a22adc1b6489f1",
      "targetEntity": "teilebestand"
    }
  },
  "rechnungen": {
    "rechnungsnummer": {
      "key": "rechnungsnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Rechnungsnummer",
      "writable": true,
      "maxLength": 4000
    },
    "auftrag": {
      "key": "auftrag",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Auftrag",
      "writable": true,
      "targetAppId": "6aa94daf32649f17d9cf9867",
      "targetEntity": "auftraege"
    },
    "kunde": {
      "key": "kunde",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Kunde",
      "writable": true,
      "targetAppId": "6aa94da65297da904085d71c",
      "targetEntity": "kunden"
    },
    "rechnungsdatum": {
      "key": "rechnungsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Rechnungsdatum",
      "writable": true
    },
    "faelligkeit": {
      "key": "faelligkeit",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Fälligkeit",
      "writable": true
    },
    "nettobetrag": {
      "key": "nettobetrag",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Nettobetrag (€)",
      "writable": true,
      "format": "currency"
    },
    "mwst": {
      "key": "mwst",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "MwSt. (€)",
      "writable": true,
      "format": "currency"
    },
    "bruttobetrag": {
      "key": "bruttobetrag",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Bruttobetrag (€)",
      "writable": true,
      "format": "currency"
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "offen",
        "bezahlt",
        "storniert"
      ]
    },
    "zahlungseingang": {
      "key": "zahlungseingang",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Zahlungseingang",
      "writable": true
    },
    "pdf": {
      "key": "pdf",
      "fulltype": "file",
      "kind": "file",
      "required": false,
      "label": "Rechnungs-PDF",
      "writable": false
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "kunden": [
    {
      "kind": "choice",
      "field": "kundentyp",
      "count": 2
    }
  ],
  "mitarbeiter": [
    {
      "kind": "choice",
      "field": "rolle",
      "count": 3
    },
    {
      "kind": "choice",
      "field": "status",
      "count": 3
    }
  ],
  "teilebestand": [
    {
      "kind": "stock",
      "field": "bestand"
    }
  ],
  "fahrzeuge": [
    {
      "kind": "record",
      "field": "halter",
      "targetEntity": "kunden"
    }
  ],
  "auftraege": [
    {
      "kind": "choice",
      "field": "status",
      "count": 5
    },
    {
      "kind": "record",
      "field": "fahrzeug",
      "targetEntity": "fahrzeuge"
    },
    {
      "kind": "record",
      "field": "mechaniker",
      "targetEntity": "mitarbeiter"
    }
  ],
  "auftragspositionen": [
    {
      "kind": "choice",
      "field": "positionstyp",
      "count": 2
    },
    {
      "kind": "record",
      "field": "auftrag",
      "targetEntity": "auftraege"
    },
    {
      "kind": "record",
      "field": "mechaniker",
      "targetEntity": "mitarbeiter"
    },
    {
      "kind": "record",
      "field": "teil",
      "targetEntity": "teilebestand"
    }
  ],
  "rechnungen": [
    {
      "kind": "choice",
      "field": "status",
      "count": 3
    },
    {
      "kind": "record",
      "field": "auftrag",
      "targetEntity": "auftraege"
    },
    {
      "kind": "record",
      "field": "kunde",
      "targetEntity": "kunden"
    }
  ]
};

/** The fields a record of this entity is recognised by (a person: first and
 *  last name; else its title-like text field) — the same choice the dashboard's
 *  enrichment makes for `<key>Name`. `useRecordSearch` resolves an applookup to
 *  this name (`ctx.ref('gast')` in `toItem`). */
export const DISPLAY_FIELDS: Record<EntityKey, string[]> = {
  "kunden": [
    "vorname",
    "nachname"
  ],
  "mitarbeiter": [
    "vorname",
    "nachname"
  ],
  "teilebestand": [
    "artikelnummer"
  ],
  "fahrzeuge": [
    "kennzeichen"
  ],
  "auftraege": [
    "auftragsnummer"
  ],
  "auftragspositionen": [
    "bezeichnung"
  ],
  "rechnungen": [
    "rechnungsnummer"
  ]
};

/** The display name of a record: its display fields joined, else the first
 *  non-empty text value, else ''. */
/** A display-field value as text: strings as they are, a lookup `{ key, label }`
 *  (either door hydrates lookups to objects) by its label — an entity whose
 *  only title-like field is a lookup/select otherwise had no name at all. */
function displayPart(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object' && 'label' in v) {
    const l = (v as { label?: unknown }).label;
    return l === null || l === undefined ? '' : String(l).trim();
  }
  return '';
}

export function displayNameOf(entity: EntityKey, fields: Record<string, unknown>): string {
  const parts = (DISPLAY_FIELDS[entity] ?? [])
    .map(k => displayPart(fields[k]))
    .filter(v => v !== '');
  if (parts.length > 0) return parts.join(' ');
  for (const [k, rule] of Object.entries(FIELD_RULES[entity] ?? {})) {
    if (rule.kind !== 'text' && rule.kind !== 'email') continue;
    const v = fields[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — runtime bundle first, generated label second. */
export function labelOf(entity: EntityKey, key: string): string {
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
