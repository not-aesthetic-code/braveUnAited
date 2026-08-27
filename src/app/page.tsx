import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        scaffold · nothing built yet
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        BRAVE UnAIted
      </h1>
      <p className="max-w-md text-muted-foreground">
        Base app for the 2026-08-28 hackathon. Next.js, Tailwind, shadcn/ui —
        wired up and deployed. Everything else starts at 9:00.
      </p>
      <a
        href="https://github.com/not-aesthetic-code/braveUnAited"
        className={buttonVariants()}
      >
        View the repo
      </a>
    </div>
  );
}
