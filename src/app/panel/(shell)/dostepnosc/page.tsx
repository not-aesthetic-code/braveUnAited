import {
  CANCEL_WINDOW_HOURS,
  HOLD_MINUTES,
  MIN_LEAD_HOURS,
} from "@/lib/appointments";
import { getTherapistPanelData } from "@/lib/therapist-data";
import { AvailabilityScreen } from "./availability-screen";

export const dynamic = "force-dynamic";

// Read-only foundation rules. They live on the server so the client bundle
// never has to import the booking module (and its Supabase client) just to
// print six numbers.
const RULES = [
  { label: "Przerwa między wizytami", value: "10 minut" },
  { label: "Najbliższy możliwy termin", value: `${MIN_LEAD_HOURS} h od teraz` },
  { label: "Kalendarz pacjenta otwarty na", value: "30 dni" },
  { label: "Wystawiasz terminy na", value: "7 dni do przodu" },
  { label: "Bezpłatne odwołanie", value: `do ${CANCEL_WINDOW_HOURS} h przed` },
  { label: "Blokada terminu na płatność", value: `${HOLD_MINUTES} minut` },
  { label: "Strefa czasowa", value: "Europe/Warsaw" },
];

export default async function AvailabilityPage() {
  const data = await getTherapistPanelData();
  return <AvailabilityScreen data={data} rules={RULES} />;
}
