"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Compass, FileText, HelpCircle, LayoutDashboard, Menu, Moon, Plus, ShieldCheck, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import { formatAddress } from "@/lib/genlayer/wallet";
import { NetworkPill, Button, LogoMark } from "./ui";
import { PendingTransactionBanner } from "./PendingTransactionBanner";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/explore", label: "Explore", icon: Compass },
  { href: "/app/create", label: "Create", icon: Plus },
  { href: "/app/activity", label: "Activity", icon: Activity },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wallet = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("uphold.theme") === "light";
    setLight(saved);
    document.documentElement.dataset.theme = saved ? "light" : "dark";
  }, []);

  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    localStorage.setItem("uphold.theme", next ? "light" : "dark");
  };

  const navContent = (
    <>
      <div className="sidebar-top"><LogoMark /><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
      <div className="sidebar-network"><NetworkPill /></div>
      <nav className="side-nav" aria-label="Application navigation">
        <p className="nav-label">Workspace</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`side-link ${active ? "side-link-active" : ""}`}><Icon size={17} /><span>{label}</span>{label === "Create" && <span className="side-link-plus">⌘K</span>}</Link>;
        })}
        <p className="nav-label nav-label-spaced">Read</p>
        <Link href={wallet.address ? `/app/profile/${wallet.address}` : "/app/profile/record"} onClick={() => setMobileOpen(false)} className={`side-link ${pathname.startsWith("/app/profile") ? "side-link-active" : ""}`}><FileText size={17} /><span>My Record</span></Link>
        <Link href="/transparency" onClick={() => setMobileOpen(false)} className={`side-link ${pathname === "/transparency" ? "side-link-active" : ""}`}><HelpCircle size={17} /><span>Transparency</span></Link>
      </nav>
      <div className="sidebar-bottom">
        <button className="theme-toggle" onClick={toggleTheme}>{light ? <Moon size={15} /> : <Sun size={15} />}<span>{light ? "Dark mode" : "Light mode"}</span></button>
        {wallet.isConnected ? <div className="account-box"><span className="account-avatar">{wallet.address?.slice(2, 4).toUpperCase()}</span><div><span className="account-name">Connected wallet</span><span className="account-address">{formatAddress(wallet.address, 15)}</span></div><button className="account-disconnect" onClick={wallet.disconnectWallet} aria-label="Disconnect wallet">×</button></div> : <Button variant="secondary" className="sidebar-connect" onClick={() => wallet.connectWallet()}>Connect wallet</Button>}
      </div>
    </>
  );

  return <div className="app-shell"><aside className={`app-sidebar ${mobileOpen ? "app-sidebar-open" : ""}`}>{navContent}</aside>{mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> }<div className="app-main"><header className="mobile-header"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={21} /></button><LogoMark /><div className="mobile-header-actions"><NetworkPill /></div></header><main className="app-content"><div className="content-width"><PendingTransactionBanner />{children}</div></main><footer className="app-footer"><span>Uphold · accountability with evidence</span><span>Studio Next · chain 61997</span></footer></div></div>;
}
