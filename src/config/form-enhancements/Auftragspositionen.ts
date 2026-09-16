// Auto-generated. Per-entity form-enhancements config for "Auftragspositionen".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ['auftrag', 'positionstyp', 'bezeichnung', 'menge', 'einzelpreis', 'mechaniker', 'dauer_stunden', 'teil'],
  defaults: {
    'positionstyp': { kind: 'lookup', key: 'arbeit', label: 'Arbeit' },
    'menge': { kind: 'literal', value: 1 },
  },
  computed: {
    '_arbeitskosten': { op: 'mul', left: { kind: 'applookup', ownKey: 'mechaniker', lookupKey: 'stundensatz' }, right: { kind: 'field', key: 'dauer_stunden' } },
    '_teilkosten': { op: 'mul', left: { kind: 'applookup', ownKey: 'teil', lookupKey: 'verkaufspreis' }, right: { kind: 'field', key: 'menge' } },
    'gesamtpreis': (_fields, ctx) => {
      const typ = ctx.lookupKey('positionstyp');
      if (typ === 'arbeit') {
        return (ctx.applookup('mechaniker', 'stundensatz') ?? 0) * (ctx.num('dauer_stunden') ?? 0);
      } else if (typ === 'teil') {
        return (ctx.applookup('teil', 'verkaufspreis') ?? 0) * (ctx.num('menge') ?? 0);
      } else {
        return ctx.num('einzelpreis') ?? 0;
      }
    },
  },
};

// Build-time-populated field dependencies for MODUS-2 arrow functions in
// `computed`. The sub-agent leaves this empty; scripts/parse-formulas.mjs
// fills it after Step 0 by regex-extracting ctx.* calls from each function
// body. The dialog feeds these into classifyComputed so MODUS-2 entries get
// inline anchors instead of always landing in the aggregate section.
export const computedDeps: Record<string, string[]> = {
  'gesamtpreis': ['dauer_stunden', 'menge', 'einzelpreis', 'mechaniker', 'teil', 'positionstyp'],
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
