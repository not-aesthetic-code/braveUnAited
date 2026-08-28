import { getTherapistPanelData } from "@/lib/therapist-data";
import { CalendarScreen } from "./calendar-screen";

export const dynamic = "force-dynamic";

export default async function TherapistCalendarPage() {
  const data = await getTherapistPanelData();
  return <CalendarScreen data={data} />;
}
