import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'kennzeichen',
    'marke',
    'modell',
    'erstzulassung',
    'kilometerstand',
    'fahrgestellnummer',
    'hu_faellig',
    'halter',
  ],
  defaults: {
    'hu_faellig': { kind: 'todayOffset', days: 365 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
