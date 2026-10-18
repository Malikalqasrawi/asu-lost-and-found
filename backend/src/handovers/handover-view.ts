import {
  firstName,
  type ChatMessage,
  type ChatPreview,
  MAX_WRONG_CODES,
  type HandoverRole,
  type HandoverWithPeople,
} from './handover-access.js';

export interface HandoverView {
  postId: string;
  title: string;
  role: HandoverRole;
  otherPerson: { firstName: string };
  /** Only the owner sees it, and only until the item has changed hands. */
  pickupCode: string | null;
  codeLocked: boolean;
  returnedAt: Date | null;
  unread: number;
}

export interface MessageView {
  id: string;
  mine: boolean;
  text: string;
  createdAt: Date;
}

export interface HandoverSummary {
  postId: string;
  title: string;
  role: HandoverRole;
  otherPerson: { firstName: string };
  lastMessage: MessageView | null;
  unread: number;
  returnedAt: Date | null;
}

const otherPerson = (handover: HandoverWithPeople, role: HandoverRole) => ({
  firstName: firstName(
    role === 'FINDER' ? handover.owner.fullName : handover.finder.fullName,
  ),
});

export function toHandoverView(
  handover: HandoverWithPeople,
  role: HandoverRole,
  unread: number,
): HandoverView {
  const showCode = role === 'OWNER' && !handover.returnedAt;
  return {
    postId: handover.postId,
    title: handover.post.title,
    role,
    otherPerson: otherPerson(handover, role),
    pickupCode: showCode ? handover.pickupCode : null,
    codeLocked: handover.wrongCodes >= MAX_WRONG_CODES,
    returnedAt: handover.returnedAt,
    unread,
  };
}

export function toMessageView(
  message: ChatMessage,
  viewerId: string,
): MessageView {
  return {
    id: message.id,
    mine: message.senderId === viewerId,
    text: message.text,
    createdAt: message.createdAt,
  };
}

export function toHandoverSummary(
  handover: HandoverWithPeople,
  role: HandoverRole,
  viewerId: string,
  preview: ChatPreview,
): HandoverSummary {
  const last = preview.lastMessage;
  return {
    postId: handover.postId,
    title: handover.post.title,
    role,
    otherPerson: otherPerson(handover, role),
    lastMessage: last ? toMessageView(last, viewerId) : null,
    unread: preview.unread,
    returnedAt: handover.returnedAt,
  };
}
