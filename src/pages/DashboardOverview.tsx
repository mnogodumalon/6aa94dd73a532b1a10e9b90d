import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate, formatCurrency } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import { format, parseISO, isAfter, isBefore, isToday, addDays } from 'date-fns';
import {
  IconAlertTriangle,
  IconTools,
  IconClipboardList,
  IconCar,
  IconCurrencyEuro,
  IconPlus,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    auftraege, setAuftraege, rechnungen, mitarbeiter, fahrzeuge, kunden,
    fahrzeugeMap, mitarbeiterMap, kundenMap,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftraege') {
        const rec = top.record;
        const statusKey = lookupKey(rec.fields.status);
        const nextStatus = STATUS_FLOW[statusKey ?? ''];
        if (!nextStatus) return undefined;
        const nextLabel = LOOKUP_OPTIONS['auftraege']?.['status']?.find(o => o.key === nextStatus)?.label ?? nextStatus;
        return {
          label: tx`→ ${nextLabel}`,
          onClick: () => void advanceAuftrag(rec.record_id, statusKey ?? '', rec),
        };
      }
      return undefined;
    },
  });

  const clock = useClock();

  // Status workflow
  const STATUS_FLOW: Record<string, string> = {
    angenommen: 'in_arbeit',
    in_arbeit: 'fertig',
    fertig: 'abgerechnet',
    abgerechnet: 'abgeholt',
  };

  const enrichedAuftraege = crud.enriched.auftraege;
  const enrichedRechnungen = crud.enriched.rechnungen;

  // KPI derivations
  const today = format(clock, 'yyyy-MM-dd');

  const offeneAuftraege = useMemo(
    () => auftraege.filter(a => {
      const s = lookupKey(a.fields.status);
      return s === 'angenommen' || s === 'in_arbeit';
    }),
    [auftraege],
  );

  const fertigeAuftraege = useMemo(
    () => auftraege.filter(a => lookupKey(a.fields.status) === 'fertig'),
    [auftraege],
  );

  // Überfällig: fertigstellungstermin vergangen + noch nicht fertig/abgerechnet/abgeholt
  const ueberfaellig = useMemo(
    () => auftraege.filter(a => {
      const s = lookupKey(a.fields.status);
      if (s === 'fertig' || s === 'abgerechnet' || s === 'abgeholt') return false;
      if (!a.fields.fertigstellungstermin) return false;
      try {
        return isBefore(parseISO(a.fields.fertigstellungstermin), parseISO(today));
      } catch {
        return false;
      }
    }),
    [auftraege, today],
  );

  const offeneRechnungen = useMemo(
    () => enrichedRechnungen.filter(r => lookupKey(r.fields.status) === 'offen'),
    [enrichedRechnungen],
  );

  const ueberfaelligeRechnungen = useMemo(
    () => offeneRechnungen.filter(r => {
      if (!r.fields.faelligkeit) return false;
      try { return isBefore(parseISO(r.fields.faelligkeit), parseISO(today)); } catch { return false; }
    }),
    [offeneRechnungen, today],
  );

  const teileNiedrig = useMemo(
    () => data.teilebestand.filter(t => (t.fields.bestand ?? 0) <= (t.fields.mindestbestand ?? 0) && (t.fields.mindestbestand ?? 0) > 0),
    [data.teilebestand],
  );

  // Advance helper — shared across board, worklist and overlay footer
  const advanceAuftrag = async (id: string, currentStatus: string, record: typeof auftraege[0]) => {
    const nextStatus = STATUS_FLOW[currentStatus];
    if (!nextStatus) return;
    const snapshot = auftraege;
    setAuftraege(prev =>
      prev.map(a =>
        a.record_id === id
          ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', nextStatus) } }
          : a,
      ),
    );
    const nextLabel = LOOKUP_OPTIONS['auftraege']?.['status']?.find(o => o.key === nextStatus)?.label ?? nextStatus;
    undoToast(tx`${record.fields.auftragsnummer ?? ''} → ${nextLabel}`, async () => {
      setAuftraege(snapshot);
      try {
        await LivingAppsService.updateAuftraegeEntry(id, { status: currentStatus });
      } catch {
        await fetchAll();
      }
    });
    try {
      await LivingAppsService.updateAuftraegeEntry(id, { status: nextStatus });
    } catch {
      setAuftraege(snapshot);
      await fetchAll();
    }
  };

  // Columns from schema
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['auftraege']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // Tone helper
  function toneForStatus(status: string | undefined): KanbanTone {
    if (status === 'fertig') return 'success';
    if (status === 'in_arbeit') return 'primary';
    if (status === 'abgerechnet') return 'warning';
    if (status === 'abgeholt') return 'default';
    return 'warning'; // angenommen → needs attention
  }

  // Kanban cards
  const cards = useMemo<KanbanCard[]>(
    () =>
      enrichedAuftraege.map(a => {
        const status = lookupKey(a.fields.status) ?? COLUMNS[0]?.key ?? '';
        const fahrzeugId = a.fields.fahrzeug ? a.fields.fahrzeug.split('/').pop() : undefined;
        const fahrzeug = fahrzeugId ? fahrzeugeMap.get(fahrzeugId) : undefined;
        const isOverdue = ueberfaellig.some(u => u.record_id === a.record_id);
        return {
          id: `auftrag:${a.record_id}`,
          column: status,
          title: a.fahrzeugName || tx('Fahrzeug unbekannt'),
          subtitle: [
            a.mechanikerName || undefined,
            a.fields.fertigstellungstermin ? formatDate(a.fields.fertigstellungstermin) : undefined,
          ].filter(Boolean).join(' · '),
          tone: isOverdue ? 'destructive' as KanbanTone : toneForStatus(status),
          meta: a.fields.auftragsnummer,
        };
      }),
    [enrichedAuftraege, fahrzeugeMap, COLUMNS, ueberfaellig],
  );

  // Card move handler
  const handleCardMove = async (cardId: string, newColumn: string) => {
    const id = cardId.split(':')[1];
    if (!id) return;
    const auftrag = auftraege.find(a => a.record_id === id);
    if (!auftrag) return;
    const currentStatus = lookupKey(auftrag.fields.status) ?? '';
    // Enforce workflow: can only advance forward
    const statusOrder = ['angenommen', 'in_arbeit', 'fertig', 'abgerechnet', 'abgeholt'];
    const currentIdx = statusOrder.indexOf(currentStatus);
    const newIdx = statusOrder.indexOf(newColumn);
    if (newIdx < currentIdx) {
      return tx('Status kann nicht zurückgesetzt werden.');
    }
    const snapshot = auftraege;
    setAuftraege(prev =>
      prev.map(a =>
        a.record_id === id
          ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', newColumn) } }
          : a,
      ),
    );
    const newLabel = LOOKUP_OPTIONS['auftraege']?.['status']?.find(o => o.key === newColumn)?.label ?? newColumn;
    undoToast(tx`${auftrag.fields.auftragsnummer ?? ''} → ${newLabel}`, async () => {
      setAuftraege(snapshot);
      try {
        await LivingAppsService.updateAuftraegeEntry(id, { status: currentStatus });
      } catch {
        await fetchAll();
      }
    });
    try {
      await LivingAppsService.updateAuftraegeEntry(id, { status: newColumn });
    } catch {
      setAuftraege(snapshot);
      await fetchAll();
    }
  };

  // Context line
  const ueberfaelligNames = ueberfaellig.map(a => {
    const fahrzeugId = a.fields.fahrzeug?.split('/').pop();
    const fahrzeug = fahrzeugId ? fahrzeugeMap.get(fahrzeugId) : undefined;
    return fahrzeug?.fields.kennzeichen ?? a.fields.auftragsnummer ?? '';
  });

  const contextLine = useMemo(() => {
    if (auftraege.length === 0) return tx('Noch keine Aufträge — lege deinen ersten Auftrag an.');
    if (ueberfaellig.length > 0) return tx`${namen(ueberfaelligNames)} — Fertigstellung überfällig.`;
    const inArbeit = auftraege.filter(a => lookupKey(a.fields.status) === 'in_arbeit');
    if (inArbeit.length > 0) {
      const mNames = [...new Set(inArbeit.map(a => {
        const mId = a.fields.mechaniker?.split('/').pop();
        const m = mId ? mitarbeiterMap.get(mId) : undefined;
        return m?.fields.vorname ?? '';
      }).filter(Boolean))];
      return tx`${mNames.length > 0 ? namen(mNames) : String(inArbeit.length)} ${inArbeit.length === 1 ? tx('Auftrag in Arbeit') : tx('Aufträge in Arbeit')}.`;
    }
    return tx`${String(offeneAuftraege.length)} ${offeneAuftraege.length === 1 ? tx('offener Auftrag') : tx('offene Aufträge')} in der Werkstatt.`;
  }, [auftraege, ueberfaellig, ueberfaelligNames, offeneAuftraege, mitarbeiterMap]);

  // Aside 1: Fällig heute oder überfällig
  const faelligHeute = useMemo(() => {
    const inWork = auftraege.filter(a => {
      const s = lookupKey(a.fields.status);
      if (s === 'abgerechnet' || s === 'abgeholt') return false;
      if (!a.fields.fertigstellungstermin) return false;
      try {
        const d = parseISO(a.fields.fertigstellungstermin);
        return isToday(d) || isBefore(d, parseISO(today));
      } catch { return false; }
    });
    return inWork.sort((a, b) => (a.fields.fertigstellungstermin ?? '').localeCompare(b.fields.fertigstellungstermin ?? ''));
  }, [auftraege, today]);

  const enrichedFaelligHeute = useMemo(
    () => faelligHeute.map(a => crud.enriched.auftraege.find(e => e.record_id === a.record_id) ?? a),
    [faelligHeute, crud.enriched.auftraege],
  );

  // Aside 2: Offene Rechnungen
  const nextNaechsteRechnung = useMemo(() => {
    if (offeneRechnungen.length === 0) return null;
    const sorted = [...offeneRechnungen].sort((a, b) => (a.fields.faelligkeit ?? '').localeCompare(b.fields.faelligkeit ?? ''));
    return sorted[0];
  }, [offeneRechnungen]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.auftraege.openCreate({ annahmedatum: format(clock, 'yyyy-MM-dd'), status: 'angenommen' })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neuer Auftrag')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ueberfaellig.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('In Arbeit setzen'),
                onClick: () => {
                  const first = ueberfaellig[0];
                  const s = lookupKey(first.fields.status) ?? '';
                  void advanceAuftrag(first.record_id, s, first);
                },
              }}
            >
              <b>{namen(ueberfaelligNames)}</b>
              {ueberfaellig.length === 1
                ? tx` — Fertigstellung überfällig seit ${formatDate(ueberfaellig[0].fields.fertigstellungstermin)}.`
                : tx` — ${String(ueberfaellig.length)} Aufträge mit überschrittenem Fertigstellungstermin.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen & In Arbeit')}
              value={offeneAuftraege.length}
              icon={<IconTools size={16} className="shrink-0" />}
              tone={offeneAuftraege.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Fertig — wartet')}
              value={fertigeAuftraege.length}
              icon={<IconClipboardList size={16} className="shrink-0" />}
              tone={fertigeAuftraege.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={ueberfaellig.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={ueberfaellig.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Rechnung offen')}
              value={offeneRechnungen.length}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
              tone={ueberfaelligeRechnungen.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={COLUMNS}
            defaultCollapsed={['abgeholt']}
            onCardClick={card => {
              const id = card.id.split(':')[1];
              const rec = auftraege.find(a => a.record_id === id);
              if (rec) crud.auftraege.openDetail(rec);
            }}
            onCardMove={handleCardMove}
            onAddCard={column => crud.auftraege.openCreate({ status: column, annahmedatum: format(clock, 'yyyy-MM-dd') })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Fällig heute & überfällig')}
              items={enrichedFaelligHeute.map(a => {
                const statusKey = lookupKey(a.fields.status) ?? '';
                const isOverdue = ueberfaellig.some(u => u.record_id === a.record_id);
                return {
                  id: a.record_id,
                  title: (('fahrzeugName' in a ? (a as { fahrzeugName: string }).fahrzeugName : '') || a.fields.auftragsnummer || tx('Auftrag')) as string,
                  secondLine: (
                    <>
                      {isOverdue
                        ? <span className="font-medium text-destructive">{tx('Überfällig')}</span>
                        : <span className="font-medium text-amber-600">{tx('Heute fällig')}</span>}
                      {a.fields.fertigstellungstermin && (
                        <span className="text-muted-foreground"> · {formatDate(a.fields.fertigstellungstermin)}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('→ Weiter'),
                    onClick: () => void advanceAuftrag(a.record_id, statusKey, a),
                  },
                };
              })}
              onItemClick={id => {
                const rec = auftraege.find(a => a.record_id === id);
                if (rec) crud.auftraege.openDetail(rec);
              }}
              empty={{
                text: fertigeAuftraege.length > 0
                  ? tx`${String(fertigeAuftraege.length)} ${fertigeAuftraege.length === 1 ? tx('Auftrag fertig') : tx('Aufträge fertig')} — alles im Zeitplan.`
                  : tx('Keine fälligen Aufträge — alles im Zeitplan.'),
                action: { label: tx('Neuer Auftrag'), onClick: () => crud.auftraege.openCreate({ annahmedatum: format(clock, 'yyyy-MM-dd'), status: 'angenommen' }) },
              }}
            />
            <WorkList
              title={tx('Offene Rechnungen')}
              items={offeneRechnungen.slice(0, 8).map(r => {
                const isOverdue = ueberfaelligeRechnungen.some(u => u.record_id === r.record_id);
                return {
                  id: r.record_id,
                  title: r.kundeName || r.fields.rechnungsnummer || tx('Rechnung'),
                  secondLine: (
                    <>
                      {isOverdue
                        ? <span className="font-medium text-destructive">{tx('Fälligkeit überschritten')}</span>
                        : <span className="font-medium text-amber-600">{tx('Offen')}</span>}
                      {r.fields.faelligkeit && (
                        <span className="text-muted-foreground"> · {formatDate(r.fields.faelligkeit)}</span>
                      )}
                      {r.fields.bruttobetrag != null && (
                        <span className="text-muted-foreground"> · {formatCurrency(r.fields.bruttobetrag)}</span>
                      )}
                    </>
                  ),
                };
              })}
              onItemClick={id => {
                const rec = enrichedRechnungen.find(r => r.record_id === id);
                if (rec) crud.rechnungen.openDetail(rec);
              }}
              empty={{
                text: nextNaechsteRechnung
                  ? tx`Nächste Rechnung: ${nextNaechsteRechnung.fields.rechnungsnummer ?? nextNaechsteRechnung.fields.rechnungsnummer ?? ''}`
                  : tx('Alle Rechnungen bezahlt.'),
                action: { label: tx('Neue Rechnung'), onClick: () => crud.rechnungen.openCreate({}) },
              }}
            />
          </>
        }
      />

      {/* Empty state when no orders */}
      {auftraege.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <IconCar size={32} className="text-primary" stroke={1.5} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{tx('Werkstatt startklar!')}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {tx('Lege deinen ersten Auftrag an — wähle ein Fahrzeug, trage den Kundenwunsch ein und starte die Reparatur.')}
            </p>
          </div>
          <button
            onClick={() => crud.auftraege.openCreate({ annahmedatum: format(clock, 'yyyy-MM-dd'), status: 'angenommen' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Ersten Auftrag anlegen')}
          </button>
        </div>
      )}

      {crud.surfaces}
    </div>
  );
}
