"use client";

import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useCommitments } from "@/lib/uphold/hooks";
import { commitmentSearchText, daysUntil, formatCount, formatDate, formatStake, sourceDomain } from "@/lib/uphold/format";
import type { CommitmentStatus } from "@/lib/uphold/types";
import { AddressChip, ClassificationBadge, EmptyState, SetupState, StatusBadge } from "./ui";

const filters: Array<{ label: string; value: "ALL" | CommitmentStatus }> = [
  { label: "All", value: "ALL" }, { label: "Active", value: "ACTIVE" }, { label: "Breach claimed", value: "BREACH_CLAIMED" }, { label: "Contested", value: "CONTESTED" }, { label: "Confirmed", value: "BREACH_CONFIRMED" }, { label: "Payout pending", value: "PAYOUT_PENDING" }, { label: "Refund pending", value: "REFUND_PENDING" }, { label: "Completed", value: "COMPLETED" }, { label: "Settled", value: "SETTLED" },
];

export function CommitmentTable({ mineOnly = false, actor = null }: { mineOnly?: boolean; actor?: string | null }) {
  const { data, isLoading, isError } = useCommitments();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | CommitmentStatus>("ALL");
  const [sort, setSort] = useState("newest");
  const commitments = useMemo(() => {
    const filtered = (data ?? []).filter((item) => {
      if (mineOnly && actor && item.promisor.toLowerCase() !== actor.toLowerCase() && item.beneficiary.toLowerCase() !== actor.toLowerCase()) return false;
      if (filter !== "ALL" && item.status !== filter) return false;
      return commitmentSearchText(item).includes(query.toLowerCase().trim());
    });
    return filtered.toSorted((a, b) => {
      if (sort === "stake") return Number(b.current_stake - a.current_stake);
      if (sort === "ending") return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      if (sort === "checks") return b.checks_run - a.checks_run;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [actor, data, filter, mineOnly, query, sort]);

  if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || !data && !isLoading && !isError) return <SetupState />;
  if (isLoading) return <div className="loading-panel"><span className="loading-bar" /><span className="loading-bar loading-bar-short" /></div>;
  if (isError) return <div className="notice notice-error">The commitment index could not be read from Studio-dev. No local or cached data is being shown.</div>;

  return <div className="table-panel"><div className="table-toolbar"><div className="search-field"><Search size={16} /><input aria-label="Search commitments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, wallet, ID, domain" /></div><select aria-label="Sort commitments" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="stake">Largest stake</option><option value="ending">Ending soon</option><option value="checks">Most checked</option></select></div><div className="filter-row">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`filter-pill ${filter === item.value ? "filter-pill-active" : ""}`}>{item.label}</button>)}</div>
    {commitments.length === 0 ? <EmptyState title="No matching commitments" copy={data?.length ? "Try a different filter or search term." : "The protocol has no commitments yet. Create the first public bond when the Uphold contract is deployed."} action={!data?.length ? <Link className="button button-primary" href="/app/create">Create commitment <ArrowUpRight size={15} /></Link> : undefined} /> : <div className="table-scroll"><table className="commitment-table"><thead><tr><th>Commitment</th><th>Status</th><th>Bond</th><th>Parties</th><th>Expiry</th><th>Evidence</th><th /></tr></thead><tbody>{commitments.map((commitment) => { const transferPending = commitment.status === "PAYOUT_PENDING" || commitment.status === "REFUND_PENDING"; return <tr key={commitment.commitment_id}><td><Link href={`/app/commitments/${encodeURIComponent(commitment.commitment_id)}`} className="table-title">{commitment.title}<span>{commitment.commitment_id} · {sourceDomain(commitment.source_url)}</span></Link></td><td><StatusBadge status={commitment.status} /></td><td><strong className="table-money">{transferPending ? "Transfer pending" : formatStake(commitment.current_stake)}</strong><span className="table-muted">{transferPending ? `${formatStake(commitment.pending_transfer_amount)} requested to ${commitment.pending_transfer_kind === "PAYOUT" ? "beneficiary" : "promisor"}` : commitment.total_stake_added ? `+${formatStake(commitment.total_stake_added)}` : "Original bond"}</span></td><td><AddressChip address={commitment.promisor} /><span className="table-muted">→ <AddressChip address={commitment.beneficiary} /></span></td><td><span className="table-date">{formatDate(commitment.expires_at)}</span><span className="table-muted">{daysUntil(commitment.expires_at)}</span></td><td><span className="table-checks">{formatCount(commitment.checks_run)} checks</span><span className="table-muted">{commitment.last_qualified_archive_timestamp ? "Qualified point" : "Baseline only"}</span></td><td><Link href={`/app/commitments/${encodeURIComponent(commitment.commitment_id)}`} className="row-arrow" aria-label={`Open ${commitment.title}`}><ArrowUpRight size={16} /></Link></td></tr>; })}</tbody></table></div>}
  </div>;
}
