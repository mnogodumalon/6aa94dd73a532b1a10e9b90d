import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Kunden, Mitarbeiter, Teilebestand, Fahrzeuge, Auftraege, Auftragspositionen, Rechnungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
/** Entities this hook can load — the same keys the journey layer uses. */
export type DashboardEntity = 'kunden' | 'mitarbeiter' | 'teilebestand' | 'fahrzeuge' | 'auftraege' | 'auftragspositionen' | 'rechnungen';

export interface DashboardDataOptions {
  /** Entities this page does NOT need (picked through useRecordSearch instead).
   *  Every flow page mounts this hook on its own route, so without `omit` a
   *  page that searches 3.000 guests server-side would still pull all 3.000
   *  through the side door. */
  omit?: DashboardEntity[];
}

export function useDashboardData(options: DashboardDataOptions = {}) {
  // A string key, not the array: an inline `omit={['gaeste']}` is a new array
  // on every render and would restart the fetch forever.
  const omitKey = (options.omit ?? []).slice().sort().join('|');
  const [kunden, setKunden] = useState<Kunden[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [teilebestand, setTeilebestand] = useState<Teilebestand[]>([]);
  const [fahrzeuge, setFahrzeuge] = useState<Fahrzeuge[]>([]);
  const [auftraege, setAuftraege] = useState<Auftraege[]>([]);
  const [auftragspositionen, setAuftragspositionen] = useState<Auftragspositionen[]>([]);
  const [rechnungen, setRechnungen] = useState<Rechnungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    try {
      const [kundenData, mitarbeiterData, teilebestandData, fahrzeugeData, auftraegeData, auftragspositionenData, rechnungenData] = await Promise.all([
        omit.has('kunden') ? Promise.resolve([] as Kunden[]) : LivingAppsService.getKunden(),
        omit.has('mitarbeiter') ? Promise.resolve([] as Mitarbeiter[]) : LivingAppsService.getMitarbeiter(),
        omit.has('teilebestand') ? Promise.resolve([] as Teilebestand[]) : LivingAppsService.getTeilebestand(),
        omit.has('fahrzeuge') ? Promise.resolve([] as Fahrzeuge[]) : LivingAppsService.getFahrzeuge(),
        omit.has('auftraege') ? Promise.resolve([] as Auftraege[]) : LivingAppsService.getAuftraege(),
        omit.has('auftragspositionen') ? Promise.resolve([] as Auftragspositionen[]) : LivingAppsService.getAuftragspositionen(),
        omit.has('rechnungen') ? Promise.resolve([] as Rechnungen[]) : LivingAppsService.getRechnungen(),
      ]);
      setKunden(kundenData);
      setMitarbeiter(mitarbeiterData);
      setTeilebestand(teilebestandData);
      setFahrzeuge(fahrzeugeData);
      setAuftraege(auftraegeData);
      setAuftragspositionen(auftragspositionenData);
      setRechnungen(rechnungenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, [omitKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    async function silentRefresh() {
      try {
        const [kundenData, mitarbeiterData, teilebestandData, fahrzeugeData, auftraegeData, auftragspositionenData, rechnungenData] = await Promise.all([
          omit.has('kunden') ? Promise.resolve([] as Kunden[]) : LivingAppsService.getKunden(),
          omit.has('mitarbeiter') ? Promise.resolve([] as Mitarbeiter[]) : LivingAppsService.getMitarbeiter(),
          omit.has('teilebestand') ? Promise.resolve([] as Teilebestand[]) : LivingAppsService.getTeilebestand(),
          omit.has('fahrzeuge') ? Promise.resolve([] as Fahrzeuge[]) : LivingAppsService.getFahrzeuge(),
          omit.has('auftraege') ? Promise.resolve([] as Auftraege[]) : LivingAppsService.getAuftraege(),
          omit.has('auftragspositionen') ? Promise.resolve([] as Auftragspositionen[]) : LivingAppsService.getAuftragspositionen(),
          omit.has('rechnungen') ? Promise.resolve([] as Rechnungen[]) : LivingAppsService.getRechnungen(),
        ]);
        setKunden(kundenData);
        setMitarbeiter(mitarbeiterData);
        setTeilebestand(teilebestandData);
        setFahrzeuge(fahrzeugeData);
        setAuftraege(auftraegeData);
        setAuftragspositionen(auftragspositionenData);
        setRechnungen(rechnungenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    // assistant:data-changed comes from the assistant (<la-klar-assistant>)
    // after every mutation. The element additionally fires the legacy
    // dashboard-refresh event for OLD deployed bundles — do NOT subscribe to
    // both here, or every mutation fetches twice.
    window.addEventListener('assistant:data-changed', handleRefresh);
    return () => window.removeEventListener('assistant:data-changed', handleRefresh);
  }, [omitKey]);

  const kundenMap = useMemo(() => {
    const m = new Map<string, Kunden>();
    kunden.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kunden]);

  const mitarbeiterMap = useMemo(() => {
    const m = new Map<string, Mitarbeiter>();
    mitarbeiter.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitarbeiter]);

  const teilebestandMap = useMemo(() => {
    const m = new Map<string, Teilebestand>();
    teilebestand.forEach(r => m.set(r.record_id, r));
    return m;
  }, [teilebestand]);

  const fahrzeugeMap = useMemo(() => {
    const m = new Map<string, Fahrzeuge>();
    fahrzeuge.forEach(r => m.set(r.record_id, r));
    return m;
  }, [fahrzeuge]);

  const auftraegeMap = useMemo(() => {
    const m = new Map<string, Auftraege>();
    auftraege.forEach(r => m.set(r.record_id, r));
    return m;
  }, [auftraege]);

  return { kunden, setKunden, mitarbeiter, setMitarbeiter, teilebestand, setTeilebestand, fahrzeuge, setFahrzeuge, auftraege, setAuftraege, auftragspositionen, setAuftragspositionen, rechnungen, setRechnungen, loading, error, fetchAll, kundenMap, mitarbeiterMap, teilebestandMap, fahrzeugeMap, auftraegeMap };
}

/** The hook's return — the `data` prop of DashboardOverview in the Ready-Wrapper form. */
export type DashboardData = ReturnType<typeof useDashboardData>;