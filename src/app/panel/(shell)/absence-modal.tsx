"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createAbsenceAction } from "../actions";
import type { AvailabilityExceptionInput } from "@/lib/therapist-calendar";
import { localDate } from "../format";

export function AbsenceModal({ onClose }: { onClose: () => void }) {
  const today = localDate(new Date().toISOString());
  const [form, setForm] = useState<AvailabilityExceptionInput>({
    date: today,
    startTime: "09:00",
    endTime: "17:00",
    reason: "",
  });
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; conflicts?: string[] } | null>(null);

  function save() {
    startTransition(async () => {
      const response = await createAbsenceAction(form);
      setResult(response);
      if (response.ok && !response.conflicts?.length) setTimeout(onClose, 700);
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="panel-modal absence-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="absence-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Zamknij" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="eyebrow">Wyjątek w grafiku</p>
        <h2 id="absence-title">Oznacz nieobecność</h2>
        <label>
          Data
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>
        <div className="two-fields">
          <label>
            Od
            <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
          </label>
          <label>
            Do
            <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
          </label>
        </div>
        <label>
          Powód (opcjonalnie)
          <input
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="np. szkolenie"
          />
        </label>
        <p className="warning-box">Nieobecność blokuje nowe rezerwacje, ale nie odwołuje istniejących wizyt.</p>
        {result && (
          <div className={result.ok ? "form-success" : "form-error"}>
            {result.message}
            {result.conflicts?.length ? <small>Wizyty: {result.conflicts.join(", ")}</small> : null}
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose}>
            Anuluj
          </button>
          <button className="primary-action" disabled={pending} onClick={save}>
            {pending ? "Zapisywanie…" : "Zapisz nieobecność"}
          </button>
        </div>
      </section>
    </div>
  );
}
