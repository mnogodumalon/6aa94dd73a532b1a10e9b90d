import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { lookupOption, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  IconAlertTriangle,
  IconPackage,
  IconFileInvoice,
  IconCar,
  IconTool,
  IconCircleCheck,
  IconClock,
  IconBuildingFactory2,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    auftraege, teilebestand, rechnungen, fahrzeuge, mitarbeiter,
    setAuftraege, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftraege') {
        const status = lookupKey(top.record.fields.status);
        const nextStatus = nextStatusKey(status);
        if (!nextStatus) return undefined;
        const nextLabel = LOOKUP_OPTIONS['auftraege']?.['status']?.find(o => o.key === nextStatus)?.label ?? nextStatus;
        return {
          label: tx`→ ${nextLabel}`,
          onClick: () => void advanceAuftrag(top.record, status),
        };
      }
      return undefined;
    },
  });

  const enrichedAuftraege = crud.enriched.auftraege;
  const enrichedRechnungen = crud.enriched.rechnungen;
  const enrichedFahrzeuge = crud.enriched.fahrzeuge;

  const clock = useClock();

  // ─── Derived data ────────────────────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');

  // Aufträge Kanban columns — INSIDE component body (locale-aware getters)
  const kanbanColumns = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['auftraege']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  function toneForStatus(status: string | undefined): KanbanTone {
    if (status === 'fertig') return 'warning';
    if (status === 'in_arbeit') return 'primary';
    if (status === 'abgerechnet') return 'success';
    if (status === 'abgeholt') return 'default';
    return 'default'; // angenommen
  }

  const kanbanCards = useMemo<KanbanCard[]>(
    () =>
      enrichedAuftraege.map(a => {
        const status = lookupKey(a.fields.status) ?? 'angenommen';
        const faellig = a.fields.fertigstellungstermin;
        const isOverdue = faellig && faellig < today && status !== 'abgerechnet' && status !== 'abgeholt';
        return {
          id: `auftrag:${a.record_id}`,
          column: status,
          title: a.fahrzeugName || a.fields.auftragsnummer || tx('Auftrag'),
          subtitle: a.mechanikerName
            ? tx`${a.mechanikerName}${faellig ? ` · bis ${formatDate(faellig)}` : ''}`
            : faellig ? tx`bis ${formatDate(faellig)}` : undefined,
          tone: isOverdue ? 'warning' : toneForStatus(status),
        };
      }),
    [enrichedAuftraege, today],
  );

  // Teile unter Mindestbestand
  const unterMindestbestand = useMemo(
    () =>
      teilebestand.filter(
        t => (t.fields.bestand ?? 0) < (t.fields.mindestbestand ?? 0),
      ),
    [teilebestand],
  );

  // Offene Rechnungen
  const offeneRechnungen = useMemo(
    () =>
      enrichedRechnungen.filter(r => lookupKey(r.fields.status) === 'offen'),
    [enrichedRechnungen],
  );

  const offeneRechnungenSumme = useMemo(
    () =>
      offeneRechnungen.reduce(
        (sum, r) => sum + (r.fields.bruttobetrag ?? 0),
        0,
      ),
    [offeneRechnungen],
  );

  // HU-fällig: Fahrzeuge deren HU in ≤60 Tagen abläuft (oder schon abgelaufen)
  const huFaellig = useMemo(() => {
    return enrichedFahrzeuge
      .filter(f => {
        if (!f.fields.hu_faellig) return false;
        const diff = differenceInDays(parseISO(f.fields.hu_faellig), clock);
        return diff <= 60;
      })
      .sort((a, b) =>
        (a.fields.hu_faellig ?? '').localeCompare(b.fields.hu_faellig ?? ''),
      );
  }, [enrichedFahrzeuge, clock]);

  // Fertige Aufträge (warten auf Rechnung)
  const fertigeAuftraege = useMemo(
    () => enrichedAuftraege.filter(a => lookupKey(a.fields.status) === 'fertig'),
    [enrichedAuftraege],
  );

  // Mitarbeiter nicht verfügbar
  const nichtVerfuegbar = useMemo(
    () =>
      mitarbeiter.filter(
        m => lookupKey(m.fields.status) === 'krank' || lookupKey(m.fields.status) === 'urlaub',
      ),
    [mitarbeiter],
  );

  // Aktive Aufträge (angenommen + in_arbeit)
  const aktiveAuftraege = useMemo(
    () =>
      auftraege.filter(
        a =>
          lookupKey(a.fields.status) === 'angenommen' ||
          lookupKey(a.fields.status) === 'in_arbeit',
      ),
    [auftraege],
  );

  // ─── Status-Advance Logik ─────────────────────────────────────────────
  function nextStatusKey(current: string | undefined): string | null {
    const flow: Record<string, string> = {
      angenommen: 'in_arbeit',
      in_arbeit: 'fertig',
      fertig: 'abgerechnet',
      abgerechnet: 'abgeholt',
    };
    return current ? (flow[current] ?? null) : null;
  }

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  async function advanceAuftrag(
    auftrag: (typeof enrichedAuftraege)[0],
    currentStatus: string | undefined,
  ) {
    const nextStatus = nextStatusKey(currentStatus);
    if (!nextStatus) return;

    const nextOption = lookupOption('auftraege', 'status', nextStatus);
    const snapshot = [...auftraege];
    setAuftraege(prev =>
      prev.map(a =>
        a.record_id === auftrag.record_id
          ? { ...a, fields: { ...a.fields, status: nextOption } }
          : a,
      ),
    );
    undoToast(
      tx`${auftrag.fahrzeugName || auftrag.fields.auftragsnummer || ''} → ${nextOption.label}`,
      async () => {
        const prevOption = currentStatus
          ? lookupOption('auftraege', 'status', currentStatus)
          : undefined;
        setAuftraege(snapshot);
        if (prevOption) {
          await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, {
            status: currentStatus,
          });
        }
      },
    );
    try {
      await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, {
        status: nextStatus,
      });
    } catch {
      setAuftraege(snapshot);
      await fetchAll();
    }
  }

  // ─── Kanban card move ─────────────────────────────────────────────────
  async function moveCard(cardId: string, newColumn: string) {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const auftrag = enrichedAuftraege.find(a => a.record_id === rid);
    if (!auftrag) return;
    const snapshot = [...auftraege];
    setAuftraege(prev =>
      prev.map(a =>
        a.record_id === rid
          ? { ...a, fields: { ...a.fields, status: lookupOption('auftraege', 'status', newColumn) } }
          : a,
      ),
    );
    const newLabel =
      LOOKUP_OPTIONS['auftraege']?.['status']?.find(o => o.key === newColumn)?.label ??
      newColumn;
    undoToast(
      tx`${auftrag.fahrzeugName || auftrag.fields.auftragsnummer || ''} → ${newLabel}`,
      async () => {
        const prevKey = lookupKey(auftrag.fields.status) ?? 'angenommen';
        setAuftraege(snapshot);
        await LivingAppsService.updateAuftraegeEntry(rid, { status: prevKey });
      },
    );
    try {
      await LivingAppsService.updateAuftraegeEntry(rid, { status: newColumn });
    } catch {
      setAuftraege(snapshot);
      await fetchAll();
    }
  }

  // ─── Kontext-Satz ─────────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    if (fertigeAuftraege.length > 0) {
      const names = namen(fertigeAuftraege.map(a => a.fahrzeugName || a.fields.auftragsnummer || ''));
      return fertigeAuftraege.length === 1
        ? tx`${names} wartet auf Abrechnung.`
        : tx`${names} warten auf Abrechnung.`;
    }
    if (aktiveAuftraege.length > 0) {
      return tx`${String(aktiveAuftraege.length)} Aufträge in Bearbeitung — alles im Plan.`;
    }
    return tx('Noch keine Aufträge heute — bereit für den nächsten Kunden.');
  }, [fertigeAuftraege, aktiveAuftraege]);

  // ─── Hero: HU-fällig oder fertige Aufträge ohne Rechnung ─────────────
  const urgentHu = huFaellig.filter(f => {
    const diff = differenceInDays(parseISO(f.fields.hu_faellig!), clock);
    return diff < 0;
  });

  const hero =
    urgentHu.length > 0 ? (
      <HeroBanner
        icon={<IconAlertTriangle size={18} />}
        action={{
          label: tx('Fahrzeug aufrufen'),
          onClick: () => crud.fahrzeuge.openDetail(urgentHu[0]),
        }}
      >
        {urgentHu.length === 1
          ? tx`HU abgelaufen: ${urgentHu[0].fields.kennzeichen ?? ''} (${urgentHu[0].halterName})`
          : tx`${String(urgentHu.length)} Fahrzeuge mit abgelaufener HU — sofort prüfen.`}
      </HeroBanner>
    ) : fertigeAuftraege.length > 0 ? (
      <HeroBanner
        icon={<IconFileInvoice size={18} />}
        action={{
          label: tx('Rechnung erstellen'),
          onClick: () => crud.auftraege.openDetail(fertigeAuftraege[0]),
        }}
      >
        {fertigeAuftraege.length === 1
          ? tx`${fertigeAuftraege[0].fahrzeugName || fertigeAuftraege[0].fields.auftragsnummer || ''} ist fertig — Rechnung ausstehend.`
          : tx`${String(fertigeAuftraege.length)} Aufträge fertig und noch nicht abgerechnet.`}
      </HeroBanner>
    ) : undefined;

  // ─── KPI strip ────────────────────────────────────────────────────────
  const kpis = (
    <StatStrip>
      <StatStripItem
        title={tx('Aktiv')}
        value={aktiveAuftraege.length}
        icon={<IconTool size={16} className="shrink-0" />}
        tone="primary"
        onClick={() => setStatusFilter(f => (f === 'aktiv' ? null : 'aktiv'))}
        active={statusFilter === 'aktiv'}
      />
      <StatStripItem
        title={tx('Fertig / offen')}
        value={fertigeAuftraege.length}
        icon={<IconCircleCheck size={16} className="shrink-0" />}
        tone={fertigeAuftraege.length > 0 ? 'warning' : 'default'}
        onClick={() => setStatusFilter(f => (f === 'fertig' ? null : 'fertig'))}
        active={statusFilter === 'fertig'}
      />
      <StatStripItem
        title={tx('Nachbestellen')}
        value={unterMindestbestand.length}
        icon={<IconPackage size={16} className="shrink-0" />}
        tone={unterMindestbestand.length > 0 ? 'destructive' : 'default'}
      />
      <StatStripItem
        title={tx('Offene Rechnungen')}
        value={offeneRechnungen.length}
        icon={<IconFileInvoice size={16} className="shrink-0" />}
        tone={offeneRechnungen.length > 0 ? 'warning' : 'default'}
        onClick={() => setStatusFilter(f => (f === 'rechnung' ? null : 'rechnung'))}
        active={statusFilter === 'rechnung'}
      />
      <StatStripItem
        title={tx('Nicht verfügbar')}
        value={nichtVerfuegbar.length}
        icon={<IconBuildingFactory2 size={16} className="shrink-0" />}
        tone={nichtVerfuegbar.length > 0 ? 'warning' : 'default'}
      />
    </StatStrip>
  );

  // ─── Filtered kanban cards ────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    if (statusFilter === 'aktiv')
      return kanbanCards.filter(c => c.column === 'angenommen' || c.column === 'in_arbeit');
    if (statusFilter === 'fertig')
      return kanbanCards.filter(c => c.column === 'fertig');
    return kanbanCards;
  }, [kanbanCards, statusFilter]);

  // ─── Aside: Teile unter Mindestbestand ───────────────────────────────
  const teileAside = (
    <WorkList
      title={tx('Teile nachbestellen')}
      items={unterMindestbestand.map(t => ({
        id: t.record_id,
        title: t.fields.bezeichnung ?? t.fields.artikelnummer ?? tx('Unbekanntes Teil'),
        secondLine: (
          <>
            <span className="font-medium text-destructive">
              {tx`${String(t.fields.bestand ?? 0)} / ${String(t.fields.mindestbestand ?? 0)} Stk.`}
            </span>
            {t.fields.lagerplatz && (
              <span className="text-muted-foreground"> · {t.fields.lagerplatz}</span>
            )}
          </>
        ),
        action: {
          label: tx('Bestellen'),
          onClick: () => crud.teilebestand.openDetail(t),
        },
      }))}
      onItemClick={id => {
        const t = teilebestand.find(t => t.record_id === id);
        if (t) crud.teilebestand.openDetail(t);
      }}
      empty={{
        text: tx('Alle Teile ausreichend bevorratet.'),
        action: {
          label: tx('Teil aufnehmen'),
          onClick: () => crud.teilebestand.openCreate({}),
        },
      }}
    />
  );

  // ─── Aside: Offene Rechnungen ─────────────────────────────────────────
  const rechnungenAside = (
    <WorkList
      title={tx('Offene Rechnungen')}
      items={offeneRechnungen.slice(0, 8).map(r => ({
        id: r.record_id,
        title: r.kundeName || r.fields.rechnungsnummer || tx('Rechnung'),
        secondLine: (
          <>
            <span className="font-medium text-amber-600">
              {formatCurrency(r.fields.bruttobetrag)}
            </span>
            {r.fields.faelligkeit && (
              <span className="text-muted-foreground">
                {' '}· {tx('fällig')} {formatDate(r.fields.faelligkeit)}
              </span>
            )}
          </>
        ),
        action: {
          label: tx('Bezahlt'),
          onClick: async () => {
            const snap = rechnungen.slice();
            const nextOption = lookupOption('rechnungen', 'status', 'bezahlt');
            data.setRechnungen(prev =>
              prev.map(re =>
                re.record_id === r.record_id
                  ? { ...re, fields: { ...re.fields, status: nextOption } }
                  : re,
              ),
            );
            undoToast(
              tx`${r.fields.rechnungsnummer || r.fields.rechnungsnummer || ''} — als bezahlt markiert`,
              async () => {
                data.setRechnungen(snap);
                await LivingAppsService.updateRechnungenEntry(r.record_id, {
                  status: 'offen',
                });
              },
            );
            try {
              await LivingAppsService.updateRechnungenEntry(r.record_id, {
                status: 'bezahlt',
                zahlungseingang: format(clock, 'yyyy-MM-dd'),
              });
            } catch {
              data.setRechnungen(snap);
              await fetchAll();
            }
          },
        },
      }))}
      onItemClick={id => {
        const r = enrichedRechnungen.find(r => r.record_id === id);
        if (r) crud.rechnungen.openDetail(r);
      }}
      empty={{
        text:
          offeneRechnungenSumme > 0
            ? tx('Alle Rechnungen beglichen.')
            : tx('Keine offenen Rechnungen.'),
        action: {
          label: tx('Rechnung erstellen'),
          onClick: () => crud.rechnungen.openCreate({}),
        },
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.auftraege.openCreate({})}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <IconTool size={16} className="shrink-0" />
          <span>{tx('Neuer Auftrag')}</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={kpis}
        primary={
          <KanbanWidget
            cards={filteredCards}
            columns={kanbanColumns}
            defaultCollapsed={['abgeholt']}
            onCardClick={card => {
              const rid = card.id.split(':')[1];
              const a = enrichedAuftraege.find(a => a.record_id === rid);
              if (a) crud.auftraege.openDetail(a);
            }}
            onCardMove={moveCard}
            onAddCard={column => crud.auftraege.openCreate({ status: column })}
          />
        }
        aside={
          <>
            {teileAside}
            {rechnungenAside}
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
