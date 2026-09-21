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
  "auftrag-annehmen": {
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
    "vorname": "intent:auftrag-annehmen",
    "nachname": "intent:auftrag-annehmen",
    "kundentyp": "intent:auftrag-annehmen",
    "telefon": "intent:auftrag-annehmen",
    "email": "intent:auftrag-annehmen",
    "strasse": "intent:auftrag-annehmen",
    "hausnummer": "intent:auftrag-annehmen",
    "plz": "intent:auftrag-annehmen",
    "ort": "intent:auftrag-annehmen",
    "notizen": "intent:auftrag-annehmen"
  },
  "fahrzeuge": {
    "kennzeichen": "intent:auftrag-annehmen",
    "marke": "intent:auftrag-annehmen",
    "modell": "intent:auftrag-annehmen",
    "erstzulassung": "intent:auftrag-annehmen",
    "kilometerstand": "intent:auftrag-annehmen",
    "hu_faellig": "intent:auftrag-annehmen",
    "halter": "intent:auftrag-annehmen"
  },
  "auftraege": {
    "fahrzeug": "intent:auftrag-annehmen",
    "annahmedatum": "intent:auftrag-annehmen",
    "fertigstellungstermin": "intent:auftrag-annehmen",
    "kundenwunsch": "intent:auftrag-annehmen",
    "mechaniker": "intent:auftrag-annehmen",
    "kilometerstand_annahme": "intent:auftrag-annehmen",
    "notizen": "intent:auftrag-annehmen",
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
  "auftrag-annehmen": [
    "Legt an: auftraege, fahrzeuge, kunden",
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

export const PLAN_SUMMARY = "Auto Brandl ist eine freie Kfz-Werkstatt in Bamberg. Die Anwendung begleitet jeden Auftrag vom Eingang des Fahrzeugs über die Werkstattarbeit bis zur bezahlten Rechnung. Die Annahme legt Kunden, Fahrzeuge und Aufträge an und stellt Rechnungen aus. Mechaniker erfassen Arbeitszeit und verbaute Teile direkt am Auftrag. Der Chef behält Teilepreise, Stundensätze und den Gesamtüberblick im Griff. Lagerbestand wird automatisch beim Einbau eines Teils reduziert; Auftragsnummern und Rechnungsnummern vergibt das System fortlaufend.";
