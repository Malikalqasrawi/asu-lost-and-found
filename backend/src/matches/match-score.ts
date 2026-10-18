/** A found item can be posted up to this many days after the lost one. */
export const MAX_DAYS_AFTER = 14;
/** Matches below this score aren't shown. */
export const SHOWN_FROM = 0.3;
/** Matches from this score on are worth an email, if the titles are alike too. */
export const STRONG_FROM = 0.6;
/** How alike the two titles themselves must be for an email. */
export const ALIKE_TITLES_FROM = 0.4;

/** Half for alike titles, a quarter for the same place, a quarter for close dates. */
export const WEIGHTS = { text: 0.5, place: 0.25, date: 0.25 } as const;

export interface MatchSignals {
  /** 0 to 1: how alike the titles are, by letter groups (pg_trgm). */
  textScore: number;
  samePlace: boolean;
  /** Days between the lost day and the found day; -1 means found the day before. */
  daysAfter: number;
}

export interface AlertSignals extends MatchSignals {
  /** 0 to 1: the titles compared with each other only. */
  titleScore: number;
}

/** 1 within a day of the loss, falling to 0 at the end of the window. */
function dateCloseness(daysAfter: number): number {
  if (daysAfter <= 1) {
    return 1;
  }
  return Math.max(0, 1 - (daysAfter - 1) / (MAX_DAYS_AFTER - 1));
}

export function matchScore(signals: MatchSignals): number {
  return (
    WEIGHTS.text * Math.min(1, Math.max(0, signals.textScore)) +
    (signals.samePlace ? WEIGHTS.place : 0) +
    WEIGHTS.date * dateCloseness(signals.daysAfter)
  );
}

/**
 * An email needs a strong match and alike titles, so a one-word title such as
 * "phone" can't reach everyone who lost a phone that week.
 */
export const worthAnEmail = (signals: AlertSignals) =>
  matchScore(signals) >= STRONG_FROM && signals.titleScore >= ALIKE_TITLES_FROM;

function whenFound(daysAfter: number): string {
  if (daysAfter < 0) {
    return 'Found the day before';
  }
  if (daysAfter === 0) {
    return 'Found the same day';
  }
  return daysAfter === 1
    ? 'Found the next day'
    : `Found ${daysAfter} days later`;
}

/** Why a found item was suggested, in the words the app shows. */
export function matchReasons(signals: MatchSignals): string[] {
  return [
    ...(signals.samePlace ? ['Same place'] : []),
    whenFound(signals.daysAfter),
    ...(signals.textScore >= 0.3 ? ['Similar title'] : []),
  ];
}
