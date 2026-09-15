import type { Auftragspositionen, Auftraege, Mitarbeiter, Teilebestand } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface AuftragspositionenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Auftragspositionen;
  /** N:1-Ziel „Auftraege": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  auftraegeList: Auftraege[];
  /** Klick auf die Auftraege-Relation → overlay.push auf dessen Detail. */
  onOpenAuftraege?: (record: Auftraege) => void;
  /** N:1-Ziel „Mitarbeiter": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitarbeiterList: Mitarbeiter[];
  /** Klick auf die Mitarbeiter-Relation → overlay.push auf dessen Detail. */
  onOpenMitarbeiter?: (record: Mitarbeiter) => void;
  /** N:1-Ziel „Teilebestand": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teilebestandList: Teilebestand[];
  /** Klick auf die Teilebestand-Relation → overlay.push auf dessen Detail. */
  onOpenTeilebestand?: (record: Teilebestand) => void;
}

export function AuftragspositionenDetails({
  record,
  auftraegeList,
  onOpenAuftraege,
  mitarbeiterList,
  onOpenMitarbeiter,
  teilebestandList,
  onOpenTeilebestand,
}: AuftragspositionenDetailsProps) {
  const auftragTarget = auftraegeList.find(r => r.record_id === extractRecordId(record.fields.auftrag));
  const mechanikerTarget = mitarbeiterList.find(r => r.record_id === extractRecordId(record.fields.mechaniker));
  const teilTarget = teilebestandList.find(r => r.record_id === extractRecordId(record.fields.teil));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('auftragspositionen', 'positionstyp')} value={record.fields.positionstyp} format="pill" />
        <RecordField label={fieldLabel('auftragspositionen', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('auftragspositionen', 'menge')} value={record.fields.menge} format="text" />
        <RecordField label={fieldLabel('auftragspositionen', 'einzelpreis')} value={record.fields.einzelpreis} format="text" />
        <RecordField label={fieldLabel('auftragspositionen', 'dauer_stunden')} value={record.fields.dauer_stunden} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('auftragspositionen', 'auftrag')}
          name={auftragTarget?.fields.auftragsnummer ?? '—'}
          meta={undefined}
          onClick={auftragTarget && onOpenAuftraege ? () => onOpenAuftraege!(auftragTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('auftragspositionen', 'mechaniker')}
          name={mechanikerTarget?.fields.vorname ?? '—'}
          meta={[mechanikerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={mechanikerTarget && onOpenMitarbeiter ? () => onOpenMitarbeiter!(mechanikerTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('auftragspositionen', 'teil')}
          name={teilTarget?.fields.artikelnummer ?? '—'}
          meta={[teilTarget?.fields.bezeichnung, teilTarget?.fields.hersteller].filter(Boolean).join(' · ') || undefined}
          onClick={teilTarget && onOpenTeilebestand ? () => onOpenTeilebestand!(teilTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUFTRAGSPOSITIONEN} recordId={record.record_id} />
    </>
  );
}
