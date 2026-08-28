import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { googleLoginAction, sendMagicLinkAction } from "./actions";

export default async function PatientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Moje konto</h1>
        <p className="text-sm text-muted-foreground">
          Konto nie jest wymagane do umówienia wizyty — załóż je tylko, jeśli chcesz mieć
          wszystkie rezerwacje w jednym miejscu.
        </p>
      </div>

      {sent ? (
        <p className="text-sm text-muted-foreground">
          Wysłaliśmy link logowania na podany adres e-mail. Sprawdź skrzynkę.
        </p>
      ) : (
        <>
          <form action={sendMagicLinkAction} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </Field>
            </FieldGroup>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit">Wyślij link logowania</Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            lub
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={googleLoginAction}>
            <Button type="submit" variant="outline" className="w-full">
              Zaloguj się przez Google
            </Button>
          </form>
        </>
      )}

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Wróć na stronę główną
      </Link>
    </div>
  );
}
