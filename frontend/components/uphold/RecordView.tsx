"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Coins, Gavel, LockKeyhole, ShieldCheck, Trophy } from "lucide-react";
import { useAddressRecord } from "@/lib/uphold/hooks";
import { formatCount, formatStake } from "@/lib/uphold/format";
import { getUpholdContractAddress } from "@/lib/uphold/config";
import { AddressChip, Metric, PageHeader, SetupState } from "./ui";

export function RecordView({ address }: { address: string }) {
  const query = useAddressRecord(address);
  if (!getUpholdContractAddress()) return <><PageHeader eyebrow="Uphold Record" title="Objective protocol history." copy="A wallet record describes what the Uphold contract has objectively recorded. It is not a universal trust score." /><SetupState /><Link href="/app" className="back-link"><ArrowLeft size={15} /> Back to overview</Link></>;
  if (query.isLoading) return <div className="loading-panel"><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar loading-bar-short" /></div>;
  if (query.isError || !query.data) return <div className="notice notice-error">This wallet record could not be read from Studio Next.</div>;
  const record = query.data;
  return <><PageHeader eyebrow="Uphold Record" title="Objective protocol history." copy="A wallet record describes what the Uphold contract has objectively recorded. It is not a universal trust score." action={<AddressChip address={address} link={false} />} /><section className="record-identity"><div className="record-avatar">{address.slice(2, 4).toUpperCase()}</div><div><span className="eyebrow">Wallet</span><h2>{address}</h2><p>Public activity on GenLayer Studio Next</p></div></section><section className="metric-grid"><Metric label="GEN bonded" value={formatStake(record.total_gen_bonded)} detail="Cumulative deposits" /><Metric label="GEN returned" value={formatStake(record.gen_returned)} detail="Clean completions" /><Metric label="GEN received" value={formatStake(record.gen_received)} detail="Beneficiary settlements" /><Metric label="Created" value={formatCount(record.commitments_created)} detail="Commitments" /></section><section className="record-grid"><div className="content-panel"><div className="panel-heading"><div><p className="eyebrow">Recorded outcomes</p><h2>Commitment history</h2></div><ShieldCheck size={18} className="heading-icon" /></div><div className="record-list"><div><CheckCircle2 size={17} /><span>Completed intact</span><strong>{record.completed_intact}</strong></div><div><Gavel size={17} /><span>Breached</span><strong>{record.breached}</strong></div><div><Trophy size={17} /><span>Contests won</span><strong>{record.contests_won}</strong></div><div><LockKeyhole size={17} /><span>Contests lost</span><strong>{record.contests_lost}</strong></div></div></div><div className="content-panel"><div className="panel-heading"><div><p className="eyebrow">What this means</p><h2>Evidence over reputation</h2></div><Coins size={18} className="heading-icon" /></div><p className="panel-copy">These counts come from deterministic contract transitions and bonded value flows. Uphold does not aggregate them into a social score or make claims beyond this protocol.</p><Link href="/transparency" className="inline-link">Read the methodology <ArrowUpRight size={14} /></Link></div></section></>;
}
