import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PanelSidebar } from "@/components/panel/panel-sidebar";
import { getPractitioner } from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { logoutAction } from "../actions";

export default async function PanelDashboardLayout({ children }: { children: React.ReactNode }) {
  const { claims, practitionerId } = await getPractitionerSession();
  if (!claims || !practitionerId) redirect("/panel/login");

  const practitioner = await getPractitioner(practitionerId);
  const displayName = practitioner?.name ?? (claims.email as string);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <span className="text-lg font-bold tracking-tight">Fundacja Niepodzielni</span>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{claims.email as string}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">Wyloguj</Button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <PanelSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
