"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// ponytail: UI-only mockup, no auth backend yet — submit is a no-op.
export function LoginDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Moje konto</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zaloguj się</DialogTitle>
          <DialogDescription>
            Podaj numer telefonu, na który umówiłeś się na wizytę.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel htmlFor="login-phone">Numer telefonu</FieldLabel>
            <Input id="login-phone" type="tel" placeholder="+48 600 000 000" required />
          </Field>
          <DialogFooter>
            <Button type="submit">Wyślij kod</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
