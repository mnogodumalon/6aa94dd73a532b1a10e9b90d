import type { EnrichedAuftraege, EnrichedAuftragspositionen, EnrichedFahrzeuge, EnrichedRechnungen } from '@/types/enriched';
import type { Auftraege, Auftragspositionen, Fahrzeuge, Kunden, Mitarbeiter, Rechnungen, Teilebestand } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface FahrzeugeMaps {
  kundenMap: Map<string, Kunden>;
}

export function enrichFahrzeuge(
  fahrzeuge: Fahrzeuge[],
  maps: FahrzeugeMaps
): EnrichedFahrzeuge[] {
  return fahrzeuge.map(r => ({
    ...r,
    halterName: resolveDisplay(r.fields.halter, maps.kundenMap, 'vorname', 'nachname'),
  }));
}

interface AuftraegeMaps {
  fahrzeugeMap: Map<string, Fahrzeuge>;
  mitarbeiterMap: Map<string, Mitarbeiter>;
}

export function enrichAuftraege(
  auftraege: Auftraege[],
  maps: AuftraegeMaps
): EnrichedAuftraege[] {
  return auftraege.map(r => ({
    ...r,
    fahrzeugName: resolveDisplay(r.fields.fahrzeug, maps.fahrzeugeMap, 'kennzeichen'),
    mechanikerName: resolveDisplay(r.fields.mechaniker, maps.mitarbeiterMap, 'vorname', 'nachname'),
  }));
}

interface AuftragspositionenMaps {
  auftraegeMap: Map<string, Auftraege>;
  mitarbeiterMap: Map<string, Mitarbeiter>;
  teilebestandMap: Map<string, Teilebestand>;
}

export function enrichAuftragspositionen(
  auftragspositionen: Auftragspositionen[],
  maps: AuftragspositionenMaps
): EnrichedAuftragspositionen[] {
  return auftragspositionen.map(r => ({
    ...r,
    auftragName: resolveDisplay(r.fields.auftrag, maps.auftraegeMap, 'auftragsnummer'),
    mechanikerName: resolveDisplay(r.fields.mechaniker, maps.mitarbeiterMap, 'vorname', 'nachname'),
    teilName: resolveDisplay(r.fields.teil, maps.teilebestandMap, 'artikelnummer'),
  }));
}

interface RechnungenMaps {
  auftraegeMap: Map<string, Auftraege>;
  kundenMap: Map<string, Kunden>;
}

export function enrichRechnungen(
  rechnungen: Rechnungen[],
  maps: RechnungenMaps
): EnrichedRechnungen[] {
  return rechnungen.map(r => ({
    ...r,
    auftragName: resolveDisplay(r.fields.auftrag, maps.auftraegeMap, 'auftragsnummer'),
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenMap, 'vorname', 'nachname'),
  }));
}
