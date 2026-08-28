import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LoginDialog() {
  return (
    <Button variant="outline" render={<Link href="/konto" />} nativeButton={false}>
      Moje konto
    </Button>
  );
}
