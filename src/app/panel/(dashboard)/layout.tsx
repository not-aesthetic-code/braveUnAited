import Image from "next/image";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  FileText,
  LayoutGrid,
  MessageSquare,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPractitionerSession } from "@/lib/panel-auth";
import { logoutAction } from "../actions";

// Nav items beyond Pulpit/Dostępność don't have pages yet — shown for context, not linked.
const NAV_GROUPS: { label: string; items: { icon: typeof LayoutGrid; label: string; href?: string }[] }[] = [
  {
    label: "Praca",
    items: [
      { icon: LayoutGrid, label: "Pulpit", href: "/panel" },
      { icon: CalendarCheck, label: "Wizyty" },
      { icon: Users, label: "Grupy i warsztaty" },
      { icon: MessageSquare, label: "Wiadomości" },
    ],
  },
  {
    label: "Kalendarz",
    items: [
      { icon: CalendarDays, label: "Moje kalendarze", href: "/panel/kalendarze" },
      { icon: Clock, label: "Dostępność", href: "/panel/dostepnosc" },
    ],
  },
  {
    label: "Pieniądze",
    items: [
      { icon: Wallet, label: "Rozliczenia" },
      { icon: FileText, label: "Dokumenty i wypłaty" },
    ],
  },
];

export default async function PanelDashboardLayout({ children }: { children: React.ReactNode }) {
  const { claims, practitionerId } = await getPractitionerSession();
  if (!claims || !practitionerId) redirect("/panel/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-card px-4 py-6 lg:flex">
        <Image src="/logo.svg" alt="Fundacja Niepodzielni" width={140} height={45} className="px-2" priority />
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</span>
            {group.items.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent/40"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  title="Wkrótce dostępne"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground/60"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              )
            )}
          </div>
        ))}
        <form action={logoutAction} className="mt-auto">
          <Button type="submit" variant="outline" className="w-full">Wyloguj</Button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
