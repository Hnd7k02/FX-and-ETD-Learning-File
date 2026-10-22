import { defineDict } from '../types';

/** Home page strings that are not in common.ts (hero chip, path, resume and Riskometer cards). */
export const home = defineDict({
  de: {
    'home.wowSection': 'Wow-Moment: vom Forward zur Option',
    'home.pathAria': 'Lernpfad mit {n} Stationen',
    'home.progressLabel': 'Gesamtfortschritt',
    'home.stationCurrent': 'in Arbeit',
    'home.stationOpen': 'offen',
    'home.pillCurrent': 'aktuell',
    'home.resumeSection': 'Weiterlernen und Markt',
    'home.riskPeriod': '1 Monat',
    'home.riskNoData': 'Noch keine Marktdaten geladen. Die Daten kommen mit dem nächsten Build.',
    'home.riskNoDataChip': 'Keine Daten',
    'home.riskAsOf': 'Stand {date}',
    'notFound.cta': 'Zum Lernpfad',
    'notFound.alt': 'Page not found · Back to the learning path',
  },
  en: {
    'home.wowSection': 'Wow moment: from forward to option',
    'home.pathAria': 'Learning path with {n} stations',
    'home.progressLabel': 'Overall progress',
    'home.stationCurrent': 'in progress',
    'home.stationOpen': 'open',
    'home.pillCurrent': 'current',
    'home.resumeSection': 'Continue learning and the market',
    'home.riskPeriod': '1 month',
    'home.riskNoData': 'No market data loaded yet. The data arrives with the next build.',
    'home.riskNoDataChip': 'No data',
    'home.riskAsOf': 'As of {date}',
    'notFound.cta': 'To the learning path',
    'notFound.alt': 'Seite nicht gefunden · Zum Lernpfad',
  },
});
