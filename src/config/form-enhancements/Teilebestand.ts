import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'artikelnummer',
    'bezeichnung',
    'hersteller',
    'einkaufspreis',
    'verkaufspreis',
    'bestand',
    'mindestbestand',
    'lagerplatz',
  ],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
