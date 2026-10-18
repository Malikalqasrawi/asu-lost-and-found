import { Prisma } from '../generated/prisma/client.js';
import { MAX_DAYS_AFTER, WEIGHTS, type AlertSignals } from './match-score.js';

export interface Candidate extends AlertSignals {
  lostPostId: string;
  foundPostId: string;
  lostAuthorId: string;
  lostTitle: string;
  lostAuthorEmail: string;
}

interface CandidateRow {
  lost_id: string;
  found_id: string;
  lost_author_id: string;
  lost_title: string;
  lost_author_email: string;
  title_score: number;
  text_score: number;
  same_place: boolean;
  days_after: number;
}

/**
 * Open lost and found posts that could be the same item: the same category,
 * found from the day before the loss up to MAX_DAYS_AFTER days later, posted
 * by two different students, and not marked "Not mine". The date window is
 * written from both sides so the index on (type, category, happened_on) is
 * used whichever post is fixed, and the list is cut by the same score
 * match-score.ts gives, so plenty of look-alikes can't push a good match out.
 */
async function candidates(
  db: Prisma.TransactionClient,
  side: Prisma.Sql,
): Promise<Candidate[]> {
  const rows = await db.$queryRaw<CandidateRow[]>`
    SELECT * FROM (
      SELECT l.id AS lost_id, f.id AS found_id, l.author_id AS lost_author_id,
        l.title AS lost_title, u.email AS lost_author_email,
        similarity(l.title, f.title)::float8 AS title_score,
        GREATEST(
          similarity(l.title, f.title),
          CASE WHEN f.title ~ '\\S\\s+\\S'
            THEN 0.8 * word_similarity(f.title, l.title || ' ' || l.description)
            ELSE 0 END
        )::float8 AS text_score,
        (f.place_id = l.place_id) AS same_place,
        (f.happened_on - l.happened_on) AS days_after
      FROM posts l
      JOIN posts f
        ON f.type = 'FOUND' AND f.status = 'OPEN'
        AND f.category = l.category
        AND f.author_id <> l.author_id
        AND f.happened_on BETWEEN l.happened_on - 1
          AND l.happened_on + ${MAX_DAYS_AFTER}::int
        AND l.happened_on BETWEEN f.happened_on - ${MAX_DAYS_AFTER}::int
          AND f.happened_on + 1
      JOIN users u ON u.id = l.author_id
      WHERE l.type = 'LOST' AND l.status = 'OPEN' AND ${side}
        AND NOT EXISTS (
          SELECT 1 FROM match_dismissals d
          WHERE d.lost_post_id = l.id AND d.found_post_id = f.id
        )
    ) c
    ORDER BY
      ${WEIGHTS.text}::float8 * c.text_score
      + CASE WHEN c.same_place THEN ${WEIGHTS.place}::float8 ELSE 0 END
      + ${WEIGHTS.date}::float8 * GREATEST(0, LEAST(1,
          1 - (c.days_after - 1)::float8 / (${MAX_DAYS_AFTER}::int - 1)))
      DESC
    LIMIT 100`;
  return rows.map((row) => ({
    lostPostId: row.lost_id,
    foundPostId: row.found_id,
    lostAuthorId: row.lost_author_id,
    lostTitle: row.lost_title,
    lostAuthorEmail: row.lost_author_email,
    titleScore: row.title_score,
    textScore: row.text_score,
    samePlace: row.same_place,
    daysAfter: row.days_after,
  }));
}

export const foundItemsFor = (
  db: Prisma.TransactionClient,
  lostPostId: string,
) => candidates(db, Prisma.sql`l.id = ${lostPostId}::uuid`);

export const lostPostsFor = (
  db: Prisma.TransactionClient,
  foundPostId: string,
) => candidates(db, Prisma.sql`f.id = ${foundPostId}::uuid`);
