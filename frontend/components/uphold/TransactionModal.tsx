"use client";

import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatGen } from "@/lib/uphold/actions";
import { useUpholdTransaction, type TransactionRequest, type TransactionStage } from "@/lib/uphold/transactions";
import { Button } from "./ui";

const stages: Array<{ key: TransactionStage; label: string }> = [
  { key: "preparing", label: "Preparing" },
  { key: "fee_estimate", label: "Fee estimate" },
  { key: "awaiting_wallet", label: "Awaiting wallet" },
  { key: "broadcast", label: "Broadcast" },
  { key: "consensus", label: "Consensus" },
  { key: "finalizing", label: "Finalizing" },
  { key: "finalized", label: "Finalized" },
  { key: "execution_verified", label: "Execution verified" },
  { key: "state_confirmed", label: "State confirmed" },
];

function stageIndex(stage: TransactionStage): number { return stages.findIndex((entry) => entry.key === stage); }

export function TransactionModal({ open, onClose, title, description, request }: { open: boolean; onClose: () => void; title: string; description: string; request: TransactionRequest | null }) {
  const tx = useUpholdTransaction();
  const [preparedRequest, setPreparedRequest] = useState<TransactionRequest | null>(null);
  useEffect(() => {
    if (!open || !request) return;
    setPreparedRequest(request);
    tx.reset();
    void tx.prepare(request);
  // prepare is intentionally triggered only when the modal opens for a new request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);
  if (!open) return null;
  const state = tx.state;
  const currentIndex = stageIndex(state.stage);
  const canSign = state.stage === "fee_estimate" && Boolean(preparedRequest);
  const done = state.stage === "state_confirmed";
  const failed = state.stage === "error";

  return <div className="modal-backdrop" role="presentation"><div className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title"><div className="modal-head"><div><p className="eyebrow">Secure transaction flow</p><h2 id="transaction-title">{title}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div><p className="modal-copy">{description}</p>
    <div className="tx-stages">{stages.map((entry, index) => <div key={entry.key} className={`tx-stage ${index < currentIndex || done ? "tx-stage-complete" : ""} ${entry.key === state.stage ? "tx-stage-current" : ""}`}><span className="tx-stage-icon">{index < currentIndex || done ? <Check size={13} /> : entry.key === state.stage && !failed ? <LoaderCircle className="spin" size={14} /> : <span>{index + 1}</span>}</span><span>{entry.label}</span></div>)}</div>
    {state.quote && <div className="fee-box"><div><span className="metric-label">Estimated protocol fee deposit</span><strong>{formatGen(state.quote.feeValue)} GEN</strong></div><span className="fee-source">{state.quote.source === "developer" ? "Developer/measured profile" : "Network defaults"}</span><small>User value/stake is separate; final consumed fee and refund appear after finalization.</small></div>}
    {failed && <div className="notice notice-error"><AlertTriangle size={17} /><div><strong>{state.error?.domain.replaceAll("_", " ")}</strong><p>{state.error?.message}</p></div></div>}
    {state.status?.genlayerTxId && <p className="tx-id">Transaction <code>{state.status.genlayerTxId.slice(0, 12)}…</code> is persisted for recovery.</p>}
    <div className="modal-actions">{done ? <Button onClick={onClose}>Close</Button> : <><Button variant="quiet" onClick={onClose}>Cancel</Button><Button disabled={!canSign} onClick={() => preparedRequest && void tx.submit(preparedRequest)}>{state.stage === "awaiting_wallet" ? "Confirm in wallet…" : failed ? "Retry estimate" : "Review & sign"}</Button></>}</div>
  </div></div>;
}
