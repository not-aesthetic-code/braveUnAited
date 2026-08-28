import Link from "next/link";
import { LoginDialog } from "@/components/login-dialog";
import { listServicesWithPricing } from "@/lib/appointments";

// Pricing now comes from the DB (practitioner_services) instead of a static
// import, so this page can no longer be prerendered at build time without
// requiring Supabase credentials there too — force it to render per-request
// like every other page in this app already does.
export const dynamic = "force-dynamic";

export default async function Home() {
  const services = await listServicesWithPricing();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold tracking-tight">Fundacja Niepodzielni</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Pomoc psychologiczna</span>
          <LoginDialog />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center gap-10 px-6 py-16 text-center">
        <div className="flex max-w-xl flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Umów wizytę u psychoterapeuty
          </h1>
          <p className="text-muted-foreground">
            Znajdź wolny termin i zarezerwuj go od razu — bez zakładania konta,
            wystarczy numer telefonu.
          </p>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
          {services.map(({ service, priceLabel }) => (
            <Link
              key={service.id}
              href={`/book?service=${service.id}`}
              className="flex flex-col items-start gap-1 rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted"
            >
              <span className="font-medium">{service.title}</span>
              <span className="text-sm text-muted-foreground">{service.description}</span>
              <span className="mt-2 text-sm font-semibold">{priceLabel}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
