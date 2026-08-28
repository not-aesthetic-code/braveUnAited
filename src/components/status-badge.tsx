import type { AppointmentStatus } from "@/lib/appointments";

// Kolory wg wzorca referencji gabinet-makieta (.badge--sukces/blad/uwaga):
// confirmed = sukces (accent = zielony), cancelled/no_show = negatywny wynik
// (destructive), completed = neutralny stan końcowy (muted), held = w toku
// (amber — referencja ma dedykowany token warning, my nie, stąd wprost z
// palety Tailwind zamiast nowej zmiennej w globals.css).
const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  held: {
    label: "Oczekuje na płatność",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  confirmed: {
    label: "Potwierdzona",
    className: "bg-accent text-accent-foreground",
  },
  cancelled: {
    label: "Odwołana",
    className: "bg-destructive/10 text-destructive",
  },
  completed: {
    label: "Odbyta",
    className: "bg-muted text-muted-foreground",
  },
  no_show: {
    label: "Nieobecność",
    className: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
