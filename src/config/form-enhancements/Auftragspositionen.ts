import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'auftrag',
    'positionstyp',
    'bezeichnung',
    'menge',
    'einzelpreis',
    'mechaniker',
    'dauer_stunden',
    'teil',
  ],
  defaults: {
    'menge': { kind: 'literal', value: 1 },
    'positionstyp': { kind: 'lookup', key: 'teil', label: 'Teil' },
  },
  computed: {
    '_position_gesamt_preis': (_fields, ctx) => {
      const positionstyp = ctx.lookupKey('positionstyp');

      if (positionstyp === 'arbeit') {
        const stundensatz = ctx.applookup('mechaniker', 'stundensatz') ?? 0;
        const dauer = ctx.num('dauer_stunden');
        return stundensatz * dauer;
      }

      if (positionstyp === 'teil') {
        const verkaufspreis = ctx.applookup('teil', 'verkaufspreis') ?? 0;
        const menge = ctx.num('menge');
        return verkaufspreis * menge;
      }

      
      const menge = ctx.num('menge');
      const einzelpreis = ctx.num('einzelpreis');
      return menge * einzelpreis;
    },
  },
};

export const computedDeps: Record<string, string[]> = {
  '_position_gesamt_preis': ['dauer_stunden', 'menge', 'einzelpreis', 'mechaniker', 'teil', 'positionstyp'],
};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {
  'mechaniker': [{ lookupKey: 'stundensatz' }],
  'teil': [{ lookupKey: 'verkaufspreis' }],
};
