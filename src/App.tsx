import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  FileText,
  Settings,
  Search,
  ArrowLeft,
  MessageSquare,
  Mail,
  Phone,
  Bell,
  Ban,
  CircleDollarSign,
} from "lucide-react";
import { sequenceApi } from "./lib/api";
import type {
  CallOutcome,
  CreateEnrollmentPayload,
  Enrollment,
  EnrollmentStatus,
  TimelineEvent,
  TransferReason,
} from "./types/sequence";

const TOKENS = {
  bg: "bg-[#0A0711]",
  panel: "bg-[#120D20]",
  border: "border-white/10",
  carpayBlue: "#0052CC",
  aiIndigo: "#6554C0",
  emerald: "#22C55E",
  amber: "#FBBF24",
  red: "#EF4444",
} as const;

type SidebarKey = "dashboard" | "customers" | "escalations" | "reports" | "settings";

type SidebarItem = {
  key: SidebarKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
};

const SIDEBAR: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "customers", label: "Customers", icon: Users },
  { key: "escalations", label: "Escalations", icon: AlertTriangle },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings },
];

const STATUS_ORDER: EnrollmentStatus[] = ["ACTIVE", "ESCALATED", "PAID_EXIT", "SUPPRESSED"];

const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  payment_initiated_sms: "Payment initiated via SMS",
  intent_date_collected: "Intent date collected",
  follow_up_requested: "Follow-up requested",
  stated_payment_already_made: "Stated payment already made",
  opt_out_requested: "Opt-out requested",
  transfer_to_live_agent: "Transferred to live agent",
  wrong_number: "Wrong number",
  unclear_follow_up_scheduled: "Unclear follow-up scheduled",
  language_handoff: "Language handoff",
  unanswered: "Unanswered",
  id_failed: "Identity verification failed",
};

const TRANSFER_REASON_LABELS: Record<TransferReason, string> = {
  make_payment: "Make payment",
  sensitive_case: "Sensitive case",
  borrower_requested_live_agent: "Borrower requested live agent",
  vague_long_term_response: "Vague long-term response",
  language_escalation: "Language escalation",
  failed_identity_verification: "Failed identity verification",
  undefined_transfer: "Undefined transfer",
};

function cx(...classes: Array<string | null | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function statusStyle(status: EnrollmentStatus) {
  if (status === "PAID_EXIT") return { dot: TOKENS.emerald, bg: "rgba(34,197,94,0.14)", text: "rgba(34,197,94,0.95)" };
  if (status === "ESCALATED") return { dot: TOKENS.red, bg: "rgba(239,68,68,0.12)", text: "rgba(239,68,68,0.95)" };
  if (status === "SUPPRESSED") return { dot: TOKENS.amber, bg: "rgba(251,191,36,0.14)", text: "rgba(251,191,36,0.95)" };
  return { dot: TOKENS.carpayBlue, bg: "rgba(0,82,204,0.16)", text: "rgba(164,201,255,1)" };
}

function eventTimestamp(event: TimelineEvent) {
  if (event.type === "TOUCH_SENT") return event.sentAt;
  if (event.type === "CALL_COMPLETED") return event.endedAt;
  if (event.type === "PAYMENT_POSTED") return event.postedAt;
  return event.at;
}

function eventDay(event: TimelineEvent) {
  if (event.type === "TOUCH_SENT" || event.type === "CALL_COMPLETED") return event.day;
  return null;
}

function eventTitle(event: TimelineEvent) {
  switch (event.type) {
    case "TOUCH_SENT":
      return `Touch sent · ${event.channel.toUpperCase()}`;
    case "CALL_COMPLETED":
      return `Call completed · ${CALL_OUTCOME_LABELS[event.callOutcome]}`;
    case "PAYMENT_POSTED":
      return `Payment posted · ${formatCurrency(event.amount)}`;
    case "ESCALATED":
      return "Enrollment escalated";
    case "SUPPRESSED":
      return "Enrollment suppressed";
  }
}

function channelIcon(channel: "sms" | "email" | "push" | "call") {
  if (channel === "sms") return MessageSquare;
  if (channel === "email") return Mail;
  if (channel === "push") return Bell;
  return Phone;
}

function useEnrollments(status: EnrollmentStatus) {
  const [data, setData] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await sequenceApi.listEnrollments(status);
      setData(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}

function useEnrollmentDetail(id: string | null) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [enroll, timeline] = await Promise.all([sequenceApi.getEnrollment(id), sequenceApi.getTimeline(id)]);
      setEnrollment(enroll);
      setEvents(timeline.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrollment details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void load();
  }, [id, load]);

  return { enrollment, events, loading, error, refresh: load };
}

function Shell({ active, onNavigate, children }: { active: SidebarKey; onNavigate: (k: SidebarKey) => void; children: React.ReactNode }) {
  return (
    <div className={cx("min-h-screen", TOKENS.bg, "text-white")}>
      <div className={cx("fixed left-0 top-0 z-40 h-screen w-[76px] border-r", TOKENS.border)} style={{ background: "rgba(15,11,26,0.95)" }}>
        <div className="flex h-full flex-col p-3">
          <div className="mb-3 flex justify-center">
            <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">JG</div>
          </div>
          <nav className="space-y-1">
            {SIDEBAR.map((it) => {
              const Icon = it.icon;
              const isActive = active === it.key;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onNavigate(it.key)}
                  className={cx("group relative flex w-full justify-center rounded-xl px-3 py-2", isActive ? "bg-white/10" : "hover:bg-white/5")}
                  title={it.label}
                >
                  <Icon size={18} style={{ color: isActive ? TOKENS.carpayBlue : "rgba(255,255,255,0.65)" }} />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pl-[76px]">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0711]/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
            <div className="text-sm font-medium">Carpay / Collect</div>
            <div className="text-sm text-white/70">Dealer: <span className="text-white">ABC Motors</span></div>
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-6">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ status, currentDay }: { status: EnrollmentStatus; currentDay: number }) {
  const pill = statusStyle(status);
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ background: pill.bg, color: pill.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} />
      {status} · Day {currentDay}
    </span>
  );
}

function EnrollModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<CreateEnrollmentPayload>({ borrowerId: "", dealerId: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await sequenceApi.createEnrollment(form);
      setError(null);
      onDone();
      onClose();
      setForm({ borrowerId: "", dealerId: "", phone: "", email: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to enroll borrower");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <Card className={cx("w-full max-w-xl rounded-2xl border", TOKENS.border, TOKENS.panel)}>
        <CardHeader><CardTitle>Enroll borrower in day 0–10 sequence</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input required value={form.borrowerId} onChange={(e) => setForm((v) => ({ ...v, borrowerId: e.target.value }))} placeholder="Borrower ID" className="border-white/10 bg-white/5" />
            <Input required value={form.dealerId} onChange={(e) => setForm((v) => ({ ...v, dealerId: e.target.value }))} placeholder="Dealer ID" className="border-white/10 bg-white/5" />
            <Input required value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} placeholder="Phone" className="border-white/10 bg-white/5" />
            <Input value={form.email ?? ""} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} placeholder="Email (optional)" className="border-white/10 bg-white/5" />
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="border-white/10 bg-white/5" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving} style={{ backgroundColor: TOKENS.carpayBlue }}>{saving ? "Enrolling..." : "Enroll"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardPage({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [mode, setMode] = useState<EnrollmentStatus>("ACTIVE");
  const { data, loading, error, refresh } = useEnrollments(mode);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <button key={status} onClick={() => setMode(status)} className="text-left">
            <Card className={cx("rounded-2xl border", TOKENS.border, TOKENS.panel, mode === status ? "ring-1 ring-blue-500" : "")}> 
              <CardHeader className="pb-1"><CardTitle className="text-sm">{status}</CardTitle></CardHeader>
              <CardContent><div className="text-3xl">{status === mode ? data.length : "—"}</div></CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card className={cx("rounded-2xl border", TOKENS.border, TOKENS.panel)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">Work Queue <Button variant="outline" onClick={refresh} className="border-white/10 bg-white/5">Refresh</Button></CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-white/10" />)}</div> : null}
          {error ? <div className="text-red-300">{error}</div> : null}
          {!loading && !error ? (
            <div className="divide-y divide-white/10">
              {data.map((row) => (
                <div key={row.id} className="grid grid-cols-12 items-center gap-2 py-3 text-sm">
                  <button className="col-span-6 text-left" onClick={() => onOpenCustomer(row.id)}>
                    <div className="font-medium">Borrower {row.borrowerId}</div>
                    <div className="text-xs text-white/50">Dealer {row.dealerId}</div>
                  </button>
                  <div className="col-span-3"><StatusPill status={row.status} currentDay={row.currentDay} /></div>
                  <div className="col-span-3 text-right text-white/70">Next: {formatDate(row.nextScheduledAt)}</div>
                </div>
              ))}
              {!data.length ? <div className="py-6 text-white/55">No enrollments found for this status.</div> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersPage({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [status, setStatus] = useState<EnrollmentStatus>("ACTIVE");
  const [query, setQuery] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const { data, loading, error, refresh } = useEnrollments(status);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data;
    return data.filter((e) => [e.borrowerId, e.dealerId, e.id].some((value) => value.toLowerCase().includes(term)));
  }, [data, query]);

  return (
    <div className="space-y-4">
      <EnrollModal open={showEnroll} onClose={() => setShowEnroll(false)} onDone={refresh} />
      <Card className={cx("rounded-2xl border p-4", TOKENS.border, TOKENS.panel)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold">Enrollments</div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowEnroll(true)} style={{ backgroundColor: TOKENS.carpayBlue }}>Enroll</Button>
            <Button variant="outline" onClick={refresh} className="border-white/10 bg-white/5">Refresh</Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {STATUS_ORDER.map((item) => (
            <Button key={item} onClick={() => setStatus(item)} variant="outline" className={cx("border-white/10 bg-white/5", item === status && "ring-1 ring-blue-500")}>{item}</Button>
          ))}
          <div className="relative ml-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search enrollment" className="h-9 w-72 border-white/10 bg-white/5 pl-9" />
          </div>
        </div>

        {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-white/10" />)}</div> : null}
        {error ? <div className="text-red-300">{error}</div> : null}

        {!loading && !error ? (
          <div className="divide-y divide-white/10">
            {filtered.map((e) => (
              <div key={e.id} className="grid grid-cols-12 items-center gap-3 py-3 text-sm">
                <button onClick={() => onOpenCustomer(e.id)} className="col-span-5 text-left">
                  <div className="font-medium">Borrower {e.borrowerId}</div>
                  <div className="text-xs text-white/50">Enrollment {e.id}</div>
                </button>
                <div className="col-span-3"><StatusPill status={e.status} currentDay={e.currentDay} /></div>
                <div className="col-span-2 text-right">{formatCurrency(e.amountDue)}</div>
                <div className="col-span-2 text-right text-white/70">{formatDate(e.nextScheduledAt)}</div>
              </div>
            ))}
            {!filtered.length ? <div className="py-6 text-white/55">No matching enrollments.</div> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function TimelineList({ events }: { events: TimelineEvent[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    const sorted = [...events].sort((a, b) => +new Date(eventTimestamp(b)) - +new Date(eventTimestamp(a)));
    sorted.forEach((event) => {
      const day = eventDay(event);
      const key = day == null ? "System Events" : `Day ${day}`;
      const arr = map.get(key) ?? [];
      arr.push(event);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([dayLabel, dayEvents]) => (
        <Card key={dayLabel} className={cx("rounded-2xl border", TOKENS.border, TOKENS.panel)}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{dayLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dayEvents.map((event, idx) => {
              const Icon = event.type === "TOUCH_SENT" ? channelIcon(event.channel) : event.type === "PAYMENT_POSTED" ? CircleDollarSign : event.type === "SUPPRESSED" ? Ban : AlertTriangle;
              return (
                <div key={`${dayLabel}-${idx}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><Icon size={16} className="text-white/70" /> {eventTitle(event)}</div>
                    <div className="text-xs text-white/55">{formatDate(eventTimestamp(event))}</div>
                  </div>
                  {event.type === "CALL_COMPLETED" ? (
                    <div className="mt-2 text-xs text-white/70">
                      Outcome: {CALL_OUTCOME_LABELS[event.callOutcome]}
                      {event.transferReason ? ` · Transfer reason: ${TRANSFER_REASON_LABELS[event.transferReason]}` : ""}
                      {event.intentDate ? ` · Intent date: ${event.intentDate}` : ""}
                      {event.notes ? ` · Notes: ${event.notes}` : ""}
                    </div>
                  ) : null}
                  {event.type === "ESCALATED" ? <div className="mt-2 text-xs text-white/70">Reason: {event.reason}</div> : null}
                  {event.type === "SUPPRESSED" ? <div className="mt-2 text-xs text-white/70">Reason: {event.reason}</div> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      {!events.length ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">No timeline events yet.</div> : null}
    </div>
  );
}

function CustomerDetailPage({ enrollmentId, onBack }: { enrollmentId: string; onBack: () => void }) {
  const { enrollment, events, loading, error, refresh } = useEnrollmentDetail(enrollmentId);
  const [suppressReason, setSuppressReason] = useState("opt_out");
  const [escalateReason, setEscalateReason] = useState("");
  const [saving, setSaving] = useState(false);

  const runAction = async (action: "suppress" | "escalate") => {
    if (!enrollment) return;
    setSaving(true);
    try {
      if (action === "suppress") await sequenceApi.suppressEnrollment(enrollment.id, { reason: suppressReason });
      else await sequenceApi.escalateEnrollment(enrollment.id, { reason: escalateReason || "manual_escalation" });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className={cx("rounded-2xl border p-4", TOKENS.border, TOKENS.panel)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button onClick={onBack} className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70" type="button"><ArrowLeft size={16} /></button>
            <div>
              <div className="text-xl font-semibold">Enrollment {enrollmentId}</div>
              <div className="text-sm text-white/55">Rigid cadence: Day 0 SMS → Day 10 escalation. Paid exits stop all future touches.</div>
            </div>
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5" onClick={refresh}>Refresh</Button>
        </div>

        {loading ? <div className="mt-4 h-12 animate-pulse rounded bg-white/10" /> : null}
        {error ? <div className="mt-4 text-red-300">{error}</div> : null}

        {enrollment ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <StatusPill status={enrollment.status} currentDay={enrollment.currentDay} />
              <div className="text-white/70">Borrower: {enrollment.borrowerId}</div>
              <div className="text-white/70">Dealer: {enrollment.dealerId}</div>
              <div className="text-white/70">Next scheduled: {formatDate(enrollment.nextScheduledAt)}</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-sm font-medium">Suppress</div>
                <select value={suppressReason} onChange={(e) => setSuppressReason(e.target.value)} className="w-full rounded-md border border-white/10 bg-[#120D20] p-2 text-sm">
                  <option value="opt_out">opt_out</option>
                  <option value="wrong_number">wrong_number</option>
                  <option value="manual">manual</option>
                </select>
                <Button disabled={saving} className="mt-2 w-full" variant="outline" onClick={() => void runAction("suppress")}>Suppress enrollment</Button>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-sm font-medium">Escalate</div>
                <Input value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} placeholder="Reason" className="border-white/10 bg-[#120D20]" />
                <Button disabled={saving} className="mt-2 w-full" style={{ backgroundColor: TOKENS.red }} onClick={() => void runAction("escalate")}>Escalate enrollment</Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <TimelineList events={events} />
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<{ tab: SidebarKey; enrollmentId: string | null }>({ tab: "dashboard", enrollmentId: null });
  const active: SidebarKey = route.enrollmentId ? "customers" : route.tab;

  return (
    <Shell active={active} onNavigate={(k) => setRoute({ tab: k, enrollmentId: null })}>
      {route.enrollmentId ? (
        <CustomerDetailPage enrollmentId={route.enrollmentId} onBack={() => setRoute((r) => ({ ...r, enrollmentId: null }))} />
      ) : route.tab === "customers" ? (
        <CustomersPage onOpenCustomer={(id) => setRoute({ tab: "customers", enrollmentId: id })} />
      ) : (
        <DashboardPage onOpenCustomer={(id) => setRoute({ tab: "dashboard", enrollmentId: id })} />
      )}
    </Shell>
  );
}
