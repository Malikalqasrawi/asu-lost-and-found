import type { ModerationAction, Prisma } from '../generated/prisma/client.js';

type Target =
  { postId: string } | { messageId: string } | { studentId: string };

/** Written in the same transaction as the action, so the log can't miss one. */
export function logAction(
  db: Prisma.TransactionClient,
  adminId: string,
  action: ModerationAction,
  target: Target,
  note = '',
) {
  return db.moderationLog.create({
    data: { adminId, action, note, ...target },
  });
}

export const LOG_INCLUDE = {
  admin: { select: { fullName: true } },
  post: { select: { id: true, title: true } },
  message: {
    select: {
      id: true,
      handover: { select: { post: { select: { title: true } } } },
    },
  },
  student: { select: { id: true, fullName: true, email: true } },
} as const satisfies Prisma.ModerationLogInclude;

type LogWithTargets = Prisma.ModerationLogGetPayload<{
  include: typeof LOG_INCLUDE;
}>;

export interface LogEntryView {
  id: string;
  action: ModerationAction;
  admin: string;
  /** What the action was about, in words an admin recognises. */
  about: string;
  note: string;
  createdAt: Date;
}

function about(entry: LogWithTargets): string {
  if (entry.post) {
    return `Post "${entry.post.title}"`;
  }
  if (entry.message) {
    return `A message about "${entry.message.handover.post.title}"`;
  }
  return entry.student
    ? `${entry.student.fullName} (${entry.student.email})`
    : '';
}

export function toLogEntryView(entry: LogWithTargets): LogEntryView {
  return {
    id: entry.id,
    action: entry.action,
    admin: entry.admin.fullName,
    about: about(entry),
    note: entry.note,
    createdAt: entry.createdAt,
  };
}
