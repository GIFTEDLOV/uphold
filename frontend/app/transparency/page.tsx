import { TransparencyContent } from "@/components/uphold/TransparencyContent";
import { LogoMark } from "@/components/uphold/ui";

export default function TransparencyPage() { return <div className="standalone-page"><header className="standalone-header"><LogoMark /><nav><a href="/app">Open app</a><a href="/app/explore">Explore</a></nav></header><main className="standalone-content"><TransparencyContent /></main><footer className="landing-footer"><LogoMark /><span>Uphold · evidence-backed commitments</span><span>Studio Next · chain 61997</span></footer></div>; }
