import type {
  ClaimStatus,
  PostType,
  Prisma,
} from '../generated/prisma/client.js';

export const FINDER_CLAIM_INCLUDE = {
  claimant: { select: { fullName: true } },
  answers: { include: { question: true } },
} as const satisfies Prisma.ClaimInclude;

export const MY_CLAIM_INCLUDE = {
  post: { select: { id: true, title: true, type: true } },
  answers: { include: { question: true } },
} as const satisfies Prisma.ClaimInclude;

type FinderClaim = Prisma.ClaimGetPayload<{
  include: typeof FINDER_CLAIM_INCLUDE;
}>;
type MyClaim = Prisma.ClaimGetPayload<{ include: typeof MY_CLAIM_INCLUDE }>;
type WithAnswers = Pick<FinderClaim, 'answers'>;

interface AnswerView {
  question: string;
  answer: string;
}

/** What the finder sees: the answers to compare, and whether the serial matched. */
export interface FinderClaimView {
  id: string;
  status: ClaimStatus;
  claimant: { firstName: string };
  message: string;
  answers: AnswerView[];
  serialMatches: boolean | null;
  createdAt: Date;
  decidedAt: Date | null;
}

/** What the claimant sees: their own claim, never whether the serial matched. */
export interface MyClaimView {
  id: string;
  status: ClaimStatus;
  post: { id: string; title: string; type: PostType };
  message: string;
  answers: AnswerView[];
  createdAt: Date;
  decidedAt: Date | null;
}

function toAnswers(claim: WithAnswers): AnswerView[] {
  return [...claim.answers]
    .sort((a, b) => a.question.position - b.question.position)
    .map((item) => ({ question: item.question.text, answer: item.answer }));
}

export function toFinderClaimView(claim: FinderClaim): FinderClaimView {
  return {
    id: claim.id,
    status: claim.status,
    claimant: { firstName: claim.claimant.fullName.split(' ')[0] },
    message: claim.message,
    answers: toAnswers(claim),
    serialMatches: claim.serialMatches,
    createdAt: claim.createdAt,
    decidedAt: claim.decidedAt,
  };
}

export function toMyClaimView(claim: MyClaim): MyClaimView {
  return {
    id: claim.id,
    status: claim.status,
    post: claim.post,
    message: claim.message,
    answers: toAnswers(claim),
    createdAt: claim.createdAt,
    decidedAt: claim.decidedAt,
  };
}
