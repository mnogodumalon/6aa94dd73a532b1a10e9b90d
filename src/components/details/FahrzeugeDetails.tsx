import type { Fahrzeuge, Kunden, Auftraege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface FahrzeugeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Fahrzeuge;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** 1:N „Aufträge" (fahrzeug): VOLLE Liste — der Block filtert auf diesen Record. */
  auftraegeList: Auftraege[];
  /** Zeilen-Klick → overlay.push auf das Auftraege-Detail (nie der Edit-Dialog). */
  onOpenAuftraege: (record: Auftraege) => void;
  /** Kontextuelles „+": öffnet den Auftraege-Dialog mit diesem Record vorgesetzt. */
  onAddAuftraege: () => void;
}

export function FahrzeugeDetails({
  record,
  kundenList,
  onOpenKunden,
  auftraegeList,
  onOpenAuftraege,
  onAddAuftraege,
}: FahrzeugeDetailsProps) {
  const halterTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.halter));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('fahrzeuge', 'kennzeichen')} value={record.fields.kennzeichen} format="text" />
        <RecordField label={fieldLabel('fahrzeuge', 'marke')} value={record.fields.marke} format="text" />
        <RecordField label={fieldLabel('fahrzeuge', 'modell')} value={record.fields.modell} format="text" />
        <RecordField label={fieldLabel('fahrzeuge', 'erstzulassung')} value={record.fields.erstzulassung} format="date" />
        <RecordField label={fieldLabel('fahrzeuge', 'kilometerstand')} value={record.fields.kilometerstand} format="text" />
        <RecordField label={fieldLabel('fahrzeuge', 'fahrgestellnummer')} value={record.fields.fahrgestellnummer} format="text" />
        <RecordField label={fieldLabel('fahrzeuge', 'hu_faellig')} value={record.fields.hu_faellig} format="date" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('fahrzeuge', 'halter')}
          name={halterTarget?.fields.vorname ?? '—'}
          meta={[halterTarget?.fields.telefon, halterTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={halterTarget && onOpenKunden ? () => onOpenKunden!(halterTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('auftraege')}
        items={auftraegeList.filter(r => extractRecordId(r.fields.fahrzeug) === record.record_id)}
        map={r => ({ name: r.fields.auftragsnummer ?? appLabel('auftraege'), meta: r.fields.annahmedatum })}
        onOpen={onOpenAuftraege}
        onAdd={onAddAuftraege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.FAHRZEUGE} recordId={record.record_id} />
    </>
  );
}
