/**
 * The pacing rules of a play session, in one place so they are easy to tune.
 */

/**
 * Games to finish in a module before its home button stops being gated.
 * Until then, leaving needs a grown-up's sum: a toddler who has not played
 * even five rounds is leaving by accident, not because they are finished.
 */
export const UNLOCK_AFTER_GAMES = 5;

/**
 * Screen time after which the app suggests a rest. Paediatric guidance for
 * ages 2-5 is about an hour a day in total, with a grown-up alongside, so one
 * unbroken stretch of a quarter hour is already plenty.
 */
export const SESSION_LIMIT_MS = 15 * 60 * 1000;

/**
 * Once the limit is reached the rest screen waits for a natural pause - a
 * finished round, or the menu - rather than snatching the game away mid-tap.
 * If no pause comes within this long, it comes anyway.
 */
export const REST_GRACE_MS = 45 * 1000;

/** How long a round may sit untouched before its instruction is said again, once. */
export const IDLE_REMINDER_MS = 15 * 1000;

/** After this many finished games in a visit the child knows the drill: fewer reminders. */
export const KNOWS_THE_DRILL_AFTER = 3;
