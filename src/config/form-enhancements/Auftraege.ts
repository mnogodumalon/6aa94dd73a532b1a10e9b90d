import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'auftragsnummer',
    'fahrzeug',
    'halter',
    { row: ['annahmedatum', 'fertigstellungstermin'] },
    'status',
    'mechaniker',
    'kilometerstand_annahme',
    'kundenwunsch',
    'notizen',
  ],
  defaults: {
    'annahmedatum': { kind: 'today' },
    'fertigstellungstermin': { kind: 'todayOffset', days: 7 },
    'status': { kind: 'lookup', key: 'angenommen', label: 'Angenommen' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
