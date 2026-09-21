import type { Auftraege, Fahrzeuge, Mitarbeiter, Auftragspositionen, Rechnungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface AuftraegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Auftraege;
  /** N:1-Ziel „Fahrzeuge": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  fahrzeugeList: Fahrzeuge[];
  /** Klick auf die Fahrzeuge-Relation → overlay.push auf dessen Detail. */
  onOpenFahrzeuge?: (record: Fahrzeuge) => void;
  /** N:1-Ziel „Mitarbeiter": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitarbeiterList: Mitarbeiter[];
  /** Klick auf die Mitarbeiter-Relation → overlay.push auf dessen Detail. */
  onOpenMitarbeiter?: (record: Mitarbeiter) => void;
  /** 1:N „Auftragspositionen" (auftrag): VOLLE Liste — der Block filtert auf diesen Record. */
  auftragspositionenList: Auftragspositionen[];
  /** Zeilen-Klick → overlay.push auf das Auftragspositionen-Detail (nie der Edit-Dialog). */
  onOpenAuftragspositionen: (record: Auftragspositionen) => void;
  /** Kontextuelles „+": öffnet den Auftragspositionen-Dialog mit diesem Record vorgesetzt. */
  onAddAuftragspositionen: () => void;
  /** 1:N „Rechnungen" (auftrag): VOLLE Liste — der Block filtert auf diesen Record. */
  rechnungenList: Rechnungen[];
  /** Zeilen-Klick → overlay.push auf das Rechnungen-Detail (nie der Edit-Dialog). */
  onOpenRechnungen: (record: Rechnungen) => void;
  /** Kontextuelles „+": öffnet den Rechnungen-Dialog mit diesem Record vorgesetzt. */
  onAddRechnungen: () => void;
}

export function AuftraegeDetails({
  record,
  fahrzeugeList,
  onOpenFahrzeuge,
  mitarbeiterList,
  onOpenMitarbeiter,
  auftragspositionenList,
  onOpenAuftragspositionen,
  onAddAuftragspositionen,
  rechnungenList,
  onOpenRechnungen,
  onAddRechnungen,
}: AuftraegeDetailsProps) {
  const fahrzeugTarget = fahrzeugeList.find(r => r.record_id === extractRecordId(record.fields.fahrzeug));
  const mechanikerTarget = mitarbeiterList.find(r => r.record_id === extractRecordId(record.fields.mechaniker));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('auftraege', 'auftragsnummer')} value={record.fields.auftragsnummer} format="text" />
        <RecordField label={fieldLabel('auftraege', 'annahmedatum')} value={record.fields.annahmedatum} format="date" />
        <RecordField label={fieldLabel('auftraege', 'fertigstellungstermin')} value={record.fields.fertigstellungstermin} format="date" />
        <RecordField label={fieldLabel('auftraege', 'kundenwunsch')} value={record.fields.kundenwunsch} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('auftraege', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('auftraege', 'kilometerstand_annahme')} value={record.fields.kilometerstand_annahme} format="text" />
        <RecordField label={fieldLabel('auftraege', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('auftraege', 'fahrzeug')}
          name={fahrzeugTarget?.fields.kennzeichen ?? '—'}
          meta={[fahrzeugTarget?.fields.marke, fahrzeugTarget?.fields.modell].filter(Boolean).join(' · ') || undefined}
          onClick={fahrzeugTarget && onOpenFahrzeuge ? () => onOpenFahrzeuge!(fahrzeugTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('auftraege', 'mechaniker')}
          name={mechanikerTarget?.fields.vorname ?? '—'}
          meta={[mechanikerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={mechanikerTarget && onOpenMitarbeiter ? () => onOpenMitarbeiter!(mechanikerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('auftragspositionen')}
        items={auftragspositionenList.filter(r => extractRecordId(r.fields.auftrag) === record.record_id)}
        map={r => ({ name: r.fields.bezeichnung ?? appLabel('auftragspositionen'), meta: undefined })}
        onOpen={onOpenAuftragspositionen}
        onAdd={onAddAuftragspositionen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('rechnungen')}
        items={rechnungenList.filter(r => extractRecordId(r.fields.auftrag) === record.record_id)}
        map={r => ({ name: r.fields.rechnungsnummer ?? appLabel('rechnungen'), meta: r.fields.rechnungsdatum })}
        onOpen={onOpenRechnungen}
        onAdd={onAddRechnungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.AUFTRAEGE} recordId={record.record_id} />
    </>
  );
}
