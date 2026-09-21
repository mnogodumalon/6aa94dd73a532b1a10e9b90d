import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'artikelnummer',
    'bezeichnung',
    'hersteller',
    { row: ['einkaufspreis', 'verkaufspreis'], cols: '1fr 1fr' },
    { row: ['bestand', 'mindestbestand'], cols: '1fr 1fr' },
    'lagerplatz',
  ],
  defaults: {
    'bestand': { kind: 'literal', value: 0 },
    'mindestbestand': { kind: 'literal', value: 1 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
