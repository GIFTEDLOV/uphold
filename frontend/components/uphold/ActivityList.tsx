"use client";

import Link from "next/link";
import { ArrowUpRight, Archive, CircleAlert, FileText, LockKeyhole, Plus, RefreshCw } from "lucide-react";
import { useActivity } from "@/lib/uphold/hooks";
import { formatDate } from "@/lib/uphold/format";
import { getUpholdContractAddress } from "@/lib/uphold/config";
import { AddressChip, EmptyState, PageHeader, SetupState } from "./ui";

const eventLabels: Record<string, string> = { CREATED: "created a commitment", CHECK: "checked archived evidence", CHECK_FAILURE: "recorded an evidence failure", STAKE_INCREASED: "increased the bond", EXTENDED: "extended expiry", BREACH_CLAIMED: "claimed breach", CONTEST_FILED: "filed a contest", CONTEST_UPHELD: "won a contest", CONTEST_REJECTED: "lost a contest", BREACH_CONFIRMED: "confirmed breach", PAYOUT_REQUESTED: "requested beneficiary payout", REFUND_REQUESTED: "requested promisor refund", SETTLED: "confirmed beneficiary payout", COMPLETED: "confirmed intact completion" };
function EventIcon({ event }: { event: string }) { if (event === "CHECK" || event === "CREATED") return <Archive size={16} />; if (event.includes("BREACH")) return <CircleAlert size={16} />; if (event === "SETTLED" || event === "COMPLETED" || event.includes("REQUESTED")) return <LockKeyhole size={16} />; if (event.includes("CONTEST")) return <FileText size={16} />; return <RefreshCw size={16} />; }

export function ActivityList() {
  const { data, isLoading, isError } = useActivity();
  if (!getUpholdContractAddress()) return <><PageHeader eyebrow="Activity" title="A public audit trail." copy="Protocol activity is reconstructed from bounded commitment history reads. There is no private indexer behind this view." /><SetupState /></>;
  return <><PageHeader eyebrow="Activity" title="A public audit trail." copy="Protocol activity is reconstructed from bounded commitment history reads. There is no private indexer behind this view." action={<Link href="/app/create" className="button button-primary"><Plus size={16} /> New commitment</Link>} />{isLoading ? <div className="loading-panel"><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar loading-bar-short" /></div> : isError ? <div className="notice notice-error">Activity could not be read from the Uphold contract.</div> : !data?.length ? <EmptyState title="No activity yet" copy="The first commitment, evidence check, and terminal outcome will appear here." /> : <div className="activity-feed">{data.map((item, index) => <div className="activity-row" key={`${item.commitmentId}-${item.event}-${item.at}-${index}`}><div className="activity-icon"><EventIcon event={item.event} /></div><div className="activity-body"><p><strong>{eventLabels[item.event] ?? item.event.toLowerCase().replaceAll("_", " ")}</strong> <Link href={`/app/commitments/${encodeURIComponent(item.commitmentId)}`}>{item.title}</Link></p><span>{formatDate(item.at ?? "", true)} · {item.commitmentId}</span>{item.classification && <span className={`activity-class activity-${item.classification.toLowerCase()}`}>{item.classification}</span>}</div><Link href={`/app/commitments/${encodeURIComponent(item.commitmentId)}`} className="row-arrow" aria-label="Open commitment"><ArrowUpRight size={16} /></Link></div>)}</div>}</>;
}
