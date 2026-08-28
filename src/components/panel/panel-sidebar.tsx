"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  ClipboardList,
  Clock,
  FileText,
  LayoutGrid,
  MessageSquare,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string | null; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

// href: null = not built yet, rendered disabled. Only "Wizyty" (the existing
// appointment list, at /panel) and "Dostępność" are real screens today —
// see docs/dostepnosc/00-przeglad.md for the rest of this sidebar's scope.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "PRACA",
    items: [
      { label: "Pulpit", href: null, icon: LayoutGrid },
      { label: "Wizyty", href: "/panel", icon: ClipboardList },
      { label: "Grupy i warsztaty", href: null, icon: Users },
      { label: "Wiadomości", href: null, icon: MessageSquare },
    ],
  },
  {
    label: "KALENDARZ",
    items: [
      { label: "Moje kalendarze", href: null, icon: CalendarRange },
      { label: "Dostępność", href: "/panel/dostepnosc", icon: Clock },
    ],
  },
  {
    label: "PIENIĄDZE",
    items: [
      { label: "Rozliczenia", href: null, icon: Wallet },
      { label: "Dokumenty i wypłaty", href: null, icon: FileText },
    ],
  },
];

export function PanelSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-6 text-sm">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            if (item.href === null) {
              return (
                <span
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-muted-foreground/50"
                >
                  <Icon className="size-4" />
                  {item.label}
                </span>
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md border-l-2 border-transparent px-3 py-2 transition-colors hover:bg-secondary/50",
                  active && "border-primary bg-secondary font-medium text-secondary-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
