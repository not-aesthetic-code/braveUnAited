import { TherapistPanel } from "./therapist-panel";
import { getTherapistPanelData } from "@/lib/therapist-data";

export const dynamic = "force-dynamic";

export default async function TherapistPanelPage() {
  const data = await getTherapistPanelData();
  return <TherapistPanel data={data} />;
}
