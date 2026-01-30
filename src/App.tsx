import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  FileText,
  Settings,
  Search,
  ArrowLeft,
  Phone,
  Clock,
  SlidersHorizontal,
  Bot,
  MessageSquare,
  XCircle,
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Carpay Collect – Homepage + Customers
// Goals:
// - ChatGPT-style left sidebar (collapsible, full height, no vertical space taken)
// - Ribbon at top: flush to top (no margin above), but space BELOW it
// - Hero cards: 1x4 on desktop, uniform height, numbers aligned on one line
// - Work queue: columns rebalanced so Days Late + Call never overlap
// - Customers page: customer first, status fits cleanly
// - Customer detail: compact HORIZONTAL timeline (minimal height)
// - Customer detail: FULL ACTIVITY LOG at bottom (matches timeline, richer fields)
// -----------------------------------------------------------------------------

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

function cx(...classes: Array<string | null | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

// -------------------------
// Types
// -------------------------

type SidebarKey = "dashboard" | "customers" | "escalations" | "reports" | "settings";

type SidebarItem = {
  key: SidebarKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  badge?: number;
};

type QueueRow = {
  id: string;
  status: "Escalation" | "Promise to pay" | "Managed";
  name: string;
  vehicleOrNote: string;
  amountDue: string;
  daysLate: string;
};

type Customer = {
  id: string;
  name: string;
  vehicle: string;
  daysLate: number;
  amountDue: string;
  status: QueueRow["status"];
};

type QueueMode = "all" | "escalations" | "promises";

// -------------------------
// Activity Log Types
// -------------------------

type ActivityActor = "AI" | "Human" | "System";

type ActivityKind = "Call" | "SMS" | "Promise" | "Failed" | "Escalated" | "Note";

type ActivityItem = {
  id: string;
  ts: string; // display timestamp
  kind: ActivityKind;
  actor: ActivityActor;
  channel?: "Phone" | "SMS" | "Email" | "Portal";
  title: string;
  details?: string;
  outcome?: "Completed" | "No Answer" | "Voicemail" | "Delivered" | "Bounced" | "Failed" | "Escalated" | "Scheduled";
  durationSec?: number;
  promiseDate?: string;
  promiseAmount?: string;
  ref?: string;
  nextAction?: string;
};

function fmtDuration(seconds?: number) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function activityMeta(a: ActivityItem) {
  switch (a.kind) {
    case "Escalated":
      return { color: TOKENS.red, bg: "rgba(239,68,68,0.12)", icon: AlertTriangle };
    case "Failed":
      return { color: TOKENS.red, bg: "rgba(239,68,68,0.12)", icon: XCircle };
    case "Promise":
      return { color: TOKENS.amber, bg: "rgba(251,191,36,0.14)", icon: CheckCircle2 };
    case "SMS":
      return { color: TOKENS.aiIndigo, bg: "rgba(101,84,192,0.16)", icon: MessageSquare };
    case "Call":
      return { color: TOKENS.carpayBlue, bg: "rgba(0,82,204,0.16)", icon: Phone };
    default:
      return { color: "rgba(255,255,255,0.75)", bg: "rgba(255,255,255,0.06)", icon: FileText };
  }
}

function actorPill(actor: ActivityActor) {
  if (actor === "AI") return { color: TOKENS.aiIndigo, bg: "rgba(101,84,192,0.16)", icon: Bot };
  if (actor === "Human") return { color: TOKENS.carpayBlue, bg: "rgba(0,82,204,0.16)", icon: Users };
  return { color: "rgba(255,255,255,0.7)", bg: "rgba(255,255,255,0.08)", icon: Settings };
}

// -------------------------
// Status helpers
// -------------------------

type StatusStyle = { dot: string; bg: string; text: string };

function getStatusStyle(status: string): StatusStyle {
  if (status === "Escalation") {
    return { dot: TOKENS.red, bg: "rgba(239,68,68,0.12)", text: "rgba(239,68,68,0.95)" };
  }
  if (status === "Promise to pay") {
    return { dot: TOKENS.amber, bg: "rgba(251,191,36,0.14)", text: "rgba(251,191,36,0.95)" };
  }
  return { dot: TOKENS.emerald, bg: "rgba(34,197,94,0.14)", text: "rgba(34,197,94,0.95)" };
}

function applyQueueMode(rows: QueueRow[], mode: QueueMode) {
  if (mode === "escalations") return rows.filter((r) => r.status === "Escalation");
  if (mode === "promises") return rows.filter((r) => r.status === "Promise to pay");
  return rows.slice();
}

function getFilterMeta(mode: QueueMode | null) {
  if (mode === "escalations") return { label: "Escalations", color: TOKENS.red, bg: "rgba(239,68,68,0.12)" };
  if (mode === "promises") return { label: "Promises Due Today", color: TOKENS.amber, bg: "rgba(251,191,36,0.14)" };
  return null;
}

// -------------------------
// Sidebar
// -------------------------

const SIDEBAR: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "customers", label: "Customers", icon: Users, badge: 14 },
  { key: "escalations", label: "Escalations", icon: AlertTriangle },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings },
];

function Sidebar({
  active,
  onNavigate,
  collapsed,
  onToggle,
}: {
  active: SidebarKey;
  onNavigate: (k: SidebarKey) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-3">
      <div className={cx("mb-3 flex items-center", collapsed ? "justify-center" : "justify-between")}>
        <button
          onClick={onToggle}
          type="button"
          className={cx(
            "group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl transition",
            "hover:ring-2 hover:ring-blue-500/60"
          )}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          style={{ background: "linear-gradient(135deg, rgba(0,82,204,1) 0%, rgba(101,84,192,1) 70%)" }}
        >
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            {collapsed ? (
              <ChevronRight size={30} strokeWidth={2.5} className="text-white/90" />
            ) : (
              <ChevronLeft size={30} strokeWidth={2.5} className="text-white/90" />
            )}
          </span>
        </button>

        {!collapsed ? (
          <div className="ml-3 leading-tight">
            <div className="text-sm font-semibold text-white/90">Carpay</div>
            <div className="text-xs text-white/45">Collect</div>
          </div>
        ) : null}
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
              className={cx(
                "group relative flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                isActive ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <div className={cx("flex items-center gap-2", collapsed ? "w-full justify-center" : "")}> 
                <Icon size={18} style={{ color: isActive ? TOKENS.carpayBlue : "rgba(255,255,255,0.65)" }} />
                {!collapsed ? <span className={cx(isActive ? "text-white" : "text-white/80")}>{it.label}</span> : null}
              </div>

              {collapsed ? (
                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#120D20] px-3 py-1.5 text-xs text-white/90 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {it.label}
                </div>
              ) : null}

              {!collapsed && typeof it.badge === "number" ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">{it.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-3">
        {!collapsed ? (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs text-white/60">Signed in</div>
            <div className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70">JG</div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">JG</div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------
// Shell
// -------------------------

function LayoutStyles() {
  return (
    <style>{`
      .cp-content-offset { padding-left: var(--cp-sidebar-w); }
    `}</style>
  );
}

function Shell({
  active,
  onNavigate,
  children,
}: {
  active: SidebarKey;
  onNavigate: (k: SidebarKey) => void;
  children: React.ReactNode;
}) {
  const expandedW = 268;
  const collapsedW = 76;
  const [collapsed, setCollapsed] = useState(true);

  const sidebarW = collapsed ? collapsedW : expandedW;

  const handleNavigate = (k: SidebarKey) => {
    onNavigate(k);
    setCollapsed(true);
  };

  return (
    <div
      className={cx("min-h-screen", TOKENS.bg, "text-white")}
      style={
        {
          "--cp-sidebar-w": `${sidebarW}px`,
          backgroundImage:
            "radial-gradient(1200px 600px at 60% 10%, rgba(101,84,192,0.22), transparent 60%), radial-gradient(900px 500px at 20% 30%, rgba(0,82,204,0.18), transparent 55%)",
        } as React.CSSProperties
      }
    >
      <LayoutStyles />

      <div
        className={cx("fixed left-0 top-0 z-40 h-screen border-r", TOKENS.border)}
        style={{
          width: sidebarW,
          background: "rgba(15,11,26,0.95)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Sidebar
          active={active}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </div>

      <div className="cp-content-offset w-full">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0711]/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/55">Carpay</span>
              <span className="text-white/30">/</span>
              <span className="font-medium text-white">Collect</span>
            </div>
            <div className="text-sm text-white/70">
              Dealer: <span className="font-medium text-white">ABC Motors</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-6">{children}</div>
      </div>
    </div>
  );
}

// -------------------------
// UI pieces
// -------------------------

function StatCard({
  title,
  value,
  subtitle,
  accent,
  selected,
  onClick,
}: {
  title: string;
  value: string;
  subtitle: string;
  accent: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="h-full w-full cursor-pointer text-left" type="button">
      <Card
        className={cx(
          "h-[200px] w-full grid grid-rows-[auto_1fr_auto]",
          "rounded-2xl border transition",
          TOKENS.border,
          TOKENS.panel,
          "hover:translate-y-[-1px] hover:bg-white/[0.06]",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.35)]"
        )}
        style={{
          borderColor: selected ? accent : undefined,
          boxShadow: selected
            ? `0 0 0 1px ${accent}, 0 18px 40px rgba(0,0,0,0.35)`
            : "0 0 0 1px rgba(255,255,255,0.06), 0 18px 40px rgba(0,0,0,0.35)",
        }}
      >
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold leading-tight text-white/90">{title}</CardTitle>
        </CardHeader>

        <CardContent className="flex items-center justify-between px-6">
          <div className="flex flex-col justify-center">
            <div className="text-3xl font-semibold leading-none text-white tabular-nums">{value}</div>
            <div className="mt-1 text-xs leading-snug text-white/55">{subtitle}</div>
          </div>
        </CardContent>

        <div className="px-6 pb-4">
          <div className="h-2 w-16 rounded-full" style={{ background: accent, opacity: 0.9 }} />
        </div>
      </Card>
    </button>
  );
}

function WorkQueueTable({
  rows,
  onOpenCustomer,
  filterMode,
  onClearFilter,
}: {
  rows: QueueRow[];
  onOpenCustomer: (id: string) => void;
  filterMode: Exclude<QueueMode, "all"> | null;
  onClearFilter: () => void;
}) {
  const meta = getFilterMeta(filterMode);

  return (
    <div className={cx("rounded-2xl border", TOKENS.border, TOKENS.panel)}>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Work Queue</div>
            <div className="text-xs text-white/55">Accounts requiring attention</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
              <Input
                placeholder="Search customers"
                className="w-[220px] rounded-xl border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
              />
            </div>
            <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
              <SlidersHorizontal size={16} className="mr-2 text-white/60" />
              Sort: Days Late
            </Button>
          </div>
        </div>

        {meta ? (
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 px-3 py-2"
            style={{ background: meta.bg }}
          >
            <div className="flex items-center gap-2 text-sm">
              <Filter size={16} style={{ color: meta.color }} />
              <span className="text-white/80">Filter:</span>
              <span className="font-semibold" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="text-xs text-white/55">(showing {rows.length} accounts)</span>
            </div>

            <Button
              onClick={onClearFilter}
              variant="outline"
              className="h-8 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              Clear filter
            </Button>
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <div className="grid grid-cols-12 gap-3 border-b border-white/10 pb-2 text-xs font-medium text-white/75">
          <div className="col-span-5 tracking-wide">Customer</div>
          <div className="col-span-2 tracking-wide">Status</div>
          <div className="col-span-2 text-right tracking-wide">Amount Due</div>
          <div className="col-span-1 text-right tracking-wide">Days Late</div>
          <div className="col-span-2 text-right tracking-wide">Action</div>
        </div>

        <div className="divide-y divide-white/10">
          {rows.map((r) => {
            const pill = getStatusStyle(r.status);
            return (
              <div key={r.id} className="grid grid-cols-12 items-center gap-2 py-3 text-sm">
                <div className="col-span-5">
                  <button onClick={() => onOpenCustomer(r.id)} className="cursor-pointer text-left hover:underline" type="button">
                    <div className="font-medium text-white/90">{r.name}</div>
                    <div className="text-xs text-white/50">{r.vehicleOrNote}</div>
                  </button>
                </div>

                <div className="col-span-2 flex items-center">
                  <span
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: pill.bg, color: pill.text }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} />
                    {r.status}
                  </span>
                </div>

                <div className="col-span-2 text-right tabular-nums text-white/85">{r.amountDue}</div>
                <div className="col-span-1 text-right tabular-nums text-white/70">{r.daysLate}</div>

                <div className="col-span-2 flex justify-end">
                  <Button className="rounded-xl cursor-pointer whitespace-nowrap" style={{ backgroundColor: TOKENS.carpayBlue, color: "white" }}>
                    <Phone size={16} className="mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-white/50">
          <div>
            1–{Math.min(rows.length, 5)} of {rows.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="rounded-xl text-white/70 hover:bg-white/5 cursor-pointer">
              <ChevronLeft size={16} className="mr-1" /> Prev
            </Button>
            <Button variant="ghost" className="rounded-xl text-white/70 hover:bg-white/5 cursor-pointer">
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// Activity Log UI
// -------------------------

function ActivityLog({ items }: { items: ActivityItem[] }) {
  const [openById, setOpenById] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className={cx("rounded-2xl border", TOKENS.border, TOKENS.panel)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <FileText size={18} className="text-white/80" /> Full Activity Log
        </CardTitle>
        <div className="text-xs text-white/55">All actions and outcomes for this account</div>
      </CardHeader>

      <CardContent>
        <div className="hidden grid-cols-12 gap-3 border-b border-white/10 pb-2 text-xs font-medium text-white/70 md:grid">
          <div className="col-span-2">Time</div>
          <div className="col-span-2">Event</div>
          <div className="col-span-2">Actor</div>
          <div className="col-span-2">Outcome</div>
          <div className="col-span-2">Ref</div>
          <div className="col-span-2 text-right">Next</div>
        </div>

        <div className="divide-y divide-white/10">
          {items.map((a) => {
            const meta = activityMeta(a);
            const Icon = meta.icon;
            const ap = actorPill(a.actor);
            const ActorIcon = ap.icon;
            const isOpen = !!openById[a.id];

            return (
              <div key={a.id} className="py-3">
                {/* Desktop */}
                <div className="hidden grid-cols-12 items-center gap-3 md:grid">
                  <div className="col-span-2">
                    <div className="text-sm text-white/85">{a.ts}</div>
                    <div className="text-[11px] text-white/45">{a.channel ?? "—"}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        <Icon size={14} style={{ color: meta.color }} />
                        {a.kind}
                      </span>

                      {a.details ? (
                        <button
                          type="button"
                          onClick={() => toggle(a.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10"
                          title={isOpen ? "Hide details" : "Show details"}
                        >
                          {isOpen ? "Hide" : "Details"}
                          <span
                            className={cx(
                              "inline-block h-3 w-3 transition-transform",
                              isOpen ? "rotate-90" : "rotate-0"
                            )}
                          >
                            <ChevronRight size={12} className="text-white/60" />
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: ap.bg, color: ap.color }}
                    >
                      <ActorIcon size={14} style={{ color: ap.color }} />
                      {a.actor}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-white/80">{a.outcome ?? "—"}</div>
                    <div className="text-[11px] text-white/45">
                      {a.durationSec != null
                        ? `Duration: ${fmtDuration(a.durationSec)}`
                        : a.promiseDate
                        ? `Promise: ${a.promiseDate}`
                        : "—"}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-white/75">{a.ref ?? "—"}</div>
                    <div className="text-[11px] text-white/45">{a.promiseAmount ? `Amt: ${a.promiseAmount}` : "—"}</div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-sm text-white/80">{a.nextAction ?? "—"}</div>
                  </div>
                </div>

                {/* Mobile */}
                <div className="space-y-2 md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/90">{a.title}</div>
                      <div className="text-xs text-white/50">
                        {a.ts} • {a.channel ?? "—"}
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <Icon size={14} style={{ color: meta.color }} />
                      {a.kind}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: ap.bg, color: ap.color }}
                    >
                      <ActorIcon size={14} style={{ color: ap.color }} />
                      {a.actor}
                    </span>
                    <span className="text-xs text-white/55">Outcome:</span>
                    <span className="text-xs text-white/80">{a.outcome ?? "—"}</span>
                    {a.durationSec != null ? <span className="text-xs text-white/45">• {fmtDuration(a.durationSec)}</span> : null}

                    {a.details ? (
                      <button
                        type="button"
                        onClick={() => toggle(a.id)}
                        className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70"
                      >
                        {isOpen ? "Hide" : "Details"}
                        <span
                          className={cx(
                            "inline-block h-3 w-3 transition-transform",
                            isOpen ? "rotate-90" : "rotate-0"
                          )}
                        >
                          <ChevronRight size={12} className="text-white/60" />
                        </span>
                      </button>
                    ) : null}
                  </div>

                  {a.details && isOpen ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">{a.details}</div>
                  ) : null}

                  {a.nextAction ? (
                    <div className="text-xs text-white/55">
                      Next: <span className="text-white/80">{a.nextAction}</span>
                    </div>
                  ) : null}
                </div>

                {/* Desktop details (collapsible) */}
                {a.details && isOpen ? (
                  <div className="mt-2 hidden rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 md:block">
                    <div className="text-xs font-medium text-white/85">{a.title}</div>
                    <div className="mt-1 text-xs text-white/65">{a.details}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------
// Pages
// -------------------------

function DashboardPage({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [mode, setMode] = useState<QueueMode>("all");

  const rowsAll = useMemo<QueueRow[]>(
    () => [
      { id: "c1", status: "Escalation", name: "John Smith", vehicleOrNote: "2019 Honda Civic", amountDue: "$750.00", daysLate: "22" },
      {
        id: "c2",
        status: "Escalation",
        name: "Lisa Martinez",
        vehicleOrNote: "Broken promise • Voicemail",
        amountDue: "$1,200.50",
        daysLate: "15",
      },
      { id: "c3", status: "Promise to pay", name: "Michael Brown", vehicleOrNote: "Promises tomorrow • 2pm", amountDue: "$350.00", daysLate: "5" },
      { id: "c4", status: "Promise to pay", name: "Emily Chen", vehicleOrNote: "Promises tomorrow • 5pm", amountDue: "$415.25", daysLate: "1" },
      { id: "c5", status: "Managed", name: "David Johnson", vehicleOrNote: "2021 Chevy Malibu", amountDue: "$0.00", daysLate: "0" },
    ],
    []
  );

  const rows = useMemo(() => applyQueueMode(rowsAll, mode), [rowsAll, mode]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 auto-rows-fr">
        <StatCard
          title="Open Escalations"
          value="14"
          subtitle="Need human action"
          accent={TOKENS.red}
          selected={mode === "escalations"}
          onClick={() => setMode((m) => (m === "escalations" ? "all" : "escalations"))}
        />
        <StatCard
          title="Promises Due Today"
          value="5"
          subtitle="Payments expected"
          accent={TOKENS.amber}
          selected={mode === "promises"}
          onClick={() => setMode((m) => (m === "promises" ? "all" : "promises"))}
        />
        <StatCard
          title="Outstanding Balance"
          value="$82,960"
          subtitle="Currently past due"
          accent={TOKENS.carpayBlue}
          selected={false}
          onClick={() => setMode("all")}
        />
        <StatCard
          title="Managed by AI"
          value="96"
          subtitle="No action needed"
          accent={TOKENS.emerald}
          selected={false}
          onClick={() => setMode("all")}
        />
      </div>

      {mode !== "all" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge className="rounded-full bg-white/10 text-white/70 hover:bg-white/10">FILTER ON</Badge>
            <span className="text-sm text-white/70">Work Queue is filtered</span>
          </div>
          <Button
            onClick={() => setMode("all")}
            variant="outline"
            className="h-8 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer"
          >
            Clear filter
          </Button>
        </div>
      ) : null}

      <WorkQueueTable
        rows={rows}
        onOpenCustomer={onOpenCustomer}
        filterMode={mode === "all" ? null : (mode as any)}
        onClearFilter={() => setMode("all")}
      />
    </div>
  );
}

function CustomersPage({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [q, setQ] = useState("");

  const list = useMemo<Customer[]>(
    () => [
      { id: "c1", name: "John Smith", vehicle: "2019 Honda Civic", daysLate: 22, amountDue: "$750.00", status: "Escalation" },
      { id: "c2", name: "Lisa Martinez", vehicle: "2020 Toyota Camry", daysLate: 15, amountDue: "$1,200.50", status: "Escalation" },
      { id: "c3", name: "Michael Brown", vehicle: "2018 Ford Focus", daysLate: 5, amountDue: "$350.00", status: "Promise to pay" },
      { id: "c4", name: "Emily Chen", vehicle: "2021 Honda Accord", daysLate: 1, amountDue: "$415.25", status: "Promise to pay" },
      { id: "c5", name: "David Johnson", vehicle: "2021 Chevy Malibu", daysLate: 0, amountDue: "$0.00", status: "Managed" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((c) => c.name.toLowerCase().includes(term) || c.vehicle.toLowerCase().includes(term));
  }, [list, q]);

  return (
    <div className="space-y-4">
      <div className={cx("rounded-2xl border p-4", TOKENS.border, TOKENS.panel)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold">Customers</div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customers..."
              className="h-9 w-72 rounded-xl border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 border-b border-white/10 pb-2 text-xs font-medium text-white/75">
          <div className="col-span-6">Customer</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1 text-right">Late</div>
        </div>

        <div className="divide-y divide-white/10">
          {filtered.map((c) => {
            const pill = getStatusStyle(c.status);
            return (
              <div key={c.id} className="grid grid-cols-12 items-center gap-3 py-3 text-sm">
                <div className="col-span-6">
                  <button onClick={() => onOpenCustomer(c.id)} className="cursor-pointer text-left hover:underline" type="button">
                    <div className="font-medium text-white/90">{c.name}</div>
                    <div className="text-xs text-white/50">{c.vehicle}</div>
                  </button>
                </div>

                <div className="col-span-3">
                  <span
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: pill.bg, color: pill.text }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.dot }} />
                    {c.status}
                  </span>
                </div>

                <div className="col-span-2 text-right tabular-nums text-white/85">{c.amountDue}</div>
                <div className="col-span-1 text-right tabular-nums text-white/70">{c.daysLate}d</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({
  index,
  icon: Icon,
  label,
  date,
  color,
}: {
  index: number;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  date: string;
  color: string;
}) {
  return (
    <div className="relative flex w-[110px] flex-col items-center">
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#120D20]">
        <span
          className="absolute -left-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ background: color }}
        >
          {index}
        </span>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="mt-2 text-center leading-tight">
        <div className="text-xs font-medium text-white/85">{label}</div>
        <div className="text-[10px] text-white/45">{date}</div>
      </div>
    </div>
  );
}

function CustomerDetailPage({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const pill = getStatusStyle(customer.status);

  const activity = useMemo<ActivityItem[]>(
    () => [
      {
        id: "a1",
        ts: "May 14 · 10:02",
        kind: "Call",
        actor: "AI",
        channel: "Phone",
        title: "AI outbound call attempted",
        outcome: "No Answer",
        durationSec: 28,
        ref: "CALL-82F1",
        details:
          "Dialed primary number. Ring-no-answer. No voicemail detected (call ended per policy). Identity verification not completed.",
        nextAction: "Send SMS reminder",
      },
      {
        id: "a2",
        ts: "May 14 · 10:04",
        kind: "SMS",
        actor: "AI",
        channel: "SMS",
        title: "Payment reminder SMS sent",
        outcome: "Delivered",
        ref: "SMS-19C4",
        details: "Short reminder sent with callback option. No payment link included (borrower did not request).",
        nextAction: "Wait for response",
      },
      {
        id: "a3",
        ts: "May 17 · 14:11",
        kind: "Promise",
        actor: "AI",
        channel: "Phone",
        title: "Promise to pay captured",
        outcome: "Scheduled",
        promiseDate: "May 17",
        promiseAmount: customer.amountDue,
        ref: "CALL-93AA",
        details: `Borrower confirmed intent to pay ${customer.amountDue} by end of day. Preferred channel: Phone + SMS.`,
        nextAction: "Monitor payment posting",
      },
      {
        id: "a4",
        ts: "May 17 · 21:12",
        kind: "Failed",
        actor: "System",
        title: "Payment did not post by cutoff",
        outcome: "Failed",
        ref: "SYS-POSTING",
        details:
          "No successful payment recorded by end-of-day posting window. Promise marked as broken and moved to escalation policy.",
        nextAction: "Create escalation task",
      },
      {
        id: "a5",
        ts: "Today · 09:03",
        kind: "Escalated",
        actor: "System",
        title: "Escalation created",
        outcome: "Escalated",
        ref: "TASK-4102",
        details:
          "Account routed to human queue due to broken promise + no recent successful contact. Recommend manual call and identity verification before discussing details.",
        nextAction: "Human call now",
      },
      {
        id: "a6",
        ts: "Today · 09:10",
        kind: "Note",
        actor: "Human",
        title: "Agent note added",
        outcome: "Completed",
        ref: "NOTE-21",
        details:
          "Customer previously responsive by SMS; try SMS first, then call. If voicemail detected, hang up immediately.",
        nextAction: "Send SMS + call",
      },
    ],
    [customer.amountDue]
  );

  return (
    <div className="space-y-4">
      <div className={cx("rounded-2xl border p-4", TOKENS.border, TOKENS.panel)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={onBack}
              className="mt-0.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              type="button"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="min-w-0">
              <div className="truncate text-xl font-semibold leading-tight text-white">{customer.name}</div>
              <div className="truncate text-sm text-white/55">{customer.vehicle}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button className="rounded-xl cursor-pointer" style={{ backgroundColor: TOKENS.carpayBlue, color: "white" }}>
              <Phone size={16} className="mr-2" /> Call Now
            </Button>
            <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
              <Clock size={16} className="mr-2 text-white/70" /> Snooze
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
            style={{ color: pill.text }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: pill.dot }} /> {customer.status}
          </span>
          <div className="text-white/55">
            Days Late: <span className="tabular-nums text-white/80">{customer.daysLate}</span>
          </div>
          <div className="text-white/55">
            Amount Due: <span className="tabular-nums text-white/80">{customer.amountDue}</span>
          </div>
        </div>

        <div className="mt-3 overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <div className="relative min-w-max px-1 pb-1 pt-3">
              <div className="absolute left-2 right-2 top-3 h-px bg-white/30" />

              <div className="flex items-start gap-5">
                <TimelineEvent index={1} icon={Phone} label="Call" date="May 14" color={TOKENS.carpayBlue} />
                <TimelineEvent index={2} icon={MessageSquare} label="SMS" date="May 14" color={TOKENS.aiIndigo} />
                <TimelineEvent index={3} icon={CheckCircle2} label="Promise" date="May 17" color={TOKENS.amber} />
                <TimelineEvent index={4} icon={XCircle} label="Failed" date="May 17 · 9:12" color={TOKENS.red} />
                <TimelineEvent index={5} icon={AlertTriangle} label="Escalated" date="Now" color={TOKENS.red} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className={cx("rounded-2xl border lg:col-span-2", TOKENS.border, TOKENS.panel)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Bot size={18} style={{ color: TOKENS.aiIndigo }} /> AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              {customer.name} promised to pay {customer.amountDue} by May 17. An AI call + SMS were sent; payment did not post. Today’s follow-up call
              went unanswered, so this account escalated.
            </div>
          </CardContent>
        </Card>

        <Card className={cx("rounded-2xl border", TOKENS.border, TOKENS.panel)}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Settings size={18} style={{ color: TOKENS.aiIndigo }} /> Key Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-white/55">Loan ID</div>
              <div className="text-white/80">LN-10492</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-white/55">Preferred channel</div>
              <div className="text-white/80">Phone + SMS</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/55">
              Compliance reminder: verify identity before discussing loan details.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Activity Log (matches timeline + richer info) */}
      <ActivityLog items={activity} />
    </div>
  );
}

// -------------------------
// App
// -------------------------

function runSelfTests() {
  try {
    console.assert(cx("a", null, "b") === "a b", "cx join");
    console.assert(typeof ChevronLeft === "function", "ChevronLeft import");
    console.assert(typeof ChevronRight === "function", "ChevronRight import");
    console.assert(SIDEBAR.length >= 5, "sidebar items");

    const s = getStatusStyle("Escalation");
    console.assert(!!s && typeof s.dot === "string" && typeof s.bg === "string" && typeof s.text === "string", "status style shape");

    const escalations = applyQueueMode(
      [{ id: "x", status: "Escalation", name: "A", vehicleOrNote: "", amountDue: "$0", daysLate: "1" }],
      "escalations"
    );
    console.assert(escalations.length === 1, "applyQueueMode filters");
  } catch (e) {
    console.error("Self-tests failed:", e);
  }
}

export default function App() {
  const [route, setRoute] = useState<{ tab: SidebarKey; customerId: string | null }>({ tab: "dashboard", customerId: null });

  useEffect(() => {
    runSelfTests();
  }, []);

  const customer = useMemo<Customer>(
    () => ({ id: "c1", name: "John Smith", vehicle: "2019 Honda Civic", daysLate: 22, amountDue: "$750.00", status: "Escalation" }),
    []
  );

  const active: SidebarKey = route.customerId ? "customers" : route.tab;

  return (
    <Shell active={active} onNavigate={(k) => setRoute({ tab: k, customerId: null })}>
      {route.customerId ? (
        <CustomerDetailPage customer={customer} onBack={() => setRoute((r) => ({ ...r, customerId: null }))} />
      ) : route.tab === "customers" ? (
        <CustomersPage onOpenCustomer={(id) => setRoute({ tab: "customers", customerId: id })} />
      ) : (
        <DashboardPage onOpenCustomer={(id) => setRoute({ tab: "dashboard", customerId: id })} />
      )}
    </Shell>
  );
}
