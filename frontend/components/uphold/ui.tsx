"use client";

import Link from "next/link";
import { ArrowUpRight, CircleAlert, ExternalLink, ShieldCheck } from "lucide-react";
import { getNetworkMismatchMessage, isStudioDevNetwork, UPHOLD_NETWORK } from "@/lib/uphold/config";
import { switchToGenLayerNetwork } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/wallet";
import type { CommitmentStatus, SemanticClassification } from "@/lib/uphold/types";

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-lockup" aria-label="Uphold home">
      <span className="brand-mark"><ShieldCheck size={18} strokeWidth={2.2} /></span>
      {!compact && <span className="brand-name">Uphold</span>}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger" }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function StatusBadge({ status }: { status: CommitmentStatus }) {
  const label = status === "BREACH_CLAIMED" ? "Breach claimed" : status === "BREACH_CONFIRMED" ? "Breach confirmed" : status === "PAYOUT_PENDING" ? "Payout pending" : status === "REFUND_PENDING" ? "Refund pending" : status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`status-badge status-${status.toLowerCase()}`}><span className="status-dot" />{label}</span>;
}

export function ClassificationBadge({ classification }: { classification: SemanticClassification }) {
  return <span className={`classification classification-${classification.toLowerCase()}`}>{classification}</span>;
}

export function AddressChip({ address, link = true }: { address: string; link?: boolean }) {
  const label = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
  return link && address ? <Link href={`/app/profile/${address}`} className="address-chip">{label}</Link> : <span className="address-chip">{label}</span>;
}

export function SetupState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`setup-state ${compact ? "setup-state-compact" : ""}`}>
      <div className="setup-icon"><CircleAlert size={18} /></div>
      <div>
        <p className="setup-title">Uphold contract not configured</p>
        <p className="setup-copy">This local build is ready for Studio-dev, but no deployed contract address has been supplied yet. Chain data and writes stay disabled until the V1.2 deployment.</p>
      </div>
      <Link href="/transparency#deployment" className="inline-link">Setup notes <ArrowUpRight size={14} /></Link>
    </div>
  );
}

export function NetworkPill() {
  const wallet = useWallet();
  const isReady = wallet.isConnected && wallet.isOnCorrectNetwork && isStudioDevNetwork();
  const handleSwitch = async () => {
    try { await switchToGenLayerNetwork(); } catch { /* WalletProvider surfaces the actionable error. */ }
  };
  return (
    <div className={`network-pill ${isReady ? "network-ready" : ""}`}>
      <span className="network-indicator" />
      <span>{UPHOLD_NETWORK.name}</span>
      <span className="network-chain">{UPHOLD_NETWORK.chainId}</span>
      {wallet.isConnected && !wallet.isOnCorrectNetwork && <button onClick={handleSwitch} className="network-switch">Switch</button>}
    </div>
  );
}

export function WrongNetworkNotice() {
  const wallet = useWallet();
  if (!wallet.isConnected || wallet.isOnCorrectNetwork) return null;
  return <div className="notice notice-warning"><CircleAlert size={17} /><span>{getNetworkMismatchMessage(wallet.chainId)}</span><Button variant="quiet" onClick={async () => { try { await switchToGenLayerNetwork(); } catch { /* handled by wallet layer */ } }}>Switch network</Button></div>;
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-line" /><h3>{title}</h3><p>{copy}</p>{action}</div>;
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="metric"><span className="metric-label">{label}</span><strong>{value}</strong>{detail && <span className="metric-detail">{detail}</span>}</div>;
}

export function PageHeader({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{copy && <p className="page-copy">{copy}</p>}</div>{action}</div>;
}

export function ExternalLinkLabel({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="inline-link" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={13} /></a>;
}
