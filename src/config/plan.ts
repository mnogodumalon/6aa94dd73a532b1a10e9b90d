// The orchestrator's plan, as far as the running app needs it
// (docs/orchestrator/SPEC.md). Generated — do not edit; regenerated on every
// build and update from the stored plan. Without a plan every map is empty
// and the guard in useJourneySubmit lets everything through.
//
//   FLOW_WRITES     slug → entity → fields the flow may write (its Schreibliste)
//   OWNERSHIP       entity → field → "intent:<slug>" | "tool:<id>"
//   PLAN_SENTENCES  slug → the plan in the owner's words (flows' field page)

export type FlowWrites = Record<string, string[]>;

export const HAS_PLAN = true;

export const FLOW_WRITES: Record<string, FlowWrites> = {
  "auftrag-anlegen": {
    "auftraege": [
      "fahrzeug",
      "mechaniker",
      "annahmedatum",
      "fertigstellungstermin",
      "kilometerstand_annahme",
      "kundenwunsch",
      "notizen",
      "status"
    ]
  },
  "position-erfassen": {
    "auftragspositionen": [
      "auftrag",
      "positionstyp",
      "bezeichnung",
      "menge",
      "einzelpreis",
      "mechaniker",
      "dauer_stunden",
      "teil"
    ]
  },
  "rechnung-erstellen": {
    "rechnungen": [
      "auftrag",
      "kunde",
      "rechnungsdatum",
      "faelligkeit",
      "mwst",
      "status"
    ],
    "auftraege": [
      "status"
    ]
  }
};

export const OWNERSHIP: Record<string, Record<string, string>> = {
  "auftraege": {
    "fahrzeug": "intent:auftrag-anlegen",
    "mechaniker": "intent:auftrag-anlegen",
    "annahmedatum": "intent:auftrag-anlegen",
    "fertigstellungstermin": "intent:auftrag-anlegen",
    "kilometerstand_annahme": "intent:auftrag-anlegen",
    "kundenwunsch": "intent:auftrag-anlegen",
    "notizen": "intent:auftrag-anlegen",
    "status": "intent:rechnung-erstellen",
    "auftragsnummer": "tool:auftragsnummer-vergeben"
  },
  "auftragspositionen": {
    "auftrag": "intent:position-erfassen",
    "positionstyp": "intent:position-erfassen",
    "bezeichnung": "intent:position-erfassen",
    "menge": "intent:position-erfassen",
    "einzelpreis": "intent:position-erfassen",
    "mechaniker": "intent:position-erfassen",
    "dauer_stunden": "intent:position-erfassen",
    "teil": "intent:position-erfassen"
  },
  "rechnungen": {
    "auftrag": "intent:rechnung-erstellen",
    "kunde": "intent:rechnung-erstellen",
    "rechnungsdatum": "intent:rechnung-erstellen",
    "faelligkeit": "intent:rechnung-erstellen",
    "mwst": "intent:rechnung-erstellen",
    "status": "intent:rechnung-erstellen",
    "rechnungsnummer": "tool:rechnungsnummer-vergeben",
    "nettobetrag": "tool:rechnungsnummer-vergeben",
    "bruttobetrag": "tool:rechnungsnummer-vergeben"
  },
  "teilebestand": {
    "bestand": "tool:bestand-abziehen"
  }
};

export const PLAN_SENTENCES: Record<string, string[]> = {
  "auftrag-anlegen": [
    "Legt an: auftraege",
    "Automatisch: annahmedatum (heutiges Datum, automatisch), status (fester Wert „angenommen“)"
  ],
  "position-erfassen": [
    "Legt an: auftragspositionen"
  ],
  "rechnung-erstellen": [
    "Legt an: rechnungen",
    "Ändert: auftraege",
    "Automatisch: rechnungsdatum (heutiges Datum, automatisch), status (fester Wert „offen“), status (fester Wert „abgerechnet“)"
  ]
};

export const PLAN_SUMMARY = "Auto Brandl ist eine freie Kfz-Werkstatt in Bamberg. Die Anwendung begleitet jeden Auftrag von der Fahrzeugannahme über die Werkstattarbeit bis zur Rechnung. Kunden und Fahrzeuge werden gepflegt, Aufträge mit Positionen (Arbeitszeit und Teile) erfasst, Rechnungen gestellt und der Teilebestand automatisch fortgeschrieben.";
