import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'rechnungsnummer',
    'auftrag',
    'kunde',
    'rechnungsdatum',
    'faelligkeit',
    'nettobetrag',
    'mwst',
    'bruttobetrag',
    'status',
    'zahlungseingang',
  ],
  defaults: {
    'rechnungsdatum': { kind: 'today' },
    'faelligkeit': { kind: 'todayOffset', days: 14 },
    'status': { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {
    'mwst': { op: 'mul', left: { kind: 'field', key: 'nettobetrag' }, right: { kind: 'literal', value: 0.19 } },
    'bruttobetrag': { op: 'add', left: { kind: 'field', key: 'nettobetrag' }, right: { kind: 'field', key: 'mwst' } },
    '_tage_bis_faelligkeit': { kind: 'dateDiff', from: 'rechnungsdatum', to: 'faelligkeit', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
