import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'auftrag',
    'positionstyp',
    'bezeichnung',
    { row: ['menge', 'einzelpreis'], cols: '1fr 1fr' },
    'mechaniker',
    'dauer_stunden',
    'teil',
  ],
  defaults: {
    'positionstyp': { kind: 'lookup', key: 'arbeit', label: 'Arbeit' },
    'menge': { kind: 'literal', value: 1 },
    'einzelpreis': { kind: 'literal', value: 0 },
    'dauer_stunden': { kind: 'literal', value: 0 },
  },
  computed: {
    'positionskosten': { op: 'mul', left: { kind: 'field', key: 'menge' }, right: { kind: 'field', key: 'einzelpreis' } },
    'arbeitskosten': (_fields, ctx) => {
      if (ctx.lookupKey('positionstyp') !== 'arbeit') return 0;
      const stunden = ctx.num('dauer_stunden');
      const satz = ctx.applookup('mechaniker', 'stundensatz') ?? 0;
      return stunden * satz;
    },
    'teil_kosten': (_fields, ctx) => {
      if (ctx.lookupKey('positionstyp') !== 'teil') return 0;
      const menge = ctx.num('menge');
      const preis = ctx.applookup('teil', 'verkaufspreis') ?? 0;
      return menge * preis;
    },
    '_position_gesamt': (_fields, ctx) => {
      const p = ctx.num('positionskosten');
      const a = ctx.num('arbeitskosten');
      const t = ctx.num('teil_kosten');
      return p + a + t;
    },
  },
};

export const computedDeps: Record<string, string[]> = {
  'arbeitskosten': ['dauer_stunden', 'mechaniker', 'positionstyp'],
  'teil_kosten': ['menge', 'teil', 'positionstyp'],
  '_position_gesamt': ['positionskosten', 'arbeitskosten', 'teil_kosten'],
};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {
  'mechaniker': [{ lookupKey: 'stundensatz' }],
  'teil': [{ lookupKey: 'verkaufspreis' }],
};
