import { defineDict } from '../types';

/**
 * UI strings of the module template that are not in common.ts: the section-end marker,
 * the stepper's screen-reader states, the Quiz island (check and quiz mode) and the
 * "coming soon" placeholder for sections whose text is not written yet.
 */
export const moduleui = defineDict({
  de: {
    'stepper.done': 'erledigt',
    'stepper.current': 'aktuell',
    'stepper.quizShort': 'Quiz',
    'end.aria': 'Lesestand',
    'check.title': 'Kurz geprüft',
    'check.hint': 'Eine Frage zum Abschnitt, ohne Wertung.',
    'quiz.dots': 'Fragen',
    'quiz.dotOpen': 'Frage {n}: offen',
    'quiz.dotCorrect': 'Frage {n}: richtig',
    'quiz.dotWrong': 'Frage {n}: falsch',
    'quiz.dotCurrent': 'Frage {n}: aktuell',
    'quiz.srCorrect': 'richtige Antwort',
    'quiz.correctWas': 'Richtig ist {key}.',
    'quiz.resultTitle': 'Dein Ergebnis',
    'quiz.review': 'Deine Antworten',
    'quiz.reviewCorrect': 'richtig',
    'quiz.reviewWrong': 'falsch',
    'quiz.newBest': 'Neues bestes Ergebnis.',
    'quiz.passHint': 'Bestanden ab {pass} von {total}.',
    'coming.chip': 'In Arbeit',
    'coming.title': 'Dieser Abschnitt entsteht gerade.',
    'coming.text':
      'Die Inhalte folgen Modul für Modul. Der Aufbau bleibt gleich: Intuition am Fallbeispiel, ein interaktives Labor, ein Rechenbeispiel, die Herleitung zum Aufklappen und ein Merksatz.',
    'coming.quizTitle': 'Das Quiz zu diesem Modul entsteht gerade.',
    'coming.quizText':
      'Vier Fragen mit Erklärung zu jeder Antwort folgen, sobald die Abschnitte geschrieben sind.',
    'coming.cta': 'Was schon fertig ist',
  },
  en: {
    'stepper.done': 'done',
    'stepper.current': 'current',
    'stepper.quizShort': 'Quiz',
    'end.aria': 'Reading status',
    'check.title': 'Quick check',
    'check.hint': 'One question on this section, not graded.',
    'quiz.dots': 'Questions',
    'quiz.dotOpen': 'Question {n}: open',
    'quiz.dotCorrect': 'Question {n}: correct',
    'quiz.dotWrong': 'Question {n}: wrong',
    'quiz.dotCurrent': 'Question {n}: current',
    'quiz.srCorrect': 'correct answer',
    'quiz.correctWas': 'The correct answer is {key}.',
    'quiz.resultTitle': 'Your result',
    'quiz.review': 'Your answers',
    'quiz.reviewCorrect': 'correct',
    'quiz.reviewWrong': 'wrong',
    'quiz.newBest': 'New best result.',
    'quiz.passHint': 'Pass mark: {pass} of {total}.',
    'coming.chip': 'In progress',
    'coming.title': 'This section is being written.',
    'coming.text':
      'The content arrives module by module. The structure stays the same: intuition with the running example, an interactive lab, a worked example, the derivation to unfold and one key point.',
    'coming.quizTitle': 'The quiz for this module is being written.',
    'coming.quizText':
      'Four questions with an explanation for every answer follow once the sections are written.',
    'coming.cta': 'See what is ready',
  },
});
