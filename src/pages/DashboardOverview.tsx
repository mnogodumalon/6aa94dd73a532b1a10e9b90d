import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { format, parseISO, isBefore, isAfter, addDays } from 'date-fns';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import {
  IconAlertTriangle,
  IconReceipt,
  IconTool,
  IconCar,
  IconPlus,
  IconPackage,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    auftraege,
    rechnungen,
    teilebestand,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftraege') {
        const statusKey = lookupKey(top.record.fields.status);
        const nextStatus = getNextStatus(statusKey);
        if (nextStatus) {
          const nextLabel = lookupOption('auftraege', 'status', nextStatus).label;
          return {
            label: tx`Status: ${nextLabel}`,
            onClick: () => advanceAuftrag(top.record),
          };
        }
      }
      if (top.type === 'rechnungen') {
        const statusKey = lookupKey(top.record.fields.status);
        if (statusKey === 'offen') {
          return {
            label: tx('Als bezahlt markieren'),
            onClick: () => markRechnungBezahlt(top.record),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedAuftraege = crud.enriched.auftraege;
  const enrichedRechnungen = crud.enriched.rechnungen;

  const clock = useClock();
  const todayStr = format(clock, 'yyyy-MM-dd');

  // --- Status helpers ---
  function getNextStatus(current: string | undefined): string | null {
    const flow: Record<string, string> = {
      angenommen: 'in_arbeit',
      in_arbeit: 'fertig',
      fertig: 'abgerechnet',
      abgerechnet: 'abgeholt',
    };
    return current ? (flow[current] ?? null) : null;
  }

  async function advanceAuftrag(auftrag: typeof auftraege[0]) {
    const currentKey = lookupKey(auftrag.fields.status);
    const nextKey = getNextStatus(currentKey);
    if (!nextKey) return;
    const prevStatus = auftrag.fields.status;
    const nextLookup = lookupOption('auftraege', 'status', nextKey);
    // optimistic
    data.setAuftraege(prev =>
      prev.map(a => a.record_id === auftrag.record_id
        ? { ...a, fields: { ...a.fields, status: nextLookup } }
        : a
      )
    );
    undoToast(
      tx`${auftrag.fields.auftragsnummer ?? ''} → ${nextLookup.label}`,
      async () => {
        data.setAuftraege(prev =>
          prev.map(a => a.record_id === auftrag.record_id
            ? { ...a, fields: { ...a.fields, status: prevStatus } }
            : a
          )
        );
        await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, { status: prevStatus });
      }
    );
    try {
      await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, { status: nextKey });
    } catch {
      await fetchAll();
    }
  }

  async function markRechnungBezahlt(rechnung: typeof rechnungen[0]) {
    const prevStatus = rechnung.fields.status;
    const nextLookup = lookupOption('rechnungen', 'status', 'bezahlt');
    data.setRechnungen(prev =>
      prev.map(r => r.record_id === rechnung.record_id
        ? { ...r, fields: { ...r.fields, status: nextLookup, zahlungseingang: todayStr } }
        : r
      )
    );
    undoToast(
      tx`${rechnung.fields.rechnungsnummer ?? ''} — als bezahlt markiert`,
      async () => {
        data.setRechnungen(prev =>
          prev.map(r => r.record_id === rechnung.record_id
            ? { ...r, fields: { ...r.fields, status: prevStatus } }
            : r
          )
        );
        await LivingAppsService.updateRechnungenEntry(rechnung.record_id, { status: prevStatus });
      }
    );
    try {
      await LivingAppsService.updateRechnungenEntry(rechnung.record_id, {
        status: 'bezahlt',
        zahlungseingang: todayStr,
      });
    } catch {
      await fetchAll();
    }
  }

  // --- Derived data ---
  const offeneAuftraege = enrichedAuftraege.filter(a => {
    const k = lookupKey(a.fields.status);
    return k === 'angenommen' || k === 'in_arbeit' || k === 'fertig';
  });

  const ueberfaelligeAuftraege = offeneAuftraege.filter(a => {
    const fts = a.fields.fertigstellungstermin;
    if (!fts) return false;
    return isBefore(parseISO(fts), parseISO(todayStr));
  });

  const offeneRechnungen = enrichedRechnungen.filter(r =>
    lookupKey(r.fields.status) === 'offen'
  );

  const ueberfaelligeRechnungen = offeneRechnungen.filter(r => {
    const fts = r.fields.faelligkeit;
    if (!fts) return false;
    return isBefore(parseISO(fts), parseISO(todayStr));
  });

  const unterMindestbestand = teilebestand.filter(t =>
    (t.fields.bestand ?? 0) < (t.fields.mindestbestand ?? 0)
  );

  // --- Kanban columns (inside component body — locale-aware getters) ---
  const kanbanColumns: KanbanColumn[] = (LOOKUP_OPTIONS['auftraege']?.['status'] ?? [])
    .filter(o => o.key !== 'abgeholt')
    .map(o => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'fertig' ? 'success' : o.key === 'in_arbeit' ? 'primary' : 'default',
    } as KanbanColumn));

  const abgeholtColumn: KanbanColumn[] = (LOOKUP_OPTIONS['auftraege']?.['status'] ?? [])
    .filter(o => o.key === 'abgeholt')
    .map(o => ({ key: o.key, label: o.label, tone: 'default' as const }));

  const allColumns = [...kanbanColumns, ...abgeholtColumn];

  // --- Kanban cards ---
  const kanbanCards: KanbanCard[] = enrichedAuftraege.map(a => {
    const statusKey = lookupKey(a.fields.status) ?? '';
    const isUeberfaellig = ueberfaelligeAuftraege.some(u => u.record_id === a.record_id);
    return {
      id: `auftrag:${a.record_id}`,
      column: statusKey,
      title: (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold truncate">{a.fields.auftragsnummer ?? tx('Kein Nr.')}</span>
          <span className="text-xs text-muted-foreground truncate">{a.fahrzeugName}</span>
        </span>
      ),
      subtitle: (
        <span className="flex flex-col gap-0.5 text-xs">
          {a.mechanikerName && (
            <span className="text-muted-foreground truncate">{a.mechanikerName}</span>
          )}
          {a.fields.fertigstellungstermin && (
            <span className={isUeberfaellig ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {isUeberfaellig ? tx('Überfällig') : tx('Bis')}: {formatDate(a.fields.fertigstellungstermin)}
            </span>
          )}
        </span>
      ),
      tone: isUeberfaellig ? 'destructive' : 'default',
    };
  });

  // --- Card move handler ---
  async function handleCardMove(cardId: string, newColumn: string) {
    const recordId = cardId.split(':')[1];
    const auftrag = auftraege.find(a => a.record_id === recordId);
    if (!auftrag) return;
    const prevStatus = auftrag.fields.status;
    const nextLookup = lookupOption('auftraege', 'status', newColumn);
    data.setAuftraege(prev =>
      prev.map(a => a.record_id === recordId
        ? { ...a, fields: { ...a.fields, status: nextLookup } }
        : a
      )
    );
    undoToast(
      tx`${auftrag.fields.auftragsnummer ?? ''} → ${nextLookup.label}`,
      async () => {
        data.setAuftraege(prev =>
          prev.map(a => a.record_id === recordId
            ? { ...a, fields: { ...a.fields, status: prevStatus } }
            : a
          )
        );
        await LivingAppsService.updateAuftraegeEntry(recordId, { status: prevStatus });
      }
    );
    try {
      await LivingAppsService.updateAuftraegeEntry(recordId, { status: newColumn });
    } catch {
      await fetchAll();
    }
  }

  // --- Context line ---
  const fertigOhneRechnung = enrichedAuftraege.filter(a =>
    lookupKey(a.fields.status) === 'fertig'
  );
  const contextLine = (() => {
    const parts: string[] = [];
    if (ueberfaelligeAuftraege.length > 0) {
      const names = namen(ueberfaelligeAuftraege.map(a => a.fahrzeugName));
      parts.push(tx`${names} überfällig`);
    }
    if (fertigOhneRechnung.length > 0) {
      parts.push(tx`${fertigOhneRechnung.length} ${fertigOhneRechnung.length === 1 ? tx('Auftrag') : tx('Aufträge')} bereit zur Abrechnung`);
    }
    if (unterMindestbestand.length > 0) {
      parts.push(tx`${unterMindestbestand.length} ${unterMindestbestand.length === 1 ? tx('Teil') : tx('Teile')} unter Mindestbestand`);
    }
    if (parts.length === 0) return tx('Alle Aufträge im Zeitplan — guten Tag in der Werkstatt!');
    return parts.join(' · ');
  })();

  // Hero: überfällige Aufträge (urgent signal)
  const hero = ueberfaelligeAuftraege.length > 0 ? (
    <HeroBanner
      icon={<IconAlertTriangle size={18} />}
      action={{
        label: tx('Weiterschalten'),
        onClick: () => advanceAuftrag(ueberfaelligeAuftraege[0]),
      }}
    >
      <b>{namen(ueberfaelligeAuftraege.map(a => a.fahrzeugName))}</b>
      {' '}{ueberfaelligeAuftraege.length === 1 ? tx('ist überfällig') : tx('sind überfällig')}
      {ueberfaelligeAuftraege[0]?.fields.fertigstellungstermin && (
        <> — {tx('zugesagt')}: <b>{formatDate(ueberfaelligeAuftraege[0].fields.fertigstellungstermin)}</b></>
      )}
    </HeroBanner>
  ) : undefined;

  // --- Aside 1: offene Rechnungen ---
  const rechnungenSorted = [...offeneRechnungen].sort((a, b) => {
    const fa = a.fields.faelligkeit ?? '9999';
    const fb = b.fields.faelligkeit ?? '9999';
    return fa.localeCompare(fb);
  });

  // --- Aside 2: Teile unter Mindestbestand ---
  const teileSorted = [...unterMindestbestand].sort((a, b) => {
    const diffA = (a.fields.mindestbestand ?? 0) - (a.fields.bestand ?? 0);
    const diffB = (b.fields.mindestbestand ?? 0) - (b.fields.bestand ?? 0);
    return diffB - diffA;
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.auftraege.openCreate({ status: 'angenommen' })}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neuer Auftrag')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={offeneAuftraege.length}
              icon={<IconTool size={16} />}
              tone="default"
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={ueberfaelligeAuftraege.length}
              icon={<IconAlertTriangle size={16} />}
              tone={ueberfaelligeAuftraege.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Abzurechnen')}
              value={fertigOhneRechnung.length}
              icon={<IconReceipt size={16} />}
              tone={fertigOhneRechnung.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Rechnungen offen')}
              value={offeneRechnungen.length}
              icon={<IconReceipt size={16} />}
              tone={ueberfaelligeRechnungen.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Teile bestellen')}
              value={unterMindestbestand.length}
              icon={<IconPackage size={16} />}
              tone={unterMindestbestand.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={allColumns}
            cards={kanbanCards}
            defaultCollapsed={['abgerechnet', 'abgeholt']}
            onCardClick={(card) => {
              const recordId = card.id.split(':')[1];
              const auftrag = auftraege.find(a => a.record_id === recordId);
              if (auftrag) crud.auftraege.openDetail(auftrag);
            }}
            onCardMove={handleCardMove}
            onAddCard={(column) => crud.auftraege.openCreate({ status: column })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Offene Rechnungen')}
              items={rechnungenSorted.map(r => {
                const isUeberfaellig = ueberfaelligeRechnungen.some(u => u.record_id === r.record_id);
                return {
                  id: r.record_id,
                  title: r.fields.rechnungsnummer ?? tx('Ohne Nr.'),
                  secondLine: (
                    <>
                      <span className={isUeberfaellig ? 'font-medium text-destructive' : 'text-amber-600'}>
                        {r.kundeName || tx('Kein Kunde')}
                      </span>
                      {r.fields.faelligkeit && (
                        <span className="text-muted-foreground"> · {tx('Fällig')}: {formatDate(r.fields.faelligkeit)}</span>
                      )}
                      {r.fields.bruttobetrag != null && (
                        <span className="text-muted-foreground"> · {formatCurrency(r.fields.bruttobetrag)}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Bezahlt'),
                    onClick: () => markRechnungBezahlt(rechnungen.find(raw => raw.record_id === r.record_id) ?? rechnungen[0]),
                  },
                };
              })}
              onItemClick={(id) => {
                const rec = rechnungen.find(r => r.record_id === id);
                if (rec) crud.rechnungen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Rechnungen — alles beglichen.'),
                action: { label: tx('Rechnung erstellen'), onClick: () => crud.rechnungen.openCreate({}) },
              }}
            />
            <WorkList
              title={tx('Teile unter Mindestbestand')}
              items={teileSorted.map(t => ({
                id: t.record_id,
                title: t.fields.bezeichnung ?? t.fields.artikelnummer ?? tx('Unbekanntes Teil'),
                secondLine: (
                  <>
                    <span className="font-medium text-destructive">
                      {tx('Bestand')}: {t.fields.bestand ?? 0} / {tx('Mind.')}: {t.fields.mindestbestand ?? 0}
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
              onItemClick={(id) => {
                const teil = teilebestand.find(t => t.record_id === id);
                if (teil) crud.teilebestand.openDetail(teil);
              }}
              empty={{
                text: tx('Alle Teile ausreichend bevorratet.'),
                action: { label: tx('Teil anlegen'), onClick: () => crud.teilebestand.openCreate({}) },
              }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
