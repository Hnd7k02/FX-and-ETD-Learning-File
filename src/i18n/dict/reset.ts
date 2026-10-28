import { defineDict } from '../types';

/** UI strings of the reset-progress island (About page). Kept small: it ships to the browser. */
export const reset = defineDict({
  de: {
    'reset.h': 'Fortschritt zurücksetzen',
    'reset.stored': 'Gespeicherter Fortschritt: {pct}',
    'reset.none': 'Noch kein Fortschritt gespeichert.',
    'reset.button': 'Fortschritt zurücksetzen',
    'reset.confirmTitle': 'Wirklich zurücksetzen?',
    'reset.confirmText':
      'Erledigte Abschnitte und Quiz-Ergebnisse in diesem Browser werden gelöscht. Das lässt sich nicht rückgängig machen.',
    'reset.confirm': 'Ja, zurücksetzen',
    'reset.cancel': 'Abbrechen',
    'reset.done': 'Fortschritt zurückgesetzt. Du startest wieder bei 01 Spot.',
    'reset.cancelled': 'Nichts geändert.',
  },
  en: {
    'reset.h': 'Reset progress',
    'reset.stored': 'Saved progress: {pct}',
    'reset.none': 'No progress saved yet.',
    'reset.button': 'Reset progress',
    'reset.confirmTitle': 'Really reset?',
    'reset.confirmText':
      'Completed sections and quiz results in this browser will be deleted. This cannot be undone.',
    'reset.confirm': 'Yes, reset',
    'reset.cancel': 'Cancel',
    'reset.done': 'Progress reset. You start again at 01 Spot.',
    'reset.cancelled': 'Nothing changed.',
  },
});
