import type {
  HideCause,
  PostStatus,
  PostType,
  Prisma,
  ReportReason,
  ReportStatus,
} from '../generated/prisma/client.js';

export const REPORT_INCLUDE = {
  reporter: { select: { fullName: true } },
  post: {
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      status: true,
      hiddenAt: true,
      hideCause: true,
      photos: { orderBy: { position: 'asc' }, select: { id: true } },
      author: { select: { id: true, fullName: true, email: true } },
    },
  },
  message: {
    select: {
      id: true,
      text: true,
      removedAt: true,
      createdAt: true,
      sender: { select: { id: true, fullName: true, email: true } },
      handover: { select: { post: { select: { title: true } } } },
    },
  },
} as const satisfies Prisma.ReportInclude;

type ReportWithTarget = Prisma.ReportGetPayload<{
  include: typeof REPORT_INCLUDE;
}>;

interface Person {
  id: string;
  fullName: string;
  email: string;
}

export type ReportTarget =
  | {
      kind: 'POST';
      id: string;
      title: string;
      description: string;
      /** The photos students see, blurred for found items. */
      photoIds: string[];
      type: PostType;
      status: PostStatus;
      hidden: boolean;
      /** A moderator's decision stays after a ban ends; a ban's hiding doesn't. */
      hiddenBy: HideCause | null;
      author: Person;
    }
  | {
      kind: 'MESSAGE';
      id: string;
      /** Only the reported message, never the rest of the chat. */
      text: string;
      removed: boolean;
      sentAt: Date;
      postTitle: string;
      sender: Person;
    };

/** Every report about one post or one message, for one decision. */
export interface ReportCase {
  target: ReportTarget;
  status: ReportStatus;
  reports: {
    id: string;
    reason: ReportReason;
    details: string;
    reporter: string;
    createdAt: Date;
  }[];
}

function targetOf(report: ReportWithTarget): ReportTarget | null {
  const { post, message } = report;
  if (post) {
    const { hiddenAt, hideCause, photos, ...rest } = post;
    return {
      kind: 'POST',
      ...rest,
      photoIds: photos.map((photo) => photo.id),
      hidden: hiddenAt !== null,
      hiddenBy: hideCause,
    };
  }
  if (!message) {
    return null;
  }
  return {
    kind: 'MESSAGE',
    id: message.id,
    text: message.text,
    removed: message.removedAt !== null,
    sentAt: message.createdAt,
    postTitle: message.handover.post.title,
    sender: message.sender,
  };
}

/** Groups reports by what they are about, the most reported first. */
export function toCases(reports: ReportWithTarget[]): ReportCase[] {
  const cases = new Map<string, ReportCase>();
  for (const report of reports) {
    const target = targetOf(report);
    if (!target) {
      continue;
    }
    const key = `${target.kind}:${target.id}`;
    const found = cases.get(key) ?? {
      target,
      status: report.status,
      reports: [],
    };
    found.reports.push({
      id: report.id,
      reason: report.reason,
      details: report.details,
      reporter: report.reporter.fullName,
      createdAt: report.createdAt,
    });
    cases.set(key, found);
  }
  return [...cases.values()].sort(
    (a, b) => b.reports.length - a.reports.length,
  );
}
