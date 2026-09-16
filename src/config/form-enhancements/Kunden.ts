import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ['vorname', 'nachname', 'kundentyp', 'telefon', 'email', { row: ['strasse', 'hausnummer'] }, { row: ['plz', 'ort'] }, 'notizen'],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
