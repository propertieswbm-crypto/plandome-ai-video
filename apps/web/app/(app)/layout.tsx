import Link from "next/link";
import { Film, Sparkles } from "lucide-react";

const nav = [
  { href: "/ai-video", label: "AI Generator", icon: Sparkles },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand studio-brand" href="/ai-video"><span className="brand-mark"><Film size={16} /></span><span><span className="brand-name">Plandome</span><small>AI VIDEO STUDIO</small></span></Link>
        <nav className="sidebar-nav" aria-label="Application navigation">
          {nav.map(({ href, label, icon: Icon }, index) => (
            <Link className={`nav-item ${index === 0 ? "nav-item-active" : ""}`} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>
          ))}
        </nav>
        <div className="sidebar-health"><span /><div><strong>Render worker</strong><small>Online and ready</small></div></div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
