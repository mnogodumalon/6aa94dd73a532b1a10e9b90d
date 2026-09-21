import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'auftragsnummer',
    'fahrzeug',
    'annahmedatum',
    'fertigstellungstermin',
    'status',
    'mechaniker',
    'kilometerstand_annahme',
    'kundenwunsch',
    'notizen',
  ],
  defaults: {
    'annahmedatum': { kind: 'today' },
    'status': { kind: 'lookup', key: 'angenommen', label: 'Angenommen' },
  },
  computed: {
    '_auftrag_bearbeitungstage': { kind: 'dateDiff', from: 'annahmedatum', to: 'fertigstellungstermin', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
