"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ReceiptText,
  Settings2,
  Users,
  X,
} from "lucide-react";
import "./panel.css";

type Props = {
  practitionerName: string;
  initials: string;
  children: React.ReactNode;
};

const LINKS = [
  { href: "/panel", label: "Kalendarz", icon: CalendarDays },
  { href: "/panel/dostepnosc", label: "Dostępność", icon: Clock3 },
];

export function PanelShell({ practitionerName, initials, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="therapist-app">
      <aside className={`therapist-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">N</span>
          <span>Niepodzielni</span>
          <button className="mobile-close" aria-label="Zamknij menu" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="profile-card">
          <span className="avatar">{initials}</span>
          <div>
            <strong>{practitionerName}</strong>
            <small>psychoterapeutka</small>
          </div>
        </div>
        <nav className="panel-nav" aria-label="Panel specjalisty">
          <button type="button" disabled>
            <LayoutDashboard size={18} />
            Pulpit
          </button>
          <button type="button" disabled>
            <Users size={18} />
            Wizyty
          </button>
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <button type="button" disabled>
            <FileText size={18} />
            Wydarzenia
          </button>
          <button type="button" disabled>
            <ReceiptText size={18} />
            Rozliczenia
          </button>
          <button type="button" disabled>
            <MessageSquare size={18} />
            Wiadomości
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button type="button" disabled>
            <Settings2 size={18} />
            Ustawienia
          </button>
          <p>Panel demonstracyjny</p>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" aria-label="Zamknij menu" onClick={() => setMenuOpen(false)} />}

      <main className="panel-main">
        <header className="panel-topbar">
          <button className="mobile-menu" aria-label="Otwórz menu" onClick={() => setMenuOpen(true)}>
            <Menu size={21} />
          </button>
          <span>Panel specjalisty</span>
          <div className="topbar-person">
            <span className="status-dot" />
            Dostępna
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
