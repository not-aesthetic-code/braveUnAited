import Link from "next/link";
import { priceLabel, SERVICE_LABELS, type ServiceType } from "@/lib/appointments";

const SERVICES = Object.keys(SERVICE_LABELS) as ServiceType[];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold tracking-tight">Fundacja Niepodzielni</span>
        <span className="text-sm text-muted-foreground">Pomoc psychologiczna</span>
      </header>

      <main className="flex flex-1 flex-col items-center gap-10 px-6 py-16 text-center">
        <div className="flex max-w-xl flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Umów wizytę u psychoterapeuty
          </h1>
          <p className="text-muted-foreground">
            Znajdź wolny termin i zarezerwuj go od razu — bez zakładania konta,
            bez telefonu, bez czekania na odpowiedź.
          </p>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const label = SERVICE_LABELS[service];
            return (
              <Link
                key={service}
                href={`/book?service=${service}`}
                className="flex flex-col items-start gap-1 rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted"
              >
                <span className="font-medium">{label.title}</span>
                <span className="text-sm text-muted-foreground">{label.description}</span>
                <span className="mt-2 text-sm font-semibold">{priceLabel(service)}</span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
