export type EnrollmentStatus = "ACTIVE" | "PAID_EXIT" | "ESCALATED" | "SUPPRESSED";

export interface Enrollment {
  id: string;
  borrowerId: string;
  dealerId: string;
  status: EnrollmentStatus;
  currentDay: number;
  nextScheduledAt: string;
  createdAt: string;
  updatedAt: string;
  paymentPostedAt?: string | null;
  suppressedReason?: string | null;
  escalationReason?: string | null;
  phone?: string;
  email?: string | null;
  vehicle?: string | null;
  amountDue?: number | null;
}

export type CallOutcome =
  | "payment_initiated_sms"
  | "intent_date_collected"
  | "follow_up_requested"
  | "stated_payment_already_made"
  | "opt_out_requested"
  | "transfer_to_live_agent"
  | "wrong_number"
  | "unclear_follow_up_scheduled"
  | "language_handoff"
  | "unanswered"
  | "id_failed";

export type TransferReason =
  | "make_payment"
  | "sensitive_case"
  | "borrower_requested_live_agent"
  | "vague_long_term_response"
  | "language_escalation"
  | "failed_identity_verification"
  | "undefined_transfer";

export type TouchSentEvent = {
  type: "TOUCH_SENT";
  channel: "sms" | "email" | "push" | "call";
  day: number;
  templateId?: string;
  sentAt: string;
};

export type CallCompletedEvent = {
  type: "CALL_COMPLETED";
  day: number;
  startedAt: string;
  endedAt: string;
  callOutcome: CallOutcome;
  transferReason?: TransferReason;
  intentDate?: string;
  notes?: string;
};

export type PaymentPostedEvent = {
  type: "PAYMENT_POSTED";
  postedAt: string;
  amount: number;
};

export type EscalatedEvent = {
  type: "ESCALATED";
  at: string;
  reason: string;
};

export type SuppressedEvent = {
  type: "SUPPRESSED";
  at: string;
  reason: string;
};

export type TimelineEvent =
  | TouchSentEvent
  | CallCompletedEvent
  | PaymentPostedEvent
  | EscalatedEvent
  | SuppressedEvent;

export interface TimelineResponse {
  events: TimelineEvent[];
}

export interface CreateEnrollmentPayload {
  borrowerId: string;
  dealerId: string;
  phone: string;
  email?: string;
  vehicle?: string;
  amountDue?: number;
}

export interface ReasonPayload {
  reason: string;
}
