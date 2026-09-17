"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleHelp, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import { buildUpholdWrite, formatGen, makeCommitmentId, parseGenToWei } from "@/lib/uphold/actions";
import { getUpholdContractAddress } from "@/lib/uphold/config";
import { readCommitment } from "@/lib/uphold/client";
import { useLimits } from "@/lib/uphold/hooks";
import { TransactionModal } from "./TransactionModal";
import { Button, PageHeader, SetupState } from "./ui";

type Draft = { title: string; category: string; sourceUrl: string; commitmentText: string; beneficiary: string; stake: string; expiresAt: string; contestWindow: string };
const initialDraft: Draft = { title: "", category: "", sourceUrl: "", commitmentText: "", beneficiary: "", stake: "", expiresAt: "", contestWindow: "86400" };

export function validateDraft(draft: Draft, step: number, max = { title: 120, category: 48, url: 512, text: 2000 }) {
  const errors: string[] = [];
  if (step === 1 || step === 4) {
    if (!draft.title.trim()) errors.push("Add a title for the promise.");
    if (draft.title.length > max.title) errors.push(`Title must be ${max.title} characters or fewer.`);
    if (!draft.category.trim()) errors.push("Add a category.");
    if (!/^https?:\/\/[^\s]+$/i.test(draft.sourceUrl)) errors.push("Use a valid public HTTP(S) source URL.");
    if (draft.sourceUrl.length > max.url) errors.push(`Source URL must be ${max.url} characters or fewer.`);
    if (!draft.commitmentText.trim()) errors.push("Write the exact published commitment.");
    if (draft.commitmentText.length > max.text) errors.push(`Commitment text must be ${max.text} characters or fewer.`);
  }
  if (step === 3 || step === 4) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(draft.beneficiary)) errors.push("Beneficiary must be a valid wallet address.");
    if (!parseGenToWei(draft.stake) || parseGenToWei(draft.stake) === 0n) errors.push("Stake must be greater than zero GEN.");
    if (!draft.expiresAt || Number.isNaN(new Date(draft.expiresAt).getTime()) || new Date(draft.expiresAt).getTime() <= Date.now()) errors.push("Expiry must be a future date.");
    const window = Number(draft.contestWindow);
    if (!Number.isInteger(window) || window < 3600 || window > 2_592_000) errors.push("Contest window must be between 1 hour and 30 days.");
  }
  return errors;
}

export function CreateFlow() {
  const wallet = useWallet();
  const { data: limits } = useLimits();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({ ...initialDraft, beneficiary: wallet.address ?? "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [commitmentId, setCommitmentId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    if (wallet.address && !draft.beneficiary) setDraft((current) => ({ ...current, beneficiary: wallet.address ?? "" }));
  }, [draft.beneficiary, wallet.address]);
  const max = useMemo(() => ({ title: limits?.max_title_length ?? 120, category: limits?.max_category_length ?? 48, url: limits?.max_url_length ?? 512, text: limits?.max_commitment_length ?? 2000 }), [limits]);
  const update = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const next = () => { const found = validateDraft(draft, step, max); setErrors(found); if (!found.length) setStep((current) => Math.min(4, current + 1)); };
  const previous = () => { setErrors([]); setStep((current) => Math.max(1, current - 1)); };
  const review = () => { const found = validateDraft(draft, 4, max); setErrors(found); if (!found.length) { const id = commitmentId || makeCommitmentId(); setCommitmentId(id); setModalOpen(true); } };
  const write = getUpholdContractAddress() && commitmentId ? buildUpholdWrite("create_commitment", [commitmentId, draft.title.trim(), draft.category.trim(), draft.sourceUrl.trim(), draft.commitmentText.trim(), draft.beneficiary, "", new Date(draft.expiresAt).toISOString(), Number(draft.contestWindow)]) : null;
  const request = write ? { tx: write, userValue: parseGenToWei(draft.stake) ?? 0n, commitmentId, stateExpectation: { currentStake: (parseGenToWei(draft.stake) ?? 0n).toString() }, stateCheck: async () => { try { const item = await readCommitment(commitmentId); return item.commitment_id === commitmentId && item.current_stake === (parseGenToWei(draft.stake) ?? 0n); } catch { return false; } } } : null;

  const input = (label: string, key: keyof Draft, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="field"><span>{label}</span><input {...props} value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>;
  return <><PageHeader eyebrow="Create commitment" title="Put money behind your word." copy="A published promise becomes enforceable only when its source, evidence baseline, and bond are explicit." />{!getUpholdContractAddress() && <SetupState compact />}<div className="create-layout"><div className="form-panel"><div className="stepper">{["Promise", "Evidence", "Bond", "Review"].map((label, index) => <div key={label} className={`step ${step === index + 1 ? "step-active" : ""} ${step > index + 1 ? "step-done" : ""}`}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>{label}</div>)}</div>{errors.length > 0 && <div className="notice notice-error"><CircleHelp size={17} /><div>{errors.map((error) => <p key={error}>{error}</p>)}</div></div>}
      {step === 1 && <div className="form-section"><div className="section-intro"><h2>Define the promise</h2><p>The exact wording is the baseline validators compare against a fresh authenticated live-source snapshot.</p></div>{input("Title", "title", { placeholder: "Monthly transparency report" })}{input("Category", "category", { placeholder: "Public accountability" })}<label className="field"><span>Published source URL</span><div className="input-with-icon"><ExternalLink size={15} /><input value={draft.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://example.com/commitment" type="url" /></div><small>Use the public page where this wording is published.</small></label><label className="field"><span>Exact commitment text</span><textarea value={draft.commitmentText} onChange={(event) => update("commitmentText", event.target.value)} placeholder="I will publish…" rows={5} /><small>{draft.commitmentText.length}/{max.text} characters</small></label></div>}
      {step === 2 && <div className="form-section"><div className="section-intro"><h2>Authenticate the live baseline</h2><p>At signing, GenLayer validators fetch the exact public source URL independently. The protocol stores the agreed response hash, byte length, bounded normalized text, and capture timestamp before semantic assessment.</p></div><div className="evidence-callout"><ShieldCheck size={18} /><div><strong>No archive timestamp is required</strong><p>CDX, Availability, and Wayback replay are optional research tools only. A source outage or validator disagreement fails closed without becoming negative evidence.</p></div></div></div>}
      {step === 3 && <div className="form-section"><div className="section-intro"><h2>Set the bond terms</h2><p>Your stake is locked until a deterministic terminal outcome: clean completion returns it to you; confirmed breach pays the beneficiary.</p></div>{input("Beneficiary wallet", "beneficiary", { placeholder: "0x…", spellCheck: false })}{input("GEN stake", "stake", { placeholder: "100.00", inputMode: "decimal" })}{input("Expiry", "expiresAt", { type: "datetime-local" })}<label className="field"><span>Contest window</span><select value={draft.contestWindow} onChange={(event) => update("contestWindow", event.target.value)}><option value="3600">1 hour</option><option value="86400">24 hours</option><option value="604800">7 days</option><option value="2592000">30 days</option></select></label><div className="bond-summary"><span><span>Promisor</span>{wallet.address ?? "Connect wallet"}</span><span><span>Stake</span>{draft.stake ? `${draft.stake} GEN` : "—"}</span></div></div>}
      {step === 4 && <div className="form-section"><div className="section-intro"><h2>Review before signing</h2><p>Review the exact call that will be sent to the Uphold contract. The wallet will confirm the bond value and Transaction Kit fee separately.</p></div><div className="review-grid"><div><span>Commitment ID</span><strong>{commitmentId || "Generated on review"}</strong></div><div><span>Promise</span><strong>{draft.title}</strong><p>{draft.commitmentText}</p></div><div><span>Source</span><strong>{draft.sourceUrl}</strong><p>Live baseline captured by validators at creation.</p></div><div><span>Beneficiary</span><strong>{draft.beneficiary}</strong></div><div><span>Bond</span><strong>{draft.stake} GEN</strong><p>Contest protection: {Number(draft.contestWindow) / 3600} hours</p></div><div><span>Expiry</span><strong>{draft.expiresAt ? new Date(draft.expiresAt).toLocaleString() : "—"}</strong></div></div><div className="review-note"><LockKeyhole size={17} /><span>Stake is not withdrawable before settlement or clean completion.</span></div></div>}
      <div className="form-actions">{step > 1 && <Button variant="quiet" onClick={previous}><ArrowLeft size={15} /> Back</Button>}<span />{step < 4 ? <Button onClick={next}>Continue <ArrowRight size={15} /></Button> : <Button disabled={!getUpholdContractAddress()} onClick={() => { if (!getUpholdContractAddress()) { setErrors(["The Uphold contract is not configured. Deployment is required before signing."]); return; } review(); }}><ShieldCheck size={15} /> Create commitment</Button>}</div></div><aside className="create-aside"><div className="side-note"><p className="eyebrow">Protocol guardrails</p><h3>Evidence first. Payment last.</h3><p>No semantic judgment can select a beneficiary, bypass a deadline, or move stake. Only authenticated evidence can reach the bounded validator question.</p><Link href="/transparency" className="inline-link">Read the trust model <ArrowRight size={14} /></Link></div><div className="side-note side-note-muted"><p className="eyebrow">Network</p><strong>GenLayer Studio Next</strong><span>Chain 61997</span><span>{getUpholdContractAddress() ? "Fee profile pending Uphold deployment." : "Contract writes remain disabled until deployment."}</span></div></aside></div><TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Uphold commitment" description={`Bond ${draft.stake} GEN behind “${draft.title}”. Review the fee quote and approve once in your wallet.`} request={request} /></>;
}
