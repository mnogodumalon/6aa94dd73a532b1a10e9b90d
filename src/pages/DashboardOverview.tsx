import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate, formatCurrency } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget, type KanbanCard, type KanbanColumn } from '@/components/widgets/KanbanWidget';
import {
  IconAlertTriangle,
  IconPlus,
  IconPackage,
  IconCurrencyEuro,
  IconTool,
  IconCheck,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    auftraege, setAuftraege, rechnungen, teilebestand, mitarbeiter,
    auftraegeMap, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftraege') {
        const r = top.record;
        const status = lookupKey(r.fields.status);
        const next =
          status === 'angenommen' ? { key: 'in_arbeit', label: tx('In Arbeit setzen') } :
          status === 'in_arbeit'  ? { key: 'fertig',    label: tx('Fertig melden') }    :
          status === 'fertig'     ? { key: 'abgerechnet', label: tx('Als abgerechnet markieren') } :
          null;
        if (!next) return undefined;
        return {
          label: next.label,
          onClick: () => void advanceAuftrag(r.record_id, next.key),
        };
      }
      if (top.type === 'rechnungen') {
        const r = top.record;
        if (lookupKey(r.fields.status) === 'offen') {
          return {
            label: tx('Als bezahlt markieren'),
            onClick: () => void markRechnungBezahlt(r.record_id),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedAuftraege = crud.enriched.auftraege;
  const enrichedRechnungen = crud.enriched.rechnungen;

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');

  // --- Advance Auftrag status ---
  const advanceAuftrag = async (id: string, newStatus: string) => {
    const snapshot = [...auftraege];
    setAuftraege(prev =>
      prev.map(a =>
        a.record_id === id
          ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', newStatus) } }
          : a
      )
    );
    const col = (LOOKUP_OPTIONS['auftraege']?.['status'] ?? []).find(o => o.key === newStatus);
    undoToast(tx`Auftrag — ${col?.label ?? newStatus}`, async () => {
      const old = snapshot.find(a => a.record_id === id);
      const oldKey = lookupKey(old?.fields.status) ?? 'angenommen';
      setAuftraege(snapshot);
      await LivingAppsService.updateAuftraegeEntry(id, { status: oldKey });
    });
    try {
      await LivingAppsService.updateAuftraegeEntry(id, { status: newStatus });
    } catch {
      setAuftraege(snapshot);
      await fetchAll();
    }
  };

  // --- Mark Rechnung as bezahlt ---
  const markRechnungBezahlt = async (id: string) => {
    const zahlungseingang = format(clock, 'yyyy-MM-dd');
    undoToast(tx('Rechnung als bezahlt markiert'));
    try {
      await LivingAppsService.updateRechnungenEntry(id, {
        status: 'bezahlt',
        zahlungseingang,
      });
      await fetchAll();
    } catch {
      await fetchAll();
    }
  };

  // --- Kanban columns ---
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['auftraege']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    []
  );

  // --- Kanban cards ---
  const cards = useMemo<KanbanCard[]>(
    () => enrichedAuftraege.map(a => {
      const status = lookupKey(a.fields.status) ?? 'angenommen';
      const isOverdue =
        a.fields.fertigstellungstermin &&
        status !== 'abgeholt' &&
        status !== 'abgerechnet' &&
        isBefore(parseISO(a.fields.fertigstellungstermin), startOfDay(clock));
      return {
        id: `auftrag:${a.record_id}`,
        column: status,
        title: a.fahrzeugName || a.fields.auftragsnummer || tx('Ohne Kennzeichen'),
        subtitle: a.mechanikerName
          ? tx`${a.mechanikerName} · ${a.fields.fertigstellungstermin ? formatDate(a.fields.fertigstellungstermin) : '—'}`
          : a.fields.fertigstellungstermin ? formatDate(a.fields.fertigstellungstermin) : undefined,
        tone: isOverdue ? 'warning' : status === 'fertig' ? 'success' : status === 'in_arbeit' ? 'primary' : 'default',
      } as KanbanCard;
    }),
    [enrichedAuftraege, clock]
  );

  // --- Computed signals ---
  const offeneAuftraege = useMemo(
    () => enrichedAuftraege.filter(a => {
      const s = lookupKey(a.fields.status);
      return s === 'angenommen' || s === 'in_arbeit' || s === 'fertig';
    }),
    [enrichedAuftraege]
  );

  const ueberfaelligeAuftraege = useMemo(
    () => offeneAuftraege.filter(a =>
      a.fields.fertigstellungstermin &&
      isBefore(parseISO(a.fields.fertigstellungstermin), startOfDay(clock))
    ),
    [offeneAuftraege, clock]
  );

  const offeneRechnungen = useMemo(
    () => enrichedRechnungen.filter(r => lookupKey(r.fields.status) === 'offen'),
    [enrichedRechnungen]
  );

  const faelligeRechnungen = useMemo(
    () => offeneRechnungen.filter(r =>
      r.fields.faelligkeit && !isAfter(parseISO(r.fields.faelligkeit), startOfDay(clock))
    ).sort((a, b) => (a.fields.faelligkeit ?? '').localeCompare(b.fields.faelligkeit ?? '')),
    [offeneRechnungen, clock]
  );

  const teileUnterMindest = useMemo(
    () => teilebestand.filter(t =>
      t.fields.mindestbestand != null &&
      (t.fields.bestand ?? 0) < t.fields.mindestbestand
    ),
    [teilebestand]
  );

  const aktiveMechaniker = useMemo(
    () => mitarbeiter.filter(m =>
      lookupKey(m.fields.rolle) === 'mechaniker' &&
      lookupKey(m.fields.status) === 'aktiv'
    ),
    [mitarbeiter]
  );

  const fertigeAuftraege = useMemo(
    () => enrichedAuftraege.filter(a => lookupKey(a.fields.status) === 'fertig'),
    [enrichedAuftraege]
  );

  const offeneRechnungenBetrag = useMemo(
    () => offeneRechnungen.reduce((s, r) => s + (r.fields.bruttobetrag ?? 0), 0),
    [offeneRechnungen]
  );

  // --- Context line ---
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (offeneAuftraege.length > 0) {
      const names = offeneAuftraege.slice(0, 3).map(a => a.fahrzeugName || a.fields.auftragsnummer || '');
      parts.push(namen(names, 3));
    }
    if (ueberfaelligeAuftraege.length > 0) {
      return tx`${namen(ueberfaelligeAuftraege.map(a => a.fahrzeugName || ''), 2)} — überfällig.`;
    }
    if (parts.length > 0) {
      return tx`In Arbeit: ${parts[0]}.`;
    }
    return tx('Keine offenen Aufträge — ruhiger Tag!');
  }, [offeneAuftraege, ueberfaelligeAuftraege]);

  // --- Filter state ---
  const [mechFilter, setMechFilter] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    if (!mechFilter) return cards;
    const auftraegeIds = enrichedAuftraege
      .filter(a => a.mechanikerName === mechFilter)
      .map(a => a.record_id);
    return cards.filter(c => auftraegeIds.includes(c.id.split(':')[1] ?? ''));
  }, [cards, mechFilter, enrichedAuftraege]);

  // --- Hero: überfällige Aufträge ---
  const erstUeberfaellig = ueberfaelligeAuftraege[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm truncate">{contextLine}</p>
        </div>
        <button
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => crud.auftraege.openCreate({ status: 'angenommen', annahmedatum: today })}
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neuer Auftrag')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          erstUeberfaellig ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('In Arbeit setzen'),
                onClick: () => void advanceAuftrag(erstUeberfaellig.record_id, 'in_arbeit'),
              }}
            >
              <b>{namen(ueberfaelligeAuftraege.map(a => a.fahrzeugName || a.fields.auftragsnummer || ''), 3)}</b>
              {' '}{ueberfaelligeAuftraege.length === 1 ? tx('ist überfällig') : tx('sind überfällig')}
              {erstUeberfaellig.fields.fertigstellungstermin
                ? tx` — Termin war ${formatDate(erstUeberfaellig.fields.fertigstellungstermin)}.`
                : '.'}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={offeneAuftraege.length}
              icon={<IconTool size={16} className="shrink-0" />}
              tone={offeneAuftraege.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Fertig — offen zur Rechnung')}
              value={fertigeAuftraege.length}
              icon={<IconCheck size={16} className="shrink-0" />}
              tone={fertigeAuftraege.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Rechnungen')}
              value={offeneRechnungen.length}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
              tone={faelligeRechnungen.length > 0 ? 'destructive' : offeneRechnungen.length > 0 ? 'warning' : 'default'}
              onClick={() => setMechFilter(null)}
            />
            <StatStripItem
              title={tx('Teile unter Mindestbestand')}
              value={teileUnterMindest.length}
              icon={<IconPackage size={16} className="shrink-0" />}
              tone={teileUnterMindest.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <div className="space-y-3">
            {/* Mechaniker-Filter */}
            {aktiveMechaniker.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${!mechFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  onClick={() => setMechFilter(null)}
                >
                  {tx('Alle')}
                </button>
                {aktiveMechaniker.map(m => {
                  const name = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim();
                  const count = enrichedAuftraege.filter(a => {
                    const s = lookupKey(a.fields.status);
                    return a.mechanikerName === name && (s === 'angenommen' || s === 'in_arbeit' || s === 'fertig');
                  }).length;
                  return (
                    <button
                      key={m.record_id}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${mechFilter === name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      onClick={() => setMechFilter(f => f === name ? null : name)}
                    >
                      {name}
                      {count > 0 && (
                        <span className="ml-1.5 rounded-full bg-background/30 px-1.5 tabular-nums">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <KanbanWidget
              cards={filteredCards}
              columns={COLUMNS}
              defaultCollapsed={['abgerechnet', 'abgeholt']}
              onCardClick={card => {
                const rid = card.id.split(':')[1];
                const rec = auftraege.find(a => a.record_id === rid);
                if (rec) crud.auftraege.openDetail(rec);
              }}
              onCardMove={async (cardId, newColumn) => {
                const rid = cardId.split(':')[1] ?? '';
                const rec = auftraege.find(a => a.record_id === rid);
                if (!rec) return;
                const oldKey = lookupKey(rec.fields.status) ?? 'angenommen';
                setAuftraege(prev =>
                  prev.map(a =>
                    a.record_id === rid
                      ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', newColumn) } }
                      : a
                  )
                );
                const col = COLUMNS.find(c => c.key === newColumn);
                undoToast(tx`Auftrag — ${col?.label ?? newColumn}`, async () => {
                  setAuftraege(prev =>
                    prev.map(a =>
                      a.record_id === rid
                        ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', oldKey) } }
                        : a
                    )
                  );
                  await LivingAppsService.updateAuftraegeEntry(rid, { status: oldKey });
                });
                try {
                  await LivingAppsService.updateAuftraegeEntry(rid, { status: newColumn });
                } catch {
                  setAuftraege(prev =>
                    prev.map(a =>
                      a.record_id === rid
                        ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', oldKey) } }
                        : a
                    )
                  );
                  await fetchAll();
                }
              }}
              onAddCard={column => crud.auftraege.openCreate({ status: column, annahmedatum: today })}
            />
          </div>
        }
        aside={
          <>
            <WorkList
              title={tx('Fällige Rechnungen')}
              items={faelligeRechnungen.slice(0, 8).map(r => ({
                id: r.record_id,
                title: r.kundeName || r.fields.rechnungsnummer || tx('Unbekannt'),
                secondLine: (
                  <>
                    <span className="font-medium text-destructive">{tx('Fällig')}</span>
                    <span className="text-muted-foreground"> · {formatDate(r.fields.faelligkeit)} · {formatCurrency(r.fields.bruttobetrag)}</span>
                  </>
                ),
                action: {
                  label: tx('Bezahlt'),
                  onClick: () => void markRechnungBezahlt(r.record_id),
                },
              }))}
              onItemClick={id => {
                const rec = rechnungen.find(r => r.record_id === id);
                if (rec) crud.rechnungen.openDetail(rec);
              }}
              empty={{
                text: offeneRechnungen.length > 0
                  ? tx`${offeneRechnungen.length} offene ${appLabel('rechnungen')} — alle im Zeitplan.`
                  : tx('Keine offenen Rechnungen — alles bezahlt!'),
                action: offeneRechnungen.length > 0
                  ? { label: tx('Rechnungen ansehen'), onClick: () => crud.rechnungen.openDetail(rechnungen[0]) }
                  : { label: tx('Neue Rechnung'), onClick: () => crud.rechnungen.openCreate({}) },
              }}
            />
            <WorkList
              title={tx('Teile nachbestellen')}
              items={teileUnterMindest.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.bezeichnung || t.fields.artikelnummer || tx('Unbekanntes Teil'),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">
                      {tx`Bestand: ${t.fields.bestand ?? 0} / mind. ${t.fields.mindestbestand ?? 0}`}
                    </span>
                    {t.fields.lagerplatz && (
                      <span className="text-muted-foreground"> · {t.fields.lagerplatz}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bearbeiten'),
                  onClick: () => crud.teilebestand.openEdit(t),
                },
              }))}
              onItemClick={id => {
                const rec = teilebestand.find(t => t.record_id === id);
                if (rec) crud.teilebestand.openDetail(rec);
              }}
              empty={{
                text: tx('Alle Teile ausreichend bevorratet.'),
                action: { label: tx('Teilebestand verwalten'), onClick: () => crud.teilebestand.openCreate({}) },
              }}
            />
          </>
        }
      />

      {/* Offene Rechnungen Gesamtbetrag */}
      {offeneRechnungen.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {tx`${offeneRechnungen.length} offene ${appLabel('rechnungen')}`}
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {formatCurrency(offeneRechnungenBetrag)}
          </div>
        </div>
      )}

      {crud.surfaces}
    </div>
  );
}
