import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { getAppointmentsForPatientEmail } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "./actions";

export default async function PatientAccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  if (!email) redirect("/konto/login");

  const appointments = await getAppointmentsForPatientEmail(email);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Twoje wizyty</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">Wyloguj</Button>
        </form>
      </div>

      {appointments.length === 0 && (
        <p className="text-muted-foreground">Brak rezerwacji powiązanych z tym adresem e-mail.</p>
      )}

      <div className="flex flex-col gap-3">
        {appointments.map((appt) => (
          <Link
            key={appt.id}
            href={`/my-booking/${appt.id}`}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-secondary"
          >
            <p className="font-medium">{appt.service.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(appt.startsAt).toLocaleString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="mt-2">
              <StatusBadge status={appt.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
