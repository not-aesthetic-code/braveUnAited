# Dopasowanie stylu do referencji `gabinet-makieta` — design (bounded)

Data: 2026-08-28
Status: zaakceptowany, wdrożenie w toku

## Cel

Ujednolicić kolorystykę, typografię i promienie zaokrągleń tej aplikacji z
publicznym prototypem `fundacja-niepodzielni.github.io/gabinet-makieta`,
opisanym jako referencja w `docs/wymagania-gabinet.md`.

## Źródło prawdy

Pobrana i przeanalizowana żywa strona
`https://fundacja-niepodzielni.github.io/gabinet-makieta/` (2026-08-28).
Zawiera kompletny system tokenów CSS w `:root` z prefiksami `--np-*`
(design system fundacji) i `--psy-*` (aliasy używane w widoku gabinetu
psychologicznego).

Uwaga: `docs/Wymagania systemu rezerwacji_files/a_lqgb.html` to **inny**
artefakt (wygenerowany dokument wymagań, wystylizowany osobno — czcionki
Fraunces/IBM Plex Mono, paleta zielono-fioletowa) i **nie** jest źródłem tej
zmiany, mimo że leży w tym samym folderze `docs/`.

Fakty z referencji:

- Font: **Roboto** (wagi 400/500/700/900), body 16px, line-height 1.6.
- Kolor główny (CTA/primary): zielony `#01be4a`.
- Kolor drugorzędny / mocny tekst: indygo `#1500bb`.
- Tło strony ciepłe off-white `#f9f8f6`, karty białe `#ffffff`, tekst
  `#323232`.
- Przyciski: **w pełni zaokrąglone (pill)** — `--np-radius-pill: 50px`
  (12 użyć), karty/inputy najczęściej `--np-radius-sm: 12px` (14 użyć).
- Błąd `#c0392b`, ostrzeżenie `#f59e0b`, info `#4a90e2`.
- Referencja jest **wyłącznie jasna** — brak `prefers-color-scheme` i
  `data-theme` w jej CSS.

## Decyzja: tryb ciemny

Referencja nie ma dark mode. Zdecydowano (użytkownik, 2026-08-28):
**zachować przełącznik `.dark` w aplikacji, ale przeliczyć ciemne warianty
nowej palety** (zielony/indygo) zamiast zostawiać domyślną szarość shadcn.

## Mapowanie tokenów (`src/app/globals.css`)

| token shadcn | jasny | ciemny (wyprowadzony) |
|---|---|---|
| background | `#f9f8f6` | `#17181a` |
| foreground | `#323232` | `#ededed` |
| card / popover | `#ffffff` | `#1f2123` |
| card-foreground / popover-foreground | `#323232` | `#ededed` |
| primary | `#01be4a` | `#01be4a` |
| primary-foreground | `#ffffff` | `#ffffff` |
| secondary | `#f0f3ff` | `#23263a` |
| secondary-foreground | `#1500bb` | `#b9c2ff` |
| muted | `#f5f5f5` | `#232323` |
| muted-foreground | `#707070` | `#a0a0a0` |
| accent | `#e6f9ef` | `#12301d` |
| accent-foreground | `#04822f` | `#6fe3a0` |
| destructive | `#c0392b` | `#e2574a` |
| border / input | `#eaeaea` | `oklch(1 0 0 / 10%)` |
| ring | `#01be4a` | `#01be4a` |
| radius (bazowy) | `0.75rem` (12px) | tak samo |

## Pozostałe zmiany

- **Font** — `src/app/layout.tsx`: zamiana `Geist`/`Geist_Mono` na `Roboto`
  z `next/font/google`, poprawnie podpięta pod `--font-sans` w
  `globals.css` (poprzedni zapis `--font-sans: var(--font-sans)` był
  samo-referencyjny i nigdy realnie nie podłączał Geista — naprawione przy
  okazji).
- **Przyciski** — `src/components/ui/button.tsx`: dodanie `rounded-full`,
  aby odwzorować pigułkowy kształt CTA z referencji. Reszta komponentów
  shadcn dziedziczy `--radius` bez zmian w kodzie.
- Struktura komponentów i layout bez zmian — to wyłącznie zmiana tokenów
  wizualnych.

## Testowanie

`next dev` + wizualna weryfikacja strony głównej, `/book`, `/panel`
(jasny motyw); tryb ciemny weryfikowany ręcznym dodaniem klasy `.dark` w
devtoolsach (aplikacja nie ma jeszcze widocznego przełącznika).
