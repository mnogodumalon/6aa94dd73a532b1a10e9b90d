import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { format, parseISO, isAfter, isBefore, addMonths } from 'date-fns';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import { LOOKUP_OPTIONS } from '@/types/app';
import {
  IconAlertTriangle,
  IconClock,
  IconTools,
  IconFileInvoice,
  IconPackage,
  IconUser,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    auftraege, rechnungen, teilebestand, fahrzeuge, mitarbeiter,
    auftraegeMap, fahrzeugeMap, mitarbeiterMap, kundenMap,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftraege') {
        const statusKey = lookupKey(top.record.fields.status);
        const nextStatus: Record<string, string> = {
          angenommen: 'in_arbeit',
          in_arbeit: 'fertig',
          fertig: 'abgerechnet',
          abgerechnet: 'abgeholt',
        };
        const next = statusKey ? nextStatus[statusKey] : undefined;
        if (!next) return undefined;
        const nextLabel = lookupOption('auftraege', 'status', next).label;
        return {
          label: tx`→ ${nextLabel}`,
          onClick: () => advanceAuftrag(top.record.record_id, statusKey!, next),
        };
      }
      if (top.type === 'rechnungen') {
        const statusKey = lookupKey(top.record.fields.status);
        if (statusKey !== 'offen') return undefined;
        return {
          label: tx('Als bezahlt markieren'),
          onClick: () => markRechnungBezahlt(top.record.record_id),
        };
      }
      return undefined;
    },
  });

  const enrichedAuftraege = crud.enriched.auftraege;
  const enrichedRechnungen = crud.enriched.rechnungen;

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const nextMonth = format(addMonths(clock, 1), 'yyyy-MM-dd');

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // --- Computed data ---
  const offeneAuftraege = useMemo(
    () => enrichedAuftraege.filter(a => {
      const s = lookupKey(a.fields.status);
      return s && ['angenommen', 'in_arbeit', 'fertig'].includes(s);
    }),
    [enrichedAuftraege]
  );

  const fertigOhneRechnung = useMemo(() => {
    const rechnungsAuftragIds = new Set(
      rechnungen
        .filter(r => lookupKey(r.fields.status) !== 'storniert')
        .map(r => extractRecordId(r.fields.auftrag))
        .filter(Boolean) as string[]
    );
    return enrichedAuftraege.filter(a =>
      lookupKey(a.fields.status) === 'fertig' &&
      !rechnungsAuftragIds.has(a.record_id)
    );
  }, [enrichedAuftraege, rechnungen]);

  const offeneRechnungen = useMemo(
    () => enrichedRechnungen.filter(r => lookupKey(r.fields.status) === 'offen'),
    [enrichedRechnungen]
  );

  const ueberfaelligeRechnungen = useMemo(
    () => offeneRechnungen.filter(r => r.fields.faelligkeit && r.fields.faelligkeit < today),
    [offeneRechnungen, today]
  );

  const teileUnterMindest = useMemo(
    () => teilebestand.filter(t =>
      (t.fields.bestand ?? 0) < (t.fields.mindestbestand ?? 1)
    ),
    [teilebestand]
  );

  const huFaelligNaechsterMonat = useMemo(
    () => fahrzeuge.filter(f =>
      f.fields.hu_faellig &&
      f.fields.hu_faellig >= today &&
      f.fields.hu_faellig <= nextMonth
    ),
    [fahrzeuge, today, nextMonth]
  );

  const krankeOderUrlauber = useMemo(
    () => mitarbeiter.filter(m => {
      const s = lookupKey(m.fields.status);
      return s === 'krank' || s === 'urlaub';
    }),
    [mitarbeiter]
  );

  const inArbeit = useMemo(
    () => offeneAuftraege.filter(a => lookupKey(a.fields.status) === 'in_arbeit'),
    [offeneAuftraege]
  );

  // --- Advance Auftrag helper ---
  function advanceAuftrag(id: string, _currentKey: string, nextKey: string) {
    const prev = auftraege.find(a => a.record_id === id);
    if (!prev) return;
    const prevSnap = { ...prev };
    // optimistic
    data.setAuftraege(auftraege.map(a =>
      a.record_id === id
        ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', nextKey) } }
        : a
    ));
    const nextLabel = lookupOption('auftraege', 'status', nextKey).label;
    LivingAppsService.updateAuftraegeEntry(id, { status: nextKey }).catch(() => {
      data.setAuftraege(auftraege.map(a => a.record_id === id ? prevSnap : a));
      fetchAll();
    });
    undoToast(tx`Auftrag → ${nextLabel}`, () => {
      data.setAuftraege(auftraege.map(a => a.record_id === id ? prevSnap : a));
      LivingAppsService.updateAuftraegeEntry(id, { status: _currentKey }).catch(() => fetchAll());
    });
  }

  // --- Mark Rechnung bezahlt helper ---
  function markRechnungBezahlt(id: string) {
    const prev = rechnungen.find(r => r.record_id === id);
    if (!prev) return;
    const prevSnap = { ...prev };
    data.setRechnungen(rechnungen.map(r =>
      r.record_id === id
        ? { ...r, fields: { ...r.fields, status: lookupOption('rechnungen', 'status', 'bezahlt'), zahlungseingang: today } }
        : r
    ));
    LivingAppsService.updateRechnungenEntry(id, { status: 'bezahlt', zahlungseingang: today }).catch(() => {
      data.setRechnungen(rechnungen.map(r => r.record_id === id ? prevSnap : r));
      fetchAll();
    });
    undoToast(tx('Rechnung als bezahlt markiert'), () => {
      data.setRechnungen(rechnungen.map(r => r.record_id === id ? prevSnap : r));
      LivingAppsService.updateRechnungenEntry(id, { status: 'offen', zahlungseingang: undefined }).catch(() => fetchAll());
    });
  }

  // --- Kanban ---
  const columns: KanbanColumn[] = (LOOKUP_OPTIONS['auftraege']?.['status'] ?? [])
    .filter(o => ['angenommen', 'in_arbeit', 'fertig'].includes(o.key))
    .map(o => ({ key: o.key, label: o.label }));

  const filteredAuftraege = useMemo(
    () => statusFilter ? offeneAuftraege.filter(a => lookupKey(a.fields.status) === statusFilter) : offeneAuftraege,
    [offeneAuftraege, statusFilter]
  );

  const cards: KanbanCard[] = filteredAuftraege.map(a => {
    const statusKey = lookupKey(a.fields.status) ?? 'angenommen';
    const isUeberfaellig = a.fields.fertigstellungstermin && a.fields.fertigstellungstermin < today && statusKey !== 'fertig';
    return {
      id: `auftrag:${a.record_id}`,
      column: statusKey,
      title: <span className="font-medium">{a.fahrzeugName || a.fields.auftragsnummer}</span>,
      subtitle: (
        <span className="flex flex-col gap-0.5">
          {a.mechanikerName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <IconUser size={11} className="shrink-0" />
              {a.mechanikerName}
            </span>
          )}
          {a.fields.fertigstellungstermin && (
            <span className={`text-xs flex items-center gap-1 ${isUeberfaellig ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              <IconClock size={11} className="shrink-0" />
              {formatDate(a.fields.fertigstellungstermin)}
            </span>
          )}
          {a.fields.kundenwunsch && (
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">{a.fields.kundenwunsch.split('\n')[0]}</span>
          )}
        </span>
      ),
      tone: isUeberfaellig ? 'destructive' : statusKey === 'fertig' ? 'success' : 'default',
    };
  });

  function handleCardMove(cardId: string, newColumn: string) {
    const id = cardId.split(':')[1];
    const auftrag = auftraege.find(a => a.record_id === id);
    if (!auftrag) return;
    const prevStatus = lookupKey(auftrag.fields.status) ?? 'angenommen';
    const prevSnap = { ...auftrag };

    // optimistic
    data.setAuftraege(auftraege.map(a =>
      a.record_id === id
        ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', newColumn) } }
        : a
    ));
    const newLabel = lookupOption('auftraege', 'status', newColumn).label;
    LivingAppsService.updateAuftraegeEntry(id, { status: newColumn }).catch(() => {
      data.setAuftraege(auftraege.map(a => a.record_id === id ? prevSnap : a));
      fetchAll();
    });
    undoToast(tx`Auftrag → ${newLabel}`, () => {
      data.setAuftraege(auftraege.map(a => a.record_id === id ? prevSnap : a));
      LivingAppsService.updateAuftraegeEntry(id, { status: prevStatus }).catch(() => fetchAll());
    });
  }

  // --- Context line ---
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (inArbeit.length > 0) {
      const names = inArbeit.slice(0, 3).map(a => a.fahrzeugName || a.fields.auftragsnummer || '').filter(Boolean);
      parts.push(namen(names));
    }
    if (krankeOderUrlauber.length > 0) {
      const ks = krankeOderUrlauber.map(m => m.fields.vorname || '').filter(Boolean);
      parts.push(namen(ks) + (krankeOderUrlauber.length === 1 ? tx(' ist heute nicht da') : tx(' sind heute nicht da')));
    }
    return parts.length > 0 ? parts.join(' · ') : tx('Keine offenen Aufträge in der Werkstatt.');
  }, [inArbeit, krankeOderUrlauber]);

  // --- Hero: fertig ohne Rechnung ---
  const heroAuftrag = fertigOhneRechnung[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          onClick={() => crud.auftraege.openCreate({ status: 'angenommen' })}
        >
          <IconTools size={16} className="shrink-0" />
          {tx('Neuer Auftrag')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroAuftrag && (
          <HeroBanner
            icon={<IconFileInvoice size={18} />}
            action={{
              label: tx('Rechnung erstellen'),
              onClick: () => {
                const fahrzeugId = extractRecordId(heroAuftrag.fields.fahrzeug);
                const fahrzeug = fahrzeugId ? fahrzeugeMap.get(fahrzeugId) : undefined;
                const halterId = fahrzeug ? extractRecordId(fahrzeug.fields.halter) : undefined;
                crud.rechnungen.openCreate({
                  auftrag: heroAuftrag.record_id,
                  kunde: halterId ?? undefined,
                });
              },
            }}
          >
            {fertigOhneRechnung.length === 1
              ? tx`${heroAuftrag.fahrzeugName || heroAuftrag.fields.auftragsnummer || ''} ist fertig — noch keine Rechnung gestellt.`
              : tx`${String(fertigOhneRechnung.length)} Aufträge fertig — noch keine Rechnung gestellt.`}
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('In Arbeit')}
              value={inArbeit.length}
              icon={<IconTools size={16} className="shrink-0" />}
              tone="primary"
            />
            <StatStripItem
              title={tx('Offene Rechnungen')}
              value={offeneRechnungen.length}
              icon={<IconFileInvoice size={16} className="shrink-0" />}
              tone={ueberfaelligeRechnungen.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Teile nachbestellen')}
              value={teileUnterMindest.length}
              icon={<IconPackage size={16} className="shrink-0" />}
              tone={teileUnterMindest.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('HU nächster Monat')}
              value={huFaelligNaechsterMonat.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={huFaelligNaechsterMonat.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={columns}
            cards={cards}
            defaultCollapsed={[]}
            onCardClick={(card) => {
              const id = card.id.split(':')[1];
              const auftrag = auftraege.find(a => a.record_id === id);
              if (auftrag) crud.auftraege.openDetail(auftrag);
            }}
            onCardMove={handleCardMove}
            onAddCard={(column) => crud.auftraege.openCreate({ status: column })}
          />
        }
        aside={<>
          <WorkList
            title={tx('Offene Rechnungen')}
            items={offeneRechnungen
              .sort((a, b) => (a.fields.faelligkeit ?? '9999') > (b.fields.faelligkeit ?? '9999') ? 1 : -1)
              .map(r => {
                const isOverdue = r.fields.faelligkeit && r.fields.faelligkeit < today;
                return {
                  id: r.record_id,
                  title: r.kundeName || r.fields.rechnungsnummer || '—',
                  secondLine: (
                    <>
                      {r.fields.bruttobetrag != null && (
                        <span className="font-medium">{formatCurrency(r.fields.bruttobetrag)}</span>
                      )}
                      {r.fields.faelligkeit && (
                        <span className={`text-xs ml-2 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {isOverdue ? tx('überfällig') : tx('fällig')} {formatDate(r.fields.faelligkeit)}
                        </span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Bezahlt'),
                    onClick: () => markRechnungBezahlt(r.record_id),
                  },
                };
              })}
            onItemClick={(id) => {
              const r = rechnungen.find(x => x.record_id === id);
              if (r) crud.rechnungen.openDetail(r);
            }}
            empty={{
              text: tx('Alle Rechnungen bezahlt.'),
              action: { label: tx('Neue Rechnung'), onClick: () => crud.rechnungen.openCreate({}) },
            }}
          />

          <WorkList
            title={tx('Teile nachbestellen')}
            items={teileUnterMindest.map(t => ({
              id: t.record_id,
              title: t.fields.bezeichnung || t.fields.artikelnummer || '—',
              secondLine: (
                <>
                  <span className="text-xs text-muted-foreground">{t.fields.hersteller}</span>
                  <span className="text-xs text-amber-600 font-medium ml-2">
                    {tx`${String(t.fields.bestand ?? 0)} von ${String(t.fields.mindestbestand ?? 0)} Stück`}
                  </span>
                </>
              ),
              action: {
                label: tx('Bestand anpassen'),
                onClick: () => crud.teilebestand.openEdit(t),
              },
            }))}
            onItemClick={(id) => {
              const t = teilebestand.find(x => x.record_id === id);
              if (t) crud.teilebestand.openDetail(t);
            }}
            empty={{ text: tx('Alle Teile ausreichend bevorratet.') }}
          />
        </>}
      />

      {/* HU-Fälligkeiten + Mitarbeiterstatus — extra info band */}
      {(huFaelligNaechsterMonat.length > 0 || krankeOderUrlauber.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {huFaelligNaechsterMonat.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconAlertTriangle size={16} className="text-amber-500 shrink-0" />
                {tx('HU fällig im nächsten Monat')}
              </div>
              <ul className="space-y-1">
                {huFaelligNaechsterMonat.map(f => {
                  const halterId = extractRecordId(f.fields.halter);
                  const halter = halterId ? kundenMap.get(halterId) : undefined;
                  const halterName = halter ? `${halter.fields.vorname ?? ''} ${halter.fields.nachname ?? ''}`.trim() : '';
                  return (
                    <li
                      key={f.record_id}
                      className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors"
                      onClick={() => crud.fahrzeuge.openDetail(f)}
                    >
                      <span className="font-medium truncate min-w-0 mr-2">{f.fields.kennzeichen} <span className="text-muted-foreground font-normal">{f.fields.marke} {f.fields.modell}</span></span>
                      <span className="text-xs text-amber-600 font-medium shrink-0">{formatDate(f.fields.hu_faellig)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {krankeOderUrlauber.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconUser size={16} className="text-muted-foreground shrink-0" />
                {tx('Mitarbeiter heute nicht da')}
              </div>
              <ul className="space-y-1">
                {krankeOderUrlauber.map(m => {
                  const statusKey = lookupKey(m.fields.status);
                  return (
                    <li
                      key={m.record_id}
                      className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors"
                      onClick={() => crud.mitarbeiter.openDetail(m)}
                    >
                      <span className="font-medium">{m.fields.vorname} {m.fields.nachname}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusKey === 'krank' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700'}`}>
                        {m.fields.status?.label ?? statusKey}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {crud.surfaces}
    </div>
  );
}
