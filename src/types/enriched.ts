import type { Auftraege, Auftragspositionen, Fahrzeuge, Rechnungen } from './app';

export type EnrichedFahrzeuge = Fahrzeuge & {
  halterName: string;
};

export type EnrichedAuftraege = Auftraege & {
  fahrzeugName: string;
  mechanikerName: string;
};

export type EnrichedAuftragspositionen = Auftragspositionen & {
  auftragName: string;
  mechanikerName: string;
  teilName: string;
};

export type EnrichedRechnungen = Rechnungen & {
  auftragName: string;
  kundeName: string;
};
