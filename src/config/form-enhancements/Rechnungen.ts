import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'rechnungsnummer',
    'auftrag',
    'kunde',
    { row: ['rechnungsdatum', 'faelligkeit'] },
    { row: ['nettobetrag', 'mwst', 'bruttobetrag'], cols: '1fr 1fr 1fr' },
    'status',
    'zahlungseingang',
  ],
  defaults: {
    'rechnungsdatum': { kind: 'today' },
    'faelligkeit': { kind: 'todayOffset', days: 14 },
    'status': { kind: 'lookup', key: 'offen', label: 'Offen' },
    'nettobetrag': { kind: 'literal', value: 0 },
  },
  computed: {
    'mwst': { op: 'mul', left: { kind: 'field', key: 'nettobetrag' }, right: { kind: 'literal', value: 0.19 } },
    'bruttobetrag': { op: 'add', left: { kind: 'field', key: 'nettobetrag' }, right: { kind: 'field', key: 'mwst' } },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
