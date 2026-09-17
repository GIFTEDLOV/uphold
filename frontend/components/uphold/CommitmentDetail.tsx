"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarClock, Check, CircleAlert, ExternalLink, FileText, Gavel, LockKeyhole, Plus, RefreshCw, ShieldCheck, Timer, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/genlayer/wallet";
import { allowedActions, buildUpholdWrite, formatGen, parseGenToWei } from "@/lib/uphold/actions";
import { getUpholdContractAddress } from "@/lib/uphold/config";
import { readCommitment } from "@/lib/uphold/client";
import { formatArchiveTimestamp, formatDate, formatStake, lifecycleIndex, sourceDomain } from "@/lib/uphold/format";
import { useCommitment, useCommitmentHistory } from "@/lib/uphold/hooks";
import type { ActionKey, Commitment } from "@/lib/uphold/types";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { TransactionModal } from "./TransactionModal";
import type { TransactionRequest } from "@/lib/uphold/transactions";
import { AddressChip, Button, ClassificationBadge, EmptyState, PageHeader, SetupState, StatusBadge } from "./ui";

const lifecycle = ["Created", "Monitoring", "Breach claimed", "Payout pending", "Refund / settled"];

function actionLabel(action: ActionKey): string { return ({ check: "Check now", increase_stake: "Increase stake", extend: "Extend expiry", contest: "Contest breach", adjudicate: "Adjudicate contest", settle: "Request breach payout", expire: "Request refund" } as Record<ActionKey, string>)[action]; }

function ActionIcon({ action }: { action: ActionKey }) {
  const Icon = action === "check" ? RefreshCw : action === "increase_stake" ? Plus : action === "extend" ? CalendarClock : action === "contest" ? FileText : action === "adjudicate" ? Gavel : action === "expire" ? Check : LockKeyhole;
  return <Icon size={15} />;
}

export function CommitmentDetail({ commitmentId }: { commitmentId: string }) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const commitmentQuery = useCommitment(commitmentId);
  const historyQuery = useCommitmentHistory(commitmentId);
  const commitment = commitmentQuery.data;
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [expiryInput, setExpiryInput] = useState("");
  const [contestUrl, setContestUrl] = useState("");
  const [contestTimestamp, setContestTimestamp] = useState("");
  const [formError, setFormError] = useState("");
  const [txOpen, setTxOpen] = useState(false);
  const [txRequest, setTxRequest] = useState<TransactionRequest | null>(null);
  const now = new Date();
  const actions = commitment ? allowedActions({ commitment, actor: wallet.address, now }) : [];
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["uphold"] }); };
  const submitAction = (action: ActionKey) => {
    if (!commitment || !getUpholdContractAddress()) return;
    setFormError("");
    let request: typeof txRequest = null;
    try {
      if (action === "increase_stake") {
        const value = parseGenToWei(stakeInput);
        if (!value || value <= 0n) { setFormError("Enter an additional stake greater than zero GEN."); return; }
        request = { tx: buildUpholdWrite("increase_stake", [commitmentId]), commitmentId, userValue: value, stateExpectation: { currentStake: (commitment.current_stake + value).toString() }, stateCheck: async () => (await readCommitment(commitmentId)).current_stake === commitment.current_stake + value };
      } else if (action === "extend") {
        const parsed = new Date(expiryInput);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= new Date(commitment.expires_at).getTime()) { setFormError("New expiry must move forward from the current expiry."); return; }
        const iso = parsed.toISOString();
        request = { tx: buildUpholdWrite("extend_commitment", [commitmentId, iso]), commitmentId, stateExpectation: { expiresAt: iso }, stateCheck: async () => (await readCommitment(commitmentId)).expires_at === iso };
      } else if (action === "contest") {
        if (contestUrl.trim() !== commitment.source_url) { setFormError("Contest evidence must use the original source URL."); return; }
        const parsedTimestamp = new Date(contestTimestamp);
        if (Number.isNaN(parsedTimestamp.getTime())) { setFormError("Use the timestamp of an authenticated live snapshot already recorded for this commitment."); return; }
        request = { tx: buildUpholdWrite("contest_breach", [commitmentId, contestUrl.trim(), parsedTimestamp.toISOString()]), commitmentId, stateExpectation: { status: "CONTESTED" }, stateCheck: async () => (await readCommitment(commitmentId)).status === "CONTESTED" };
      } else {
        const method = action === "check" ? "check_commitment" : action === "adjudicate" ? "adjudicate_contest" : action === "settle" ? "settle_breach" : "expire_commitment";
        const expected = action === "settle" ? "PAYOUT_PENDING" : action === "expire" ? "REFUND_PENDING" : action === "adjudicate" ? undefined : commitment.status;
        request = { tx: buildUpholdWrite(method, [commitmentId]), commitmentId, stateExpectation: expected ? { status: expected } : action === "check" ? { minimumChecksRun: commitment.checks_run + 1 } : { statusNot: "CONTESTED" }, stateCheck: async () => { const next = await readCommitment(commitmentId); return expected ? next.status === expected : next.checks_run > commitment.checks_run || next.status !== commitment.status; } };
      }
    } catch (error) { setFormError(error instanceof Error ? error.message : "Could not prepare this action."); return; }
    setTxRequest(request);
    setTxOpen(true);
  };

  if (!getUpholdContractAddress()) return <><PageHeader eyebrow="Commitment detail" title="Evidence, not assumptions." copy="This local build has no deployed contract address, so no commitment data is fabricated." /><SetupState /><Link href="/app/explore" className="back-link"><ArrowLeft size={15} /> Back to explore</Link></>;
  if (commitmentQuery.isLoading) return <div className="loading-panel"><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar loading-bar-short" /></div>;
  if (commitmentQuery.isError || !commitment) return <div className="notice notice-error"><CircleAlert size={17} /><span>Commitment {commitmentId} could not be read from Studio Next.</span><Link href="/app/explore" className="inline-link">Back to explore</Link></div>;

  const currentStep = lifecycleIndex(commitment.status);
  return <><Link href="/app/explore" className="back-link"><ArrowLeft size={15} /> Explore commitments</Link><section className="detail-hero"><div className="detail-heading"><div><div className="eyebrow-row"><span className="eyebrow">{commitment.category || "Commitment"}</span><StatusBadge status={commitment.status} /></div><h1>{commitment.title}</h1><p className="detail-id">{commitment.commitment_id}</p></div><div className="detail-bond"><span>Current bond</span><strong>{formatStake(commitment.current_stake)}</strong><span>{commitment.total_stake_added ? `+${formatStake(commitment.total_stake_added)} added` : "Original stake"}</span></div></div><div className="detail-meta-grid"><div><span>Promisor</span><AddressChip address={commitment.promisor} /></div><div><span>Beneficiary</span><AddressChip address={commitment.beneficiary} /></div><div><span>Source</span><a className="inline-link" href={commitment.source_url} target="_blank" rel="noreferrer">{sourceDomain(commitment.source_url)} <ExternalLink size={13} /></a></div><div><span>Expiry</span><strong>{formatDate(commitment.expires_at)}</strong></div></div></section>
    <section className="action-bar"><div><p className="eyebrow">Available actions</p><p>Every action below is derived from the current contract state and wallet actor.</p></div><div className="action-buttons">{actions.length ? actions.map((action) => <Button key={action} variant={action === "settle" || action === "expire" ? "danger" : action === "check" ? "primary" : "secondary"} onClick={() => { setActiveAction(action); if (!["increase_stake", "extend", "contest"].includes(action)) submitAction(action); }}><ActionIcon action={action} />{actionLabel(action)}</Button>) : <span className="action-none">No action available for this wallet and state.</span>}</div></section>
    {activeAction && ["increase_stake", "extend", "contest"].includes(activeAction) && <div className="inline-action-panel"><button className="panel-dismiss" onClick={() => setActiveAction(null)} aria-label="Close action"><X size={16} /></button><p className="eyebrow">{activeAction === "contest" ? "Evidence-based contest" : activeAction === "increase_stake" ? "Add to bond" : "Extend the promise"}</p><h2>{actionLabel(activeAction)}</h2><p>{activeAction === "contest" ? "Select an authenticated live snapshot already recorded for the original source. Contest does not fetch arbitrary caller-supplied web content or retry a semantic judgment." : activeAction === "increase_stake" ? "Only the promisor can add stake. Deposits are additive and cannot be withdrawn before a terminal outcome." : "Only the promisor can move expiry forward. An extension can never shorten the current term."}</p>{activeAction === "increase_stake" && <label className="field"><span>Additional GEN</span><input value={stakeInput} onChange={(event) => setStakeInput(event.target.value)} placeholder="25.00" inputMode="decimal" /></label>}{activeAction === "extend" && <label className="field"><span>New expiry</span><input type="datetime-local" value={expiryInput} onChange={(event) => setExpiryInput(event.target.value)} /></label>}{activeAction === "contest" && <><label className="field"><span>Original source URL</span><input value={contestUrl} onChange={(event) => setContestUrl(event.target.value)} placeholder={commitment.source_url} /></label><label className="field"><span>Authenticated snapshot timestamp</span><input value={contestTimestamp} onChange={(event) => setContestTimestamp(event.target.value)} placeholder={commitment.baseline_archive_timestamp} /></label></>}{formError && <p className="field-error">{formError}</p>}<div className="form-actions"><span /><Button variant="quiet" onClick={() => setActiveAction(null)}>Cancel</Button><Button onClick={() => { submitAction(activeAction); setActiveAction(null); }}>Prepare transaction</Button></div></div>}
    <div className="detail-grid"><div className="detail-main"><section className="content-panel promise-panel"><div className="panel-heading"><div><p className="eyebrow">The word being upheld</p><h2>Published commitment</h2></div><ShieldCheck size={19} className="heading-icon" /></div><blockquote className="commitment-quote">{commitment.commitment_text}</blockquote><div className="baseline-card"><div className="baseline-icon"><ArchiveIcon /></div><div><span className="eyebrow">Authenticated baseline</span><strong>{formatArchiveTimestamp(commitment.baseline_archive_timestamp)}</strong><p>{commitment.baseline_excerpt}</p><code>{commitment.baseline_digest}</code></div><a className="inline-link" href={`https://web.archive.org/web/${commitment.baseline_archive_timestamp}id_/${commitment.source_url}`} target="_blank" rel="noreferrer">Open capture <ExternalLink size={13} /></a></div></section><section className="content-panel"><div className="panel-heading"><div><p className="eyebrow">Forensic audit</p><h2>Evidence timeline</h2></div><span className="panel-count">{historyQuery.data?.length ?? 0} entries</span></div><div className="streak-callout"><div><span className="eyebrow">Qualified negative streak</span><strong>{commitment.consecutive_negative_count}/2 points</strong></div><div className="streak-bars"><span className={commitment.consecutive_negative_count >= 1 ? "streak-on" : ""} /><span className={commitment.consecutive_negative_count >= 2 ? "streak-on" : ""} /></div><p>A single negative observation cannot transfer funds. HOLDS resets the streak; archive or model failures have no economic effect.</p></div>{historyQuery.isLoading ? <div className="loading-panel"><span className="loading-bar" /><span className="loading-bar" /></div> : <EvidenceTimeline history={historyQuery.data ?? []} />}</section></div><aside className="detail-side"><section className="content-panel"><div className="panel-heading"><div><p className="eyebrow">Lifecycle</p><h2>Commitment state</h2></div><Timer size={18} className="heading-icon" /></div><div className="lifecycle">{lifecycle.map((label, index) => <div key={label} className={`lifecycle-step ${index <= currentStep ? "lifecycle-step-active" : ""} ${index === currentStep ? "lifecycle-step-current" : ""}`}><span>{index < currentStep ? <Check size={13} /> : index + 1}</span><div><strong>{label}</strong>{index === 1 && <small>{commitment.checks_run} authenticated checks</small>}{index === 2 && <small>{commitment.contest_deadline ? `Contest until ${formatDate(commitment.contest_deadline, true)}` : "Two qualified negative points"}</small>}{index === 3 && commitment.status === "PAYOUT_PENDING" && <small>{formatStake(commitment.pending_transfer_amount)} requested to beneficiary</small>}{index === 4 && commitment.status === "REFUND_PENDING" && <small>{formatStake(commitment.pending_transfer_amount)} requested back to promisor</small>}</div></div>)}</div></section><section className="content-panel detail-stats"><div><span>Checks run</span><strong>{commitment.checks_run}</strong></div><div><span>Last checked</span><strong>{formatDate(commitment.last_checked_at, true)}</strong></div><div><span>Extensions</span><strong>{commitment.extensions_count}</strong></div><div><span>Stake additions</span><strong>{commitment.stake_additions_count}</strong></div></section><section className="content-panel side-explain"><FileText size={18} /><h3>Why the timeline matters</h3><p>Evidence admission, semantic classification, and payment are separate steps. A payout or refund request remains pending until the finalized external balance effect is verified outside the contract.</p><Link href="/transparency" className="inline-link">Read methodology <ArrowUpRight size={14} /></Link></section></aside></div><TransactionModal open={txOpen} onClose={() => { setTxOpen(false); refresh(); }} title={activeAction ? actionLabel(activeAction) : "Uphold transaction"} description="Transaction Kit will estimate fees, request one wallet approval, reconcile the same transaction, verify execution, and re-read the pending contract state. External EOA movement is finalized separately." request={txRequest} /></>;
}

function ArchiveIcon() { return <span className="archive-glyph">⌁</span>; }
