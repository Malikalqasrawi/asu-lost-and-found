export const MINUTE = 60_000;
export const DAY_MS = 24 * 60 * MINUTE;

/** A date filter for "in the last 24 hours". */
export const lastDay = () => ({ gte: new Date(Date.now() - DAY_MS) });
