import Link from "next/link";
import { Sparkles } from "lucide-react";

const nav = [
  { href: "/ai-video", label: "AI Generator", icon: Sparkles },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/ai-video"><span className="brand-mark">P</span><span className="brand-name">Plandome Video</span></Link>
        <nav className="sidebar-nav" aria-label="Application navigation">
          {nav.map(({ href, label, icon: Icon }, index) => (
            <Link className={`nav-item ${index === 0 ? "nav-item-active" : ""}`} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>
          ))}
        </nav>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
