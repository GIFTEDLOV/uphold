"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useUpholdTransaction } from "@/lib/uphold/transactions";
import { formatDate } from "@/lib/uphold/format";
import { Button } from "./ui";

export function PendingTransactionBanner() {
  const transaction = useUpholdTransaction();
  const pending = transaction.pending[0];
  if (!pending) return null;
  const reconciling = transaction.state.stage !== "idle" && transaction.state.stage !== "error" && transaction.state.stage !== "state_confirmed";
  return <div className="pending-banner"><div className="pending-icon">{reconciling ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}</div><div><strong>Pending transaction needs reconciliation</strong><p>{pending.method.replaceAll("_", " ")} · submitted {formatDate(pending.createdAt, true)}. Uphold will track this same identifier and confirm expected contract state before clearing it.</p></div><Button variant="secondary" disabled={reconciling} onClick={() => void transaction.reconcile(pending)}>{reconciling ? "Reconciling…" : "Reconcile"}</Button></div>;
}
