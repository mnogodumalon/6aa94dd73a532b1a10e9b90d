import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, listPublicRecords, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig, type PublicRecordResult,
} from '@/lib/publicClient';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { tx } from '@/i18n';
import { format } from 'date-fns';

interface AuftragData {
  auftragsnummer: string;
  status: string;
  fertigstellungstermin: string | null;
  fahrzeugRef: string | null;
}

interface FahrzeugData {
  kennzeichen: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'dd.MM.yyyy');
  } catch {
    return '—';
  }
}

function recordIdFromRef(ref: string | null): string | null {
  if (!ref) return null;
  const parts = ref.split('/');
  return parts[parts.length - 1] ?? null;
}

export default function Auftragsstatus() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [auftrag, setAuftrag] = useState<AuftragData | null>(null);
  const [fahrzeug, setFahrzeug] = useState<FahrzeugData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig('auftragsstatus').then(c => {
      setCfg(c);
      setPage(c?.pages['auftragsstatus'] ?? null);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!cfg || !page) return;

    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const recordId = params.get('auftraege');

    if (!recordId) {
      setNotFound(true);
      return;
    }

    const auftragEp = page.endpoints?.find(e => e.entity === 'auftraege' && e.op === 'list');
    const fahrzeugEp = page.endpoints?.find(e => e.entity === 'fahrzeuge' && e.op === 'list');

    if (!auftragEp?.app_id) {
      setNotFound(true);
      return;
    }

    listPublicRecords(cfg, page, { appId: auftragEp.app_id })
      .then(results => {
        const record: PublicRecordResult | undefined = results[recordId];
        if (!record) {
          setNotFound(true);
          return;
        }

        const a: AuftragData = {
          auftragsnummer: (record.fields.auftragsnummer as string) ?? '',
          status: (record.fields.status as string) ?? '',
          fertigstellungstermin: (record.fields.fertigstellungstermin as string) ?? null,
          fahrzeugRef: (record.fields.fahrzeug as string) ?? null,
        };
        setAuftrag(a);

        const fahrzeugId = recordIdFromRef(a.fahrzeugRef);
        if (fahrzeugId && fahrzeugEp?.app_id) {
          return listPublicRecords(cfg, page, { appId: fahrzeugEp.app_id })
            .then(fResults => {
              const fRecord: PublicRecordResult | undefined = fResults[fahrzeugId];
              if (fRecord) {
                setFahrzeug({
                  kennzeichen: (fRecord.fields.kennzeichen as string) ?? '',
                });
              }
            });
        }
      })
      .catch(() => {
        setNotFound(true);
      });
  }, [cfg, page]);

  if (loading) {
    return <PublicShell loading />;
  }

  if (!cfg || !page) {
    return <PublicShell unavailable />;
  }

  if (notFound) {
    return (
      <PublicShell title={tx('Auftragsstatus')}>
        <p className="text-muted-foreground text-sm text-center py-6">
          {tx('Kein gültiger Auftragslink. Bitte wende dich an uns.')}
        </p>
      </PublicShell>
    );
  }

  if (!auftrag) {
    return <PublicShell loading />;
  }

  return (
    <PublicShell title={tx('Auftragsstatus')}>
      <dl className="space-y-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {tx('Auftragsnummer')}
          </dt>
          <dd className="text-base font-semibold">{auftrag.auftragsnummer}</dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {tx('Status')}
          </dt>
          <dd>
            <StatusBadge statusKey={auftrag.status} />
          </dd>
        </div>

        {fahrzeug && (
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {tx('Kennzeichen')}
            </dt>
            <dd className="text-base">{fahrzeug.kennzeichen}</dd>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {tx('Zugesagter Fertigstellungstermin')}
          </dt>
          <dd className="text-base">
            {auftrag.fertigstellungstermin
              ? formatDate(auftrag.fertigstellungstermin)
              : <span className="text-muted-foreground">{tx('Noch nicht festgelegt')}</span>}
          </dd>
        </div>
      </dl>
    </PublicShell>
  );
}
