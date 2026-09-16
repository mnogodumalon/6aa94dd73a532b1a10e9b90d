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
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { IconAlertTriangle, IconClock, IconCircleCheck, IconReceipt, IconTool, IconPlus } from '@tabler/icons-react';
import { format, isAfter, isBefore, startOfDay, parseISO } from 'date-fns';
import type { EnrichedAuftraege } from '@/types/enriched';

function toneForAuftragStatus(status: string | undefined): KanbanTone {
  if (status === 'angenommen') return 'warning';
  if (status === 'in_arbeit') return 'primary';
  if (status === 'fertig') return 'success';
  if (status === 'abgerechnet') return 'default';
  if (status === 'abgeholt') return 'default';
  return 'default';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    auftraege, auftragspositionen, rechnungen, mitarbeiter, fahrzeuge, kunden,
    setAuftraege, fetchAll,
  } = data;

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftraege') {
        const r = top.record as EnrichedAuftraege;
        const status = lookupKey(r.fields.status);
        const nextStatusMap: Record<string, string> = {
          angenommen: 'in_arbeit',
          in_arbeit: 'fertig',
          fertig: 'abgerechnet',
          abgerechnet: 'abgeholt',
        };
        const next = status ? nextStatusMap[status] : undefined;
        if (!next) return undefined;
        const nextLabelMap: Record<string, string> = {
          in_arbeit: tx('In Arbeit setzen'),
          fertig: tx('Als fertig markieren'),
          abgerechnet: tx('Als abgerechnet markieren'),
          abgeholt: tx('Als abgeholt markieren'),
        };
        return {
          label: nextLabelMap[next] ?? tx('Weiterschalten'),
          onClick: () => void advanceStatus(r, next),
        };
      }
      return undefined;
    },
  });

  const enrichedAuftraege = crud.enriched.auftraege;
  const enrichedRechnungen = crud.enriched.rechnungen;

  // Status-Vorwärts-Funktion (shared helper for hero, worklist, overlay footer)
  async function advanceStatus(auftrag: EnrichedAuftraege, nextStatus: string) {
    const prev = auftrag.fields.status;
    const optimistic = lookupOption('auftraege', 'status', nextStatus);
    setAuftraege(prev2 =>
      prev2.map(a =>
        a.record_id === auftrag.record_id
          ? { ...a, fields: { ...a.fields, status: optimistic } }
          : a,
      ),
    );
    undoToast(
      tx`${auftrag.fahrzeugName || auftrag.fields.auftragsnummer || ''} — Status aktualisiert`,
      async () => {
        setAuftraege(p2 =>
          p2.map(a =>
            a.record_id === auftrag.record_id
              ? { ...a, fields: { ...a.fields, status: prev } }
              : a,
          ),
        );
        try {
          await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, {
            status: lookupKey(prev) ?? '',
          });
        } catch {
          await fetchAll();
        }
      },
    );
    try {
      await LivingAppsService.updateAuftraegeEntry(auftrag.record_id, { status: nextStatus });
    } catch {
      await fetchAll();
    }
  }

  // KPI-Berechnungen
  const offeneAuftraege = enrichedAuftraege.filter(a =>
    ['angenommen', 'in_arbeit'].includes(lookupKey(a.fields.status) ?? ''),
  );
  const fertigeAuftraege = enrichedAuftraege.filter(a =>
    lookupKey(a.fields.status) === 'fertig',
  );
  const offeneRechnungen = enrichedRechnungen.filter(r =>
    lookupKey(r.fields.status) === 'offen',
  );

  // Überfällige = Fertigstellungstermin in der Vergangenheit & noch nicht fertig/abgerechnet/abgeholt
  const ueberfaelligeAuftraege = enrichedAuftraege.filter(a => {
    const s = lookupKey(a.fields.status) ?? '';
    if (['fertig', 'abgerechnet', 'abgeholt'].includes(s)) return false;
    const termin = a.fields.fertigstellungstermin;
    if (!termin) return false;
    return isBefore(parseISO(termin), startOfDay(clock));
  });

  // Heute fällig
  const heuteFaellig = enrichedAuftraege.filter(a => {
    const s = lookupKey(a.fields.status) ?? '';
    if (['fertig', 'abgerechnet', 'abgeholt'].includes(s)) return false;
    return a.fields.fertigstellungstermin === today;
  });

  // Rechnungen überfällig
  const ueberfaelligeRechnungen = enrichedRechnungen.filter(r => {
    if (lookupKey(r.fields.status) !== 'offen') return false;
    const f = r.fields.faelligkeit;
    if (!f) return false;
    return isBefore(parseISO(f), startOfDay(clock));
  });

  // Aktive Mechaniker (nicht krank/urlaub)
  const aktiveMechaniker = mitarbeiter.filter(
    m => lookupKey(m.fields.status) === 'aktiv' && lookupKey(m.fields.rolle) === 'mechaniker',
  );

  // Teile unter Mindestbestand (aus data)
  const teileUnterMindest = data.teilebestand.filter(t =>
    (t.fields.bestand ?? 0) < (t.fields.mindestbestand ?? 0),
  );

  // Kanban-Spalten aus Schema
  const KANBAN_COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['auftraege']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // Kanban-Karten
  const kanbanCards = useMemo<KanbanCard[]>(
    () =>
      enrichedAuftraege.map(a => {
        const status = lookupKey(a.fields.status) ?? KANBAN_COLUMNS[0]?.key ?? '';
        const isUeberfaellig =
          !['fertig', 'abgerechnet', 'abgeholt'].includes(status) &&
          !!a.fields.fertigstellungstermin &&
          isBefore(parseISO(a.fields.fertigstellungstermin), startOfDay(clock));
        return {
          id: `auftrag:${a.record_id}`,
          column: status,
          title: `${a.fields.auftragsnummer ?? '—'} · ${a.fahrzeugName || '—'}`,
          subtitle: a.mechanikerName
            ? `${a.mechanikerName}${a.fields.fertigstellungstermin ? ' · bis ' + formatDate(a.fields.fertigstellungstermin) : ''}`
            : a.fields.fertigstellungstermin
            ? `bis ${formatDate(a.fields.fertigstellungstermin)}`
            : undefined,
          tone: isUeberfaellig ? 'warning' : toneForAuftragStatus(status),
        };
      }),
    [enrichedAuftraege, KANBAN_COLUMNS, clock],
  );

  // Drag-Status-Wechsel
  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const auftrag = enrichedAuftraege.find(a => a.record_id === rid);
    if (!auftrag) return;
    const prev = auftrag.fields.status;
    const optimistic = lookupOption('auftraege', 'status', newColumn);
    setAuftraege(prev2 =>
      prev2.map(a =>
        a.record_id === rid ? { ...a, fields: { ...a.fields, status: optimistic } } : a,
      ),
    );
    undoToast(
      tx`${auftrag.fahrzeugName || auftrag.fields.auftragsnummer || ''} — ${optimistic.label}`,
      async () => {
        setAuftraege(p2 =>
          p2.map(a =>
            a.record_id === rid ? { ...a, fields: { ...a.fields, status: prev } } : a,
          ),
        );
        try {
          await LivingAppsService.updateAuftraegeEntry(rid, { status: lookupKey(prev) ?? '' });
        } catch {
          await fetchAll();
        }
      },
    );
    try {
      await LivingAppsService.updateAuftraegeEntry(rid, { status: newColumn });
    } catch {
      await fetchAll();
    }
  };

  // Kontext-Satz für den Greeting
  const contextParts: string[] = [];
  if (ueberfaelligeAuftraege.length > 0) {
    contextParts.push(
      `${ueberfaelligeAuftraege.length} ${tx('überfällige Aufträge')}`,
    );
  }
  if (fertigeAuftraege.length > 0) {
    const names = namen(fertigeAuftraege.map(a => a.fahrzeugName || a.fields.auftragsnummer || ''));
    contextParts.push(tx`${names} wartet auf Abholung`);
  }
  if (offeneRechnungen.length > 0) {
    contextParts.push(`${offeneRechnungen.length} ${tx('offene Rechnungen')}`);
  }
  const contextLine = contextParts.length > 0
    ? contextParts.join(' · ')
    : tx('Alle Aufträge im grünen Bereich.');

  // Leer-Zustand: keine Aufträge
  if (auftraege.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{tx('Lege deinen ersten Auftrag an und starte die Arbeit.')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <IconTool size={48} className="text-muted-foreground" stroke={1.5} />
          <div>
            <p className="font-semibold text-lg">{tx('Noch keine Aufträge')}</p>
            <p className="text-muted-foreground text-sm mt-1">{tx('Nimm deinen ersten Auftrag an, um loszulegen.')}</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={() => crud.auftraege.openCreate({ status: 'angenommen' })}
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Ersten Auftrag anlegen')}
          </button>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seitenkopf */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{contextLine}</p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => crud.auftraege.openCreate({ status: 'angenommen' })}
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neuer Auftrag')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ueberfaelligeAuftraege.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('In Arbeit setzen'),
                onClick: () => void advanceStatus(ueberfaelligeAuftraege[0], 'in_arbeit'),
              }}
            >
              <b>{namen(ueberfaelligeAuftraege.map(a => a.fahrzeugName || a.fields.auftragsnummer || ''))}</b>
              {ueberfaelligeAuftraege.length === 1
                ? tx` — Termin überschritten, sofort bearbeiten.`
                : tx` — Fertigstellungstermin überschritten.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen & In Arbeit')}
              value={offeneAuftraege.length}
              icon={<IconTool size={16} />}
              tone={offeneAuftraege.length > 0 ? 'primary' : 'default'}
              onClick={() => crud.auftraege.openCreate({ status: 'angenommen' })}
            />
            <StatStripItem
              title={tx('Fertig & wartet')}
              value={fertigeAuftraege.length}
              icon={<IconCircleCheck size={16} />}
              tone={fertigeAuftraege.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={ueberfaelligeAuftraege.length}
              icon={<IconAlertTriangle size={16} />}
              tone={ueberfaelligeAuftraege.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Rechnungen')}
              value={offeneRechnungen.length}
              icon={<IconReceipt size={16} />}
              tone={ueberfaelligeRechnungen.length > 0 ? 'warning' : offeneRechnungen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Mechaniker aktiv')}
              value={aktiveMechaniker.length}
              icon={<IconTool size={16} />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={kanbanCards}
            columns={KANBAN_COLUMNS}
            defaultCollapsed={['abgeholt']}
            onCardClick={card => {
              const rid = card.id.split(':')[1];
              const auftrag = enrichedAuftraege.find(a => a.record_id === rid);
              if (auftrag) crud.auftraege.openDetail(auftrag);
            }}
            onCardMove={moveCard}
            onAddCard={column => crud.auftraege.openCreate({ status: column })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute fällig & überfällig')}
              items={[...ueberfaelligeAuftraege, ...heuteFaellig.filter(a =>
                !ueberfaelligeAuftraege.some(u => u.record_id === a.record_id)
              )].map(a => {
                const status = lookupKey(a.fields.status) ?? '';
                const isUeberfaellig = ueberfaelligeAuftraege.some(u => u.record_id === a.record_id);
                const nextStatusMap: Record<string, string> = {
                  angenommen: 'in_arbeit',
                  in_arbeit: 'fertig',
                };
                const next = nextStatusMap[status];
                const nextLabelMap: Record<string, string> = {
                  in_arbeit: tx('In Arbeit'),
                  fertig: tx('Fertig'),
                };
                return {
                  id: a.record_id,
                  title: `${a.fahrzeugName || '—'} · ${a.fields.auftragsnummer ?? '—'}`,
                  secondLine: (
                    <>
                      <span
                        className={
                          isUeberfaellig
                            ? 'font-medium text-destructive'
                            : 'font-medium text-amber-600'
                        }
                      >
                        {isUeberfaellig ? tx('Überfällig') : tx('Heute fällig')}
                      </span>
                      {a.mechanikerName && (
                        <span className="text-muted-foreground"> · {a.mechanikerName}</span>
                      )}
                      {a.fields.fertigstellungstermin && (
                        <span className="text-muted-foreground"> · {formatDate(a.fields.fertigstellungstermin)}</span>
                      )}
                    </>
                  ),
                  action: next
                    ? {
                        label: nextLabelMap[next] ?? '',
                        onClick: () => void advanceStatus(a, next),
                      }
                    : undefined,
                };
              })}
              onItemClick={id => {
                const a = enrichedAuftraege.find(r => r.record_id === id);
                if (a) crud.auftraege.openDetail(a);
              }}
              empty={{
                text: tx('Alle Aufträge pünktlich — super!'),
                action: {
                  label: tx('Neuer Auftrag'),
                  onClick: () => crud.auftraege.openCreate({ status: 'angenommen' }),
                },
              }}
            />

            <WorkList
              title={tx('Offene Rechnungen')}
              items={offeneRechnungen
                .sort((a, b) => {
                  const fa = a.fields.faelligkeit ?? '';
                  const fb = b.fields.faelligkeit ?? '';
                  return fa.localeCompare(fb);
                })
                .slice(0, 8)
                .map(r => {
                  const isUeberfaellig = ueberfaelligeRechnungen.some(u => u.record_id === r.record_id);
                  return {
                    id: r.record_id,
                    title: `${r.fields.rechnungsnummer || r.fields.rechnungsnummer || '—'} · ${r.kundeName || '—'}`,
                    secondLine: (
                      <>
                        <span
                          className={
                            isUeberfaellig ? 'font-medium text-destructive' : 'text-muted-foreground'
                          }
                        >
                          {r.fields.faelligkeit
                            ? (isUeberfaellig ? tx('Überfällig') + ' · ' : '') + formatDate(r.fields.faelligkeit)
                            : tx('Kein Fälligkeitsdatum')}
                        </span>
                        {r.fields.bruttobetrag != null && (
                          <span className="text-muted-foreground"> · {formatCurrency(r.fields.bruttobetrag)}</span>
                        )}
                      </>
                    ),
                    action: {
                      label: tx('Bezahlt'),
                      onClick: async () => {
                        const prev = r.fields.status;
                        const optimistic = lookupOption('rechnungen', 'status', 'bezahlt');
                        data.setRechnungen(prev2 =>
                          prev2.map(x =>
                            x.record_id === r.record_id
                              ? { ...x, fields: { ...x.fields, status: optimistic, zahlungseingang: today } }
                              : x,
                          ),
                        );
                        undoToast(
                          tx`${r.kundeName || r.fields.rechnungsnummer || ''} — als bezahlt markiert`,
                          async () => {
                            data.setRechnungen(p2 =>
                              p2.map(x =>
                                x.record_id === r.record_id
                                  ? { ...x, fields: { ...x.fields, status: prev, zahlungseingang: undefined } }
                                  : x,
                              ),
                            );
                            try {
                              await LivingAppsService.updateRechnungenEntry(r.record_id, {
                                status: lookupKey(prev) ?? 'offen',
                                zahlungseingang: undefined,
                              });
                            } catch {
                              await fetchAll();
                            }
                          },
                        );
                        try {
                          await LivingAppsService.updateRechnungenEntry(r.record_id, {
                            status: 'bezahlt',
                            zahlungseingang: today,
                          });
                        } catch {
                          await fetchAll();
                        }
                      },
                    },
                  };
                })}
              onItemClick={id => {
                const r = enrichedRechnungen.find(x => x.record_id === id);
                if (r) crud.rechnungen.openDetail(r);
              }}
              empty={{
                text: tx('Keine offenen Rechnungen — alle beglichen.'),
              }}
            />
          </>
        }
      />

      {/* Teile unter Mindestbestand — Warn-Banner wenn vorhanden */}
      {teileUnterMindest.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <IconAlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              {tx`${teileUnterMindest.length} Teile unter Mindestbestand`}
            </p>
            <p className="text-sm text-amber-700 truncate">
              {namen(teileUnterMindest.map(t => t.fields.bezeichnung || t.fields.artikelnummer || ''))}
            </p>
          </div>
          <button
            className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
            onClick={() => crud.teilebestand.openCreate({})}
          >
            {tx('Teil erfassen')}
          </button>
        </div>
      )}

      {crud.surfaces}
    </div>
  );
}
