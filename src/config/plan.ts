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
    "kunden": [
      "vorname",
      "nachname",
      "kundentyp",
      "telefon",
      "email",
      "strasse",
      "hausnummer",
      "plz",
      "ort",
      "notizen"
    ],
    "fahrzeuge": [
      "kennzeichen",
      "marke",
      "modell",
      "erstzulassung",
      "kilometerstand",
      "hu_faellig",
      "halter"
    ],
    "auftraege": [
      "fahrzeug",
      "annahmedatum",
      "fertigstellungstermin",
      "kundenwunsch",
      "mechaniker",
      "kilometerstand_annahme",
      "notizen",
      "status"
    ]
  },
  "position-hinzufuegen": {
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
      "nettobetrag",
      "mwst",
      "bruttobetrag",
      "status"
    ],
    "auftraege": [
      "status"
    ]
  }
};

export const OWNERSHIP: Record<string, Record<string, string>> = {
  "kunden": {
    "vorname": "intent:auftrag-anlegen",
    "nachname": "intent:auftrag-anlegen",
    "kundentyp": "intent:auftrag-anlegen",
    "telefon": "intent:auftrag-anlegen",
    "email": "intent:auftrag-anlegen",
    "strasse": "intent:auftrag-anlegen",
    "hausnummer": "intent:auftrag-anlegen",
    "plz": "intent:auftrag-anlegen",
    "ort": "intent:auftrag-anlegen",
    "notizen": "intent:auftrag-anlegen"
  },
  "fahrzeuge": {
    "kennzeichen": "intent:auftrag-anlegen",
    "marke": "intent:auftrag-anlegen",
    "modell": "intent:auftrag-anlegen",
    "erstzulassung": "intent:auftrag-anlegen",
    "kilometerstand": "intent:auftrag-anlegen",
    "hu_faellig": "intent:auftrag-anlegen",
    "halter": "intent:auftrag-anlegen"
  },
  "auftraege": {
    "fahrzeug": "intent:auftrag-anlegen",
    "annahmedatum": "intent:auftrag-anlegen",
    "fertigstellungstermin": "intent:auftrag-anlegen",
    "kundenwunsch": "intent:auftrag-anlegen",
    "mechaniker": "intent:auftrag-anlegen",
    "kilometerstand_annahme": "intent:auftrag-anlegen",
    "notizen": "intent:auftrag-anlegen",
    "status": "intent:rechnung-erstellen",
    "auftragsnummer": "tool:auftragsnummer-vergeben"
  },
  "auftragspositionen": {
    "auftrag": "intent:position-hinzufuegen",
    "positionstyp": "intent:position-hinzufuegen",
    "bezeichnung": "intent:position-hinzufuegen",
    "menge": "intent:position-hinzufuegen",
    "einzelpreis": "intent:position-hinzufuegen",
    "mechaniker": "intent:position-hinzufuegen",
    "dauer_stunden": "intent:position-hinzufuegen",
    "teil": "intent:position-hinzufuegen"
  },
  "rechnungen": {
    "auftrag": "intent:rechnung-erstellen",
    "kunde": "intent:rechnung-erstellen",
    "rechnungsdatum": "intent:rechnung-erstellen",
    "faelligkeit": "intent:rechnung-erstellen",
    "nettobetrag": "intent:rechnung-erstellen",
    "mwst": "intent:rechnung-erstellen",
    "bruttobetrag": "intent:rechnung-erstellen",
    "status": "intent:rechnung-erstellen",
    "rechnungsnummer": "tool:rechnungsnummer-vergeben"
  },
  "teilebestand": {
    "bestand": "tool:bestand-abziehen"
  }
};

export const PLAN_SENTENCES: Record<string, string[]> = {
  "auftrag-anlegen": [
    "Legt an: auftraege, fahrzeuge, kunden",
    "Automatisch: annahmedatum (heutiges Datum, automatisch), status (fester Wert „angenommen“)"
  ],
  "position-hinzufuegen": [
    "Legt an: auftragspositionen"
  ],
  "rechnung-erstellen": [
    "Legt an: rechnungen",
    "Ändert: auftraege",
    "Automatisch: rechnungsdatum (heutiges Datum, automatisch), status (fester Wert „offen“), status (fester Wert „abgerechnet“)"
  ]
};

export const PLAN_SUMMARY = "Werkstatt Auto Brandl ist eine freie Kfz-Werkstatt in Bamberg. Die Anwendung begleitet jeden Auftrag von der Fahrzeugannahme über die Werkstattarbeit bis zur Rechnungsstellung. Kunden und Fahrzeuge werden verwaltet, Aufträge mit Positionen (Arbeitszeit und Teile) erfasst, der Teilebestand automatisch gepflegt und Rechnungen erzeugt.";
