/**
 * Required-field messages — WRITTEN BY THE BUILD AGENT, never by a heuristic.
 *
 * The layer knows two things about an empty required field: that it is
 * required and what its label is. Out of that it can only say „„Anreise" ist
 * ein Pflichtfeld". What the person should do instead („Bitte einen Gast
 * auswählen.") is meaning, and meaning is the agent's: the Phase-2 orchestrator
 * writes one short instruction per required field — what is needed, not why — to
 * `.intents-staging/messages.json`, the integration step validates it against
 * the app metadata and renders it into the block below. Scaffold updates keep
 * the block. Do not edit outside the markers.
 *
 * Every door reads this and nothing else: `useStepForm` (flows and public
 * pages), the generated {Entity}Dialog and the public form's server-error line.
 * A field without a sentence falls back to the label sentence — never to a
 * bare „Dieses Feld ist erforderlich".
 *
 * Required fields per entity (from the base view):
 *   - kunden: vorname (Vorname), nachname (Nachname), kundentyp (Kundentyp)
 *   - mitarbeiter: vorname (Vorname), nachname (Nachname), rolle (Rolle), status (Status)
 *   - teilebestand: artikelnummer (Artikelnummer), bezeichnung (Bezeichnung)
 *   - fahrzeuge: kennzeichen (Kennzeichen), marke (Marke), modell (Modell), halter (Halter (Kunde))
 *   - auftraege: auftragsnummer (Auftragsnummer), fahrzeug (Fahrzeug), annahmedatum (Annahmedatum), status (Status)
 *   - auftragspositionen: auftrag (Auftrag), positionstyp (Positionstyp), bezeichnung (Bezeichnung), menge (Menge), einzelpreis (Einzelpreis (€))
 *   - rechnungen: rechnungsnummer (Rechnungsnummer), auftrag (Auftrag), kunde (Kunde), rechnungsdatum (Rechnungsdatum), status (Status)
 */
import { t, tx } from '@/i18n';
import { labelOf, type EntityKey } from './rules';

/** The writable fields of each entity — the keys a message may address (generated). */
export interface MessageFields {
  "kunden": "vorname" | "nachname" | "kundentyp" | "telefon" | "email" | "strasse" | "hausnummer" | "plz" | "ort" | "notizen";
  "mitarbeiter": "email" | "vorname" | "nachname" | "rolle" | "stundensatz" | "status";
  "teilebestand": "artikelnummer" | "bezeichnung" | "hersteller" | "einkaufspreis" | "verkaufspreis" | "bestand" | "mindestbestand" | "lagerplatz";
  "fahrzeuge": "kennzeichen" | "marke" | "modell" | "erstzulassung" | "kilometerstand" | "fahrgestellnummer" | "hu_faellig" | "halter";
  "auftraege": "auftragsnummer" | "fahrzeug" | "annahmedatum" | "fertigstellungstermin" | "kundenwunsch" | "status" | "mechaniker" | "kilometerstand_annahme" | "notizen";
  "auftragspositionen": "auftrag" | "positionstyp" | "bezeichnung" | "menge" | "einzelpreis" | "mechaniker" | "dauer_stunden" | "teil";
  "rechnungen": "rechnungsnummer" | "auftrag" | "kunde" | "rechnungsdatum" | "faelligkeit" | "nettobetrag" | "mwst" | "bruttobetrag" | "status" | "zahlungseingang";
}
export type MessageFieldKey<E extends EntityKey> = E extends keyof MessageFields ? MessageFields[E] : never;

export const REQUIRED_MESSAGES: { [E in EntityKey]?: Partial<Record<MessageFieldKey<E>, string>> } = {
  // <custom:messages>
  kunden: { vorname: "Bitte den Vornamen eingeben.", nachname: "Bitte den Nachnamen eingeben.", kundentyp: "Bitte den Kundentyp wählen." },
  mitarbeiter: { vorname: "Bitte den Vornamen eingeben.", nachname: "Bitte den Nachnamen eingeben.", rolle: "Bitte die Rolle wählen.", status: "Bitte den Status wählen." },
  teilebestand: { artikelnummer: "Bitte die Artikelnummer eingeben.", bezeichnung: "Bitte die Bezeichnung eingeben." },
  fahrzeuge: { kennzeichen: "Bitte das Kennzeichen eingeben.", marke: "Bitte die Marke eingeben.", modell: "Bitte das Modell eingeben.", halter: "Bitte den Kunden als Halter auswählen." },
  auftraege: { auftragsnummer: "Bitte die Auftragsnummer eingeben.", fahrzeug: "Bitte ein Fahrzeug auswählen.", annahmedatum: "Bitte das Annahmedatum wählen.", status: "Bitte den Status wählen." },
  auftragspositionen: { auftrag: "Bitte einen Auftrag auswählen.", positionstyp: "Bitte den Positionstyp wählen.", bezeichnung: "Bitte die Bezeichnung eingeben.", menge: "Bitte die Menge eingeben.", einzelpreis: "Bitte den Einzelpreis eingeben." },
  rechnungen: { rechnungsnummer: "Bitte die Rechnungsnummer eingeben.", auftrag: "Bitte einen Auftrag auswählen.", kunde: "Bitte den Kunden auswählen.", rechnungsdatum: "Bitte das Rechnungsdatum wählen.", status: "Bitte den Status wählen." },
  // </custom:messages>
};

/** The sentence shown when `key` of `entity` is required and empty — the
 *  agent's own text (translated at runtime like every page string), else the
 *  label sentence. Call it while rendering, not at module scope. */
export function requiredMessage(entity: EntityKey, key: string): string {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  if (own && own.trim()) return tx(own);
  return t('v_required', { label: labelOf(entity, key) });
}

/** True when the agent wrote a sentence for the field. */
export function hasOwnMessage(entity: EntityKey, key: string): boolean {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  return Boolean(own && own.trim());
}
