export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY_MS = 24 * HOUR;

/** A date filter for "in the last 24 hours". */
export const lastDay = () => ({ gte: new Date(Date.now() - DAY_MS) });
