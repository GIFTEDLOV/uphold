"use client";

import { Archive, CheckCircle2, CircleAlert, FileWarning, LockKeyhole } from "lucide-react";
import { formatArchiveTimestamp, formatDate } from "@/lib/uphold/format";
import type { HistoryEntry } from "@/lib/uphold/types";
import { ClassificationBadge } from "./ui";

function eventTitle(event: string): string {
  return ({ CREATED: "Baseline admitted", CHECK: "Evidence check", CHECK_FAILURE: "Check did not produce a judgment", BREACH_CLAIMED: "Breach claimed", CONTEST_FILED: "Contest filed", CONTEST_UPHELD: "Contest upheld", CONTEST_REJECTED: "Contest rejected", BREACH_CONFIRMED: "Breach confirmed", SETTLED: "Stake settled", COMPLETED: "Commitment completed", STAKE_INCREASED: "Stake increased", EXTENDED: "Expiry extended" } as Record<string, string>)[event] ?? event.replaceAll("_", " ");
}

function EventIcon({ entry }: { entry: HistoryEntry }) {
  if (entry.event === "CHECK_FAILURE") return <FileWarning size={16} />;
  if (entry.event === "SETTLED" || entry.event === "COMPLETED") return <LockKeyhole size={16} />;
  if (entry.event === "BREACH_CLAIMED" || entry.event === "BREACH_CONFIRMED") return <CircleAlert size={16} />;
  if (entry.event === "CHECK" || entry.event === "CREATED") return <Archive size={16} />;
  return <CheckCircle2 size={16} />;
}

export function EvidenceTimeline({ history }: { history: HistoryEntry[] }) {
  if (!history.length) return <div className="timeline-empty">No audit entries returned for this commitment.</div>;
  return <ol className="evidence-timeline">{history.toReversed().map((entry, index) => <li key={`${entry.event}-${entry.at}-${index}`} className="timeline-entry"><div className={`timeline-icon timeline-icon-${entry.event.toLowerCase()}`}><EventIcon entry={entry} /></div><div className="timeline-content"><div className="timeline-heading"><div><h3>{eventTitle(entry.event)}</h3><span>{formatDate(entry.at ?? "", true)}</span></div>{entry.classification && <ClassificationBadge classification={entry.classification} />}</div>{entry.archive_timestamp && <div className="evidence-meta"><span>Archived {formatArchiveTimestamp(entry.archive_timestamp)}</span>{entry.archive_digest && <code>{entry.archive_digest.slice(0, 16)}…</code>}</div>}{entry.excerpt && <blockquote>“{entry.excerpt}”</blockquote>}{entry.short_reason && <p>{entry.short_reason}</p>}{entry.reason && <p className="timeline-reason"><span>{entry.domain ?? "Infrastructure"}</span> {entry.reason}</p>}{entry.event === "CHECK" && <p className={`qualification ${entry.qualified === false ? "qualification-muted" : ""}`}>{entry.qualified === false ? "Not counted toward the breach streak" : entry.classification === "HOLDS" ? "Resets the consecutive-negative streak" : entry.classification === "INDETERMINATE" ? "No economic effect · indeterminate" : "Qualified evidence point · advances the streak"}</p>}</div></li>)}</ol>;
}
