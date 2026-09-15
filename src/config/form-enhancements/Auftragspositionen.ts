// Auto-generated. Per-entity form-enhancements config for "Auftragspositionen".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["auftrag", "positionstyp", "bezeichnung", "menge", "einzelpreis", "mechaniker", "dauer_stunden", "teil"],
  defaults: {
    'positionstyp': { kind: 'lookup', key: 'arbeit', label: 'Arbeit' },
    'menge': { kind: 'literal', value: 1 },
  },
  computed: {
    '_posten_kosten': (_fields, ctx) => {
      const typ = ctx.lookupKey('positionstyp');
      if (typ === 'arbeit') {
        const stundensatz = ctx.applookup('mechaniker', 'stundensatz') ?? 0;
        const stunden = ctx.num('dauer_stunden');
        return stundensatz * stunden;
      } else if (typ === 'teil') {
        const verkaufspreis = ctx.applookup('teil', 'verkaufspreis') ?? 0;
        const menge = ctx.num('menge');
        return verkaufspreis * menge;
      }
      return ctx.num('einzelpreis') * ctx.num('menge');
    },
    '_gesamt_position': { kind: 'field', key: '_posten_kosten' },
  },
};

// Build-time-populated field dependencies for MODUS-2 arrow functions in
// `computed`. The sub-agent leaves this empty; scripts/parse-formulas.mjs
// fills it after Step 0 by regex-extracting ctx.* calls from each function
// body. The dialog feeds these into classifyComputed so MODUS-2 entries get
// inline anchors instead of always landing in the aggregate section.
export const computedDeps: Record<string, string[]> = {
  '_posten_kosten': ['dauer_stunden', 'menge', 'einzelpreis', 'mechaniker', 'teil', 'positionstyp'],
};

// Build-time-populated applookup (ownKey → lookupKey) pairs found in MODUS-2
// arrow functions. Filled by scripts/parse-formulas.mjs from regex matches
// on `ctx.applookup('x','y')` and `ctx.applookupAny('x','y')`. The dialog
// merges this with MODUS-1 refs extracted at render time, so every numeric
// field the formula pulls from a selected lookup is surfaced as an inline
// hint next to the lookup combobox.
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {
  'mechaniker': [{ lookupKey: 'stundensatz' }],
  'teil': [{ lookupKey: 'verkaufspreis' }],
};
