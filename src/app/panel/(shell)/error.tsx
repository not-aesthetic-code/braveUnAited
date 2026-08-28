"use client";

export default function TherapistPanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f6] p-6">
      <section className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-[#009b3d]">Panel specjalisty</p>
        <h1 className="mt-3 text-2xl font-bold text-[#13293d]">Nie udało się wczytać kalendarza</h1>
        <p className="mt-2 text-sm text-slate-500">Sprawdź połączenie z Supabase i zastosowane migracje bazy danych.</p>
        <button className="mt-5 rounded-lg bg-[#01be4a] px-4 py-2 text-sm font-semibold text-white" onClick={reset}>Spróbuj ponownie</button>
      </section>
    </main>
  );
}
