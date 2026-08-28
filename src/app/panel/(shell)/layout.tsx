import { getPractitioner } from "@/lib/appointments";
import { DEMO_PRACTITIONER_ID } from "@/lib/therapist-data";
import { PanelShell } from "../panel-shell";

export const dynamic = "force-dynamic";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const practitioner = await getPractitioner(DEMO_PRACTITIONER_ID);
  const name = practitioner?.name ?? "Panel specjalisty";
  return (
    <PanelShell practitionerName={name} initials={initialsOf(name)}>
      {children}
    </PanelShell>
  );
}
