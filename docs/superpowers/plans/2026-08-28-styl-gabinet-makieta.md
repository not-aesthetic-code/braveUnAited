# Styl referencyjny gabinet-makieta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dopasować kolorystykę, font i promienie zaokrągleń tej aplikacji do publicznego prototypu `fundacja-niepodzielni.github.io/gabinet-makieta`.

**Architecture:** Wyłącznie zmiana tokenów wizualnych (CSS custom properties w `globals.css`, font w `layout.tsx`, jeden Tailwind-owy `rounded-*` w `button.tsx`). Zero zmian w strukturze komponentów, layoutu czy logice. Projekt nie ma frameworka testowego (brak Jest/Vitest — tylko ręczne skrypty `*.selfcheck.ts` do logiki biznesowej), więc zamiast red/green testów jednostkowych każdy task kończy się realną weryfikacją wizualną (`next dev` + oczy) i sanity-checkiem budowy (`pnpm lint`, `tsc --noEmit`).

**Tech Stack:** Next.js 16, Tailwind CSS v4 (`@theme inline`), shadcn (`@base-ui/react`), `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-08-28-styl-referencja-gabinet-makieta-design.md`

## Global Constraints

- Font: **Roboto** (wagi 400/500/700/900) zamiast Geist Sans; Geist Mono zostaje bez zmian (poza zakresem).
- Kolor primary: `#01be4a` (jasny i ciemny motyw, ta sama wartość).
- Kolor secondary-foreground / "mocny tekst": `#1500bb` (jasny), `#b9c2ff` (ciemny).
- Promień bazowy (`--radius`): `0.75rem` (12px) zamiast `0.625rem`.
- Przyciski: warianty `default`, `lg`, `icon`, `icon-lg` — pełny `rounded-full`. Warianty `xs`, `sm`, `icon-xs`, `icon-sm` — **bez zmian** (własny, nadpisujący promień).
- Poza zakresem: `chart-1..5`, `sidebar*`, `destructive-foreground` — zostają wartości domyślne z obecnego `globals.css`, nieużywane nigdzie w kodzie.
- Referencja jest wyłącznie jasna; ciemny motyw to **wyprowadzona** paleta (decyzja użytkownika: zachować `.dark`, nie usuwać).

---

## Task 1: Tokeny kolorów i promienia w `globals.css`

**Files:**
- Modify: `src/app/globals.css:51-118` (bloki `:root` i `.dark`)

**Interfaces:**
- Produces: CSS custom properties `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` — czytane przez `@theme inline` (linie 7-49, bez zmian) i przez wszystkie komponenty shadcn (`button.tsx`, `dialog.tsx`, `input.tsx`, `field.tsx`, `label.tsx`, `separator.tsx`).

- [ ] **Step 1: Podmień blok `:root` (linie 51-84)**

Zastąp całą zawartość między `:root {` a odpowiadającym `}` (linie 52-83, wewnątrz istniejącego `:root {` z linii 51) tym blokiem — `--chart-*` i `--sidebar*` zostają bez zmian (poza zakresem), zmieniają się tylko wypisane niżej:

```css
  --background: #f9f8f6;
  --foreground: #323232;
  --card: #ffffff;
  --card-foreground: #323232;
  --popover: #ffffff;
  --popover-foreground: #323232;
  --primary: #01be4a;
  --primary-foreground: #ffffff;
  --secondary: #f0f3ff;
  --secondary-foreground: #1500bb;
  --muted: #f5f5f5;
  --muted-foreground: #707070;
  --accent: #e6f9ef;
  --accent-foreground: #04822f;
  --destructive: #c0392b;
  --border: #eaeaea;
  --input: #eaeaea;
  --ring: #01be4a;
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.75rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
```

- [ ] **Step 2: Podmień blok `.dark` (linie 86-118)**

Zastąp całą zawartość między `.dark {` a odpowiadającym `}`:

```css
  --background: #17181a;
  --foreground: #ededed;
  --card: #1f2123;
  --card-foreground: #ededed;
  --popover: #1f2123;
  --popover-foreground: #ededed;
  --primary: #01be4a;
  --primary-foreground: #ffffff;
  --secondary: #23263a;
  --secondary-foreground: #b9c2ff;
  --muted: #232323;
  --muted-foreground: #a0a0a0;
  --accent: #12301d;
  --accent-foreground: #6fe3a0;
  --destructive: #e2574a;
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 10%);
  --ring: #01be4a;
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
```

- [ ] **Step 3: Sanity-check budowy**

Run: `pnpm lint`
Expected: brak nowych błędów (eslint nie sprawdza CSS, ale potwierdza, że nic innego się nie posypało).

- [ ] **Step 4: Weryfikacja wizualna tokenów**

Run: `pnpm dev`, otwórz `http://localhost:3000/`.
W devtoolsach wykonaj w konsoli:
```js
getComputedStyle(document.body).backgroundColor // oczekiwane: rgb(249, 248, 246)
getComputedStyle(document.body).color           // oczekiwane: rgb(50, 50, 50)
```
Dodaj klasę `dark` do `<html>` w devtoolsach i powtórz — oczekiwane: `rgb(23, 24, 26)` / `rgb(237, 237, 237)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "style: dopasuj tokeny kolorów i promienia do referencji gabinet-makieta"
```

---

## Task 2: Font Roboto

**Files:**
- Modify: `src/app/layout.tsx` (całość, 29 linii)
- Modify: `src/app/globals.css:10` (`--font-sans` w bloku `@theme inline`)

**Interfaces:**
- Consumes: `--font-roboto`, `--font-geist-mono` — CSS zmienne ustawiane przez `next/font/google` na klasie `<html>`.
- Produces: `--font-sans` poprawnie wskazujący na Roboto, konsumowany przez `--font-heading` (`globals.css:12`, bez zmian) i klasę Tailwind `font-sans` (`globals.css:128`, `html { @apply font-sans; }`, bez zmian).

- [ ] **Step 1: Zamień import i deklarację fontu w `layout.tsx`**

Zastąp całą zawartość pliku `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BRAVE UnAIted",
  description: "Hackathon base app — BRAVE UnAIted, 2026-08-28",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Podłącz `--font-sans` w `globals.css`**

W bloku `@theme inline` (linia 10) zamień:

```css
  --font-sans: var(--font-sans);
```

na:

```css
  --font-sans: var(--font-roboto);
```

- [ ] **Step 3: Sanity-check typów i builda**

Run: `pnpm exec tsc --noEmit`
Expected: 0 błędów.

Run: `pnpm lint`
Expected: 0 nowych błędów.

- [ ] **Step 4: Weryfikacja wizualna fontu**

Run: `pnpm dev`, otwórz `http://localhost:3000/`.
W devtoolsach: `getComputedStyle(document.body).fontFamily` powinno zaczynać się od `"Roboto"` (nie `__Geist_*` / `system-ui`).
Sprawdź wizualnie, że tekst faktycznie wygląda jak Roboto (geometryczny, inny krój niż poprzednio widoczny Geist).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "style: podłącz font Roboto zamiast Geist Sans"
```

---

## Task 3: Pigułkowy promień przycisków

**Files:**
- Modify: `src/components/ui/button.tsx:7`

**Interfaces:**
- Consumes: `--radius` z Task 1 (wartość `0.75rem`), warianty `xs`/`sm`/`icon-xs`/`icon-sm` już mają własny `rounded-[min(var(--radius-md),Npx)]` (linie 25, 26, 29-30, 31-32) — **nie ruszać**.
- Produces: bazowa klasa `rounded-full` dziedziczona przez warianty `default`, `lg`, `icon`, `icon-lg` (brak własnego nadpisania promienia).

- [ ] **Step 1: Zamień `rounded-lg` na `rounded-full` w bazowej klasie**

W `src/components/ui/button.tsx:7`, wewnątrz stringa przekazanego do `cva(...)`, zamień:

```
"group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent ...
```

na:

```
"group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent ...
```

(reszta stringa bez zmian — tylko `rounded-lg` → `rounded-full`).

- [ ] **Step 2: Sanity-check typów i builda**

Run: `pnpm exec tsc --noEmit`
Expected: 0 błędów.

Run: `pnpm lint`
Expected: 0 nowych błędów.

- [ ] **Step 3: Weryfikacja wizualna przycisków**

Run: `pnpm dev`, otwórz stronę z widocznym przyciskiem domyślnego/`lg` rozmiaru (np. `/panel/login` — przycisk logowania, lub `/book` — przycisk rezerwacji).
Sprawdź: przycisk jest w pełni zaokrąglony (pigułka), nie ma prostych rogów.
Sprawdź komponent z wariantem `xs`/`sm` (jeśli występuje w UI) — promień pozostaje mały/kwadratowy, nie pigułkowy (celowe, patrz Global Constraints).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "style: pigułkowy promień dużych przycisków (rounded-full)"
```

---

## Task 4: Weryfikacja końcowa na wszystkich stronach

**Files:** brak zmian kodu — tylko weryfikacja i ewentualne poprawki punktowe wynikłe z przeglądu.

**Interfaces:** brak (task końcowy, zamyka plan).

- [ ] **Step 1: Przejrzyj wizualnie każdą stronę w jasnym motywie**

Run: `pnpm dev`. Otwórz kolejno:
- `http://localhost:3000/` (strona główna)
- `http://localhost:3000/book` (rezerwacja)
- `http://localhost:3000/panel/login` (logowanie)
- `http://localhost:3000/panel` (panel — jeśli dostępny bez pełnego zalogowania, sprawdź co się renderuje)

Na każdej: tło ciepłe off-white, karty białe, przyciski zielone/pigułkowe, font Roboto, brak resztek starej szarej palety shadcn czy Geista.

- [ ] **Step 2: Przejrzyj wizualnie ciemny motyw**

W devtoolsach dodaj klasę `dark` do `<html>`, powtórz przegląd tych samych stron. Sprawdź czytelność tekstu na tle (kontrast) i że nie ma miejsc z resztkami jasnych kolorów na ciemnym tle (np. białe tło karty w dark mode = błąd).

- [ ] **Step 3: Napraw drobne odchylenia, jeśli się pojawią**

Jeśli coś nie zgadza się z tabelą tokenów w spec (`docs/superpowers/specs/2026-08-28-styl-referencja-gabinet-makieta-design.md`), popraw punktowo w `globals.css` i zacommituj jako osobny, mały commit z opisem co i dlaczego.

- [ ] **Step 4: Finalny commit (jeśli step 3 nic nie zmienił, pomiń)**

```bash
git add src/app/globals.css
git commit -m "style: drobne poprawki po wizualnej weryfikacji"
```
