import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

      <main className="flex flex-1 flex-col items-center gap-16 px-6 py-16">
        <section className="grid min-h-[calc(100vh-6rem)] w-full max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col items-start gap-4 text-left">
            <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
              Pomoc psychologiczna
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Zadbaj o swój spokój. Jesteśmy tutaj, żeby Ci pomóc.
            </h1>
            <p className="text-muted-foreground">
              Znajdź wolny termin i zarezerwuj go od razu — bez zakładania konta,
              wystarczy numer telefonu.
            </p>
            <a
              href="#uslugi"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Umów się
              <ArrowRight className="size-4" />
            </a>
          </div>

          <div className="relative mx-auto aspect-[3/5] w-full max-w-xs overflow-hidden rounded-4xl bg-accent">
            <Image
              src="/images/hero-psycholog.webp"
              alt="Specjalista fundacji gotowy do pomocy"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 320px, 80vw"
            />
          </div>
        </section>

        <div id="uslugi" className="grid w-full max-w-3xl grid-cols-1 gap-4 scroll-mt-24 sm:grid-cols-2">
          {services.map(({ service, priceLabel }) => (
            <Link
              key={service.id}
              href={`/book?service=${service.id}`}
              className="group flex min-h-44 flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-secondary-foreground">
                  {service.title}
                </span>
                <span className="text-sm text-muted-foreground">{service.description}</span>
              </div>
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-semibold text-secondary-foreground">{priceLabel}</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold tracking-[0.08em] text-primary uppercase">
                  Umów
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
