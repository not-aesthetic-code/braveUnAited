import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "./actions";

export default async function DoctorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel specjalisty</h1>
        <p className="text-sm text-muted-foreground">Zaloguj się, aby zobaczyć swoje wizyty.</p>
      </div>

      <form action={loginAction} className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Hasło</FieldLabel>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </Field>
        </FieldGroup>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit">Zaloguj się</Button>
      </form>
    </div>
  );
}
