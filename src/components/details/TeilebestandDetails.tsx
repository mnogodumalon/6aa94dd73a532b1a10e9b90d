import type { Teilebestand, Auftragspositionen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface TeilebestandDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Teilebestand;
  /** 1:N „Auftragspositionen" (teil): VOLLE Liste — der Block filtert auf diesen Record. */
  auftragspositionenList: Auftragspositionen[];
  /** Zeilen-Klick → overlay.push auf das Auftragspositionen-Detail (nie der Edit-Dialog). */
  onOpenAuftragspositionen: (record: Auftragspositionen) => void;
  /** Kontextuelles „+": öffnet den Auftragspositionen-Dialog mit diesem Record vorgesetzt. */
  onAddAuftragspositionen: () => void;
}

export function TeilebestandDetails({
  record,
  auftragspositionenList,
  onOpenAuftragspositionen,
  onAddAuftragspositionen,
}: TeilebestandDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('teilebestand', 'artikelnummer')} value={record.fields.artikelnummer} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'hersteller')} value={record.fields.hersteller} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'einkaufspreis')} value={record.fields.einkaufspreis} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'verkaufspreis')} value={record.fields.verkaufspreis} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'bestand')} value={record.fields.bestand} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'mindestbestand')} value={record.fields.mindestbestand} format="text" />
        <RecordField label={fieldLabel('teilebestand', 'lagerplatz')} value={record.fields.lagerplatz} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('auftragspositionen')}
        items={auftragspositionenList.filter(r => extractRecordId(r.fields.teil) === record.record_id)}
        map={r => ({ name: r.fields.bezeichnung ?? appLabel('auftragspositionen'), meta: undefined })}
        onOpen={onOpenAuftragspositionen}
        onAdd={onAddAuftragspositionen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TEILEBESTAND} recordId={record.record_id} />
    </>
  );
}
