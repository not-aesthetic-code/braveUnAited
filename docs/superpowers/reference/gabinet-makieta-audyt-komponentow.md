# Audyt CSS referencji `gabinet-makieta` — pełen katalog komponentów

Data: 2026-08-28. Źródło: `gabinet-makieta-raw.css` w tym samym folderze (48KB, 
pobrane i wyekstrahowane z `https://fundacja-niepodzielni.github.io/gabinet-makieta/`, 
bloki `@font-face` z osadzonymi fontami usunięte jako nieistotne dla stylu).

Łącznie **231** nazwanych klas CSS w referencji. Poniżej pogrupowane wg 
funkcji, z pełnymi regułami (baza + hover/focus/disabled/aria-state) wyciągniętymi 
wprost z kodu źródłowego.

Legenda: ✅ = ma odpowiednik w naszym kodzie (wdrożone lub do wdrożenia), ⏳ = brak 
odpowiedniego komponentu w naszej aplikacji jeszcze (poza zakresem na teraz).

---

## Przyciski

### `.btn-primary` ✅

```css
.btn-primary,.btn-secondary,.btn-ghost,.btn-danger{font-family:var(--psy-font);font-weight:var(--psy-fw-medium);border-radius:var(--psy-radius-pill);cursor:pointer;transition:var(--psy-transition-fast);white-space:nowrap;justify-content:center;align-items:center;gap:10px;text-decoration:none;display:inline-flex}
.btn-primary{background:var(--psy-green);color:#fff;border:none;padding:14px 32px}
.btn-primary:hover:not(:disabled){filter:brightness(1.08)}
.btn-primary:disabled{background:var(--psy-bg-grey-mid);cursor:not-allowed}
```

### `.btn-secondary` ✅

```css
.btn-primary,.btn-secondary,.btn-ghost,.btn-danger{font-family:var(--psy-font);font-weight:var(--psy-fw-medium);border-radius:var(--psy-radius-pill);cursor:pointer;transition:var(--psy-transition-fast);white-space:nowrap;justify-content:center;align-items:center;gap:10px;text-decoration:none;display:inline-flex}
.btn-secondary{color:var(--psy-violet);border:2px solid var(--psy-violet);background:0 0;padding:12px 30px}
.btn-secondary:hover:not(:disabled){background:var(--psy-violet-06)}
.btn-secondary:disabled{opacity:.45;cursor:not-allowed}
```

### `.btn-ghost` ✅

```css
.btn-primary,.btn-secondary,.btn-ghost,.btn-danger{font-family:var(--psy-font);font-weight:var(--psy-fw-medium);border-radius:var(--psy-radius-pill);cursor:pointer;transition:var(--psy-transition-fast);white-space:nowrap;justify-content:center;align-items:center;gap:10px;text-decoration:none;display:inline-flex}
.btn-ghost{color:var(--psy-text-muted);border:1px solid var(--psy-border);font-size:var(--psy-small);background:0 0;padding:9px 18px}
.btn-ghost:hover:not(:disabled){background:var(--psy-bg-grey);color:var(--psy-text-strong)}
.btn-ghost:disabled{opacity:.45;cursor:not-allowed}
```

### `.btn-danger` ✅

```css
.btn-primary,.btn-secondary,.btn-ghost,.btn-danger{font-family:var(--psy-font);font-weight:var(--psy-fw-medium);border-radius:var(--psy-radius-pill);cursor:pointer;transition:var(--psy-transition-fast);white-space:nowrap;justify-content:center;align-items:center;gap:10px;text-decoration:none;display:inline-flex}
.btn-danger{color:var(--psy-error);border:1px solid var(--psy-error-border);font-size:var(--psy-small);background:0 0;padding:9px 18px}
.btn-danger:hover:not(:disabled){background:var(--psy-error-bg)}
```

### `.btn-buycoffee` ⏳

```css
.btn-buycoffee{border:1px solid var(--np-secondary);color:var(--np-secondary);font-size:var(--np-body);font-weight:var(--np-fw-bold);white-space:nowrap;transition:var(--np-transition-fast);border-radius:999px;align-items:center;gap:10px;padding:6px 16px;text-decoration:none;display:inline-flex}
.btn-buycoffee:hover{background:var(--np-secondary);color:var(--np-roz-pasek)}
```

### `.btn-karta` ⏳

```css
.btn-karta{border-radius:var(--np-radius-pill);background:var(--np-primary);color:#fff;font-family:var(--np-font);font-size:var(--np-caption);letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:var(--np-transition-fast);border:none;align-self:flex-start;margin-top:auto;padding:14px 28px;font-weight:800;text-decoration:none}
.btn-karta:hover{filter:brightness(1.08)}
```

### `.btn-support` ⏳

```css
.btn-support{z-index:170;border:1px solid var(--np-border);border-radius:var(--np-radius-pill);color:var(--np-text-muted);font-family:var(--np-font);font-size:var(--np-caption);font-weight:var(--np-fw-semibold);cursor:pointer;box-shadow:var(--np-shadow-card);transition:var(--np-transition-fast);background:#fff;align-items:center;gap:8px;padding:10px 18px;display:inline-flex;position:fixed;right:20px}
.btn-support:hover{color:var(--np-granat);border-color:var(--np-primary)}
.btn-support{right:12px}
.btn-support span{display:none}
```

### `.hero__btn` ⏳

```css
.hero__btn{font-family:var(--np-font);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;border:none;border-radius:999px;justify-content:center;align-items:center;padding:14px 38px;font-size:14px;font-weight:800;line-height:1;text-decoration:none;transition:background .2s,color .2s,transform .2s,box-shadow .2s;display:inline-flex}
.hero__btn:hover{transform:translateY(-2px);box-shadow:0 6px 18px #0000002e}
```

### `.hero__btn--bialy` ⏳

```css
.hero__btn--bialy{color:var(--np-primary);background:#fff}
```

### `.hero__btn--zielony` ⏳

```css
.hero__btn--zielony{background:var(--np-primary);color:#fff}
```

---

## Karty

### `.card` ✅

```css
.card{background:var(--np-bg-card);border-radius:var(--np-radius-card);box-shadow:var(--np-shadow-card);border:2px solid #0000;padding:32px;transition:all .3s ease-in-out}
a.card:hover,.card--klikalna:hover{border-color:var(--np-primary);box-shadow:var(--np-shadow-hover);transform:translateY(-2px)}
.card{border-radius:var(--np-radius-xxl);padding:22px}
.card{box-shadow:none!important}
```

### `.card--klikalna` ✅

```css
a.card:hover,.card--klikalna:hover{border-color:var(--np-primary);box-shadow:var(--np-shadow-hover);transform:translateY(-2px)}
```

### `.card--brand` ⏳

```css
.card--brand{background:var(--np-primary);color:#fff;box-shadow:none}
```

### `.card--tight` ⏳

```css
.card--tight{border-radius:var(--np-radius-large);padding:20px}
```

### `.card--warm` ⏳

```css
.card--warm{background:var(--np-bg-warm);box-shadow:none;border-color:var(--np-border-card)}
```

### `.karta-osoby` ⏳

```css
.karta-osoby{border:1px solid var(--np-border);border-radius:var(--np-radius-photo);background:#fff;transition:border-color .3s,box-shadow .3s,transform .3s;display:flex;overflow:hidden}
.karta-osoby:hover{border-color:var(--np-primary);box-shadow:var(--np-shadow-hover)}
.karta-osoby{flex-direction:column}
```

### `.profil-karta` ⏳

```css
.profil-karta{border:1px solid var(--np-border-card);border-radius:var(--np-radius-profile);box-shadow:var(--np-shadow-card);background:#fff;padding:80px;position:relative}
.profil-karta{padding:40px 20px}
```

---

## Odznaki / banery statusu

### `.badge` ✅

```css
.badge{font-size:var(--psy-caption);font-weight:var(--psy-fw-medium);color:var(--psy-text-muted);background:var(--psy-bg-grey);white-space:nowrap;border-radius:999px;align-items:center;gap:6px;padding:4px 12px;display:inline-flex}
```

### `.badge--akcent` ✅

```css
.badge--akcent{color:var(--psy-violet);background:var(--psy-violet-15)}
```

### `.badge--blad` ✅

```css
.badge--blad{color:var(--psy-error);background:var(--psy-error-bg)}
```

### `.badge--sukces` ✅

```css
.badge--sukces{color:var(--psy-green);background:var(--psy-green-20)}
```

### `.badge--uwaga` ✅

```css
.badge--uwaga{color:var(--psy-warning-text);background:var(--psy-warning-bg)}
```

### `.baner` ⏳

```css
.baner{border-radius:var(--psy-radius-md);font-size:var(--psy-small);align-items:flex-start;gap:12px;padding:14px 18px;line-height:1.5;display:flex}
.baner strong{margin-bottom:2px;display:block}
.baner svg{flex:none;margin-top:2px}
```

### `.baner--blad` ⏳

```css
.baner--blad{background:var(--psy-error-bg);color:var(--psy-error);border-left:3px solid var(--psy-error)}
```

### `.baner--info` ⏳

```css
.baner--info{background:var(--psy-violet-06);color:var(--psy-text-muted);border-left:3px solid var(--psy-violet)}
```

### `.baner--sukces` ⏳

```css
.baner--sukces{background:var(--psy-green-10);color:var(--psy-text-muted);border-left:3px solid var(--psy-green)}
```

### `.baner--uwaga` ⏳

```css
.baner--uwaga{background:var(--psy-warning-bg);color:var(--psy-warning-text);border-left:3px solid var(--psy-warning)}
```

### `.pasek-trybu` ⏳

```css
.pasek-trybu{color:#fff;padding:11px 24px}
```

### `.pasek-trybu--nisko` ⏳

```css
.pasek-trybu--nisko{background:var(--np-nisko)}
```

### `.pasek-trybu--pelno` ⏳

```css
.pasek-trybu--pelno{background:var(--np-pelno)}
```

---

## Pola formularza

### `.pole` ✅

```css
.pole{border:1px solid var(--psy-border);border-radius:var(--psy-radius-sm);width:100%;font-size:var(--psy-body);font-family:var(--psy-font);color:var(--psy-text);transition:var(--psy-transition-fast);background:#fff;padding:12px 16px}
.pole:hover:not(:disabled){border-color:var(--psy-bg-grey-mid)}
.pole:focus{border-color:var(--psy-violet);box-shadow:0 0 0 3px var(--psy-violet-15);outline:none}
.pole:disabled{background:var(--psy-bg-grey);color:var(--psy-text-subtle);cursor:not-allowed}
```

### `.pole-wrzut` ⏳

```css
.pole-wrzut{cursor:pointer;background:var(--np-bg-grey);border:1.5px dashed var(--np-border);border-radius:var(--np-radius-md);width:100%;color:var(--np-text-muted);font-family:var(--np-font);font-size:var(--np-small);flex-direction:column;justify-content:center;align-items:center;gap:6px;padding:26px 20px;transition:border-color .18s,background .18s,color .18s;display:flex}
.pole-wrzut:hover{border-color:var(--np-primary);background:var(--np-primary-10);color:var(--np-granat)}
```

---

## Kalendarz / sloty / godziny

### `.slot` ✅

```css
.slot{border:1px solid var(--psy-border);border-radius:var(--psy-radius-sm);min-width:74px;font-family:var(--psy-font);font-size:var(--psy-small);font-weight:var(--psy-fw-medium);font-variant-numeric:tabular-nums;color:var(--psy-text-strong);cursor:pointer;transition:var(--psy-transition-fast);background:#fff;justify-content:center;align-items:center;padding:9px 12px;display:inline-flex}
.slot:hover:not(:disabled){border-color:var(--psy-violet);color:var(--psy-violet);background:var(--psy-violet-06)}
.slot[aria-pressed=true]{border-color:var(--psy-green);background:var(--psy-green);color:#fff}
.slot:disabled{background:var(--psy-bg-grey);color:var(--psy-text-subtle);cursor:not-allowed;text-decoration:line-through}
```

### `.sloty` ⏳

```css
.sloty{flex-wrap:wrap;gap:8px;display:flex}
```

### `.dzien` ✅

```css
.dzien{border:1px solid var(--psy-border);border-radius:var(--psy-radius-sm);cursor:pointer;font-family:var(--psy-font);transition:var(--psy-transition-fast);background:#fff;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;display:flex}
.dzien:hover:not(:disabled){border-color:var(--psy-violet)}
.dzien[aria-pressed=true]{border-color:var(--psy-violet);background:var(--psy-violet-06)}
.dzien:disabled{opacity:.45;cursor:not-allowed}
```

### `.dni` ⏳

```css
.dni{grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;display:grid}
```

### `.komorka-godziny` ✅

```css
.komorka-godziny{border:1px solid var(--psy-border);border-radius:var(--psy-radius-xs);font-family:var(--psy-font);font-size:var(--psy-caption);font-variant-numeric:tabular-nums;color:var(--psy-text-subtle);cursor:pointer;transition:var(--psy-transition-fast);background:#fff;padding:7px 4px}
.komorka-godziny:hover{border-color:var(--psy-violet)}
```

### `.komorka-godziny--dodana` ⏳

```css
.komorka-godziny--dodana{background:var(--psy-green-10);border-color:var(--psy-green);color:var(--psy-green);font-weight:var(--psy-fw-medium)}
```

### `.komorka-godziny--wylaczona` ⏳

```css
.komorka-godziny--wylaczona{background:var(--psy-bg-grey);color:var(--psy-text-subtle);border-style:dashed;text-decoration:line-through}
```

### `.komorka-godziny--zajeta` ⏳

```css
.komorka-godziny--zajeta{background:var(--psy-violet);border-color:var(--psy-violet);color:#fff;cursor:not-allowed}
```

### `.komorka-godziny--zakres` ⏳

```css
.komorka-godziny--zakres{background:var(--psy-violet-06);border-color:var(--psy-violet-15);color:var(--psy-violet);font-weight:var(--psy-fw-medium)}
```

### `.grafik` ⏳

```css
.grafik{--grafik-wiersz:58px;background:var(--np-border);gap:1px;min-width:980px;display:grid}
```

### `.grafik-scroll` ⏳

```css
.grafik-scroll{border:1px solid var(--np-border);border-radius:var(--np-radius-md);overflow-x:auto}
```

### `.grafik__godzina` ⏳

```css
.grafik__godzina{height:var(--grafik-wiersz);background:var(--np-bg-warm);font-size:var(--np-caption);font-weight:var(--np-fw-semibold);color:var(--np-text-muted);font-variant-numeric:tabular-nums;justify-content:flex-end;align-items:center;padding:0 12px;display:flex}
```

### `.grafik__komorka` ⏳

```css
.grafik__komorka{height:var(--grafik-wiersz);background:#fff;padding:4px;display:flex}
```

### `.grafik__naglowek` ⏳

```css
.grafik__naglowek{z-index:2;background:var(--np-bg-warm);font-size:var(--np-caption);font-weight:var(--np-fw-semibold);color:var(--np-granat);padding:12px 10px;position:sticky;top:0}
```

### `.siatka-godzin` ⏳

```css
.siatka-godzin{gap:4px;min-width:620px;display:grid}
```

---

## Nawigacja / zakładki

### `.nawigacja` ⏳

```css
.nawigacja{flex-direction:column;gap:4px;display:flex}
.nawigacja a{border-radius:var(--psy-radius-sm);font-size:var(--psy-small);font-weight:var(--psy-fw-medium);color:var(--psy-text-muted);transition:var(--psy-transition-fast);align-items:center;gap:12px;padding:10px 16px;text-decoration:none;display:flex;position:relative}
.nawigacja a:hover{background:var(--np-bg-page)}
.nawigacja a.aktywna{color:var(--np-primary);background:var(--np-primary-10)}
.nawigacja a.aktywna:before{content:"";background:var(--np-primary);border-radius:0 3px 3px 0;width:3px;height:24px;position:absolute;top:50%;left:0;transform:translateY(-50%)}
```

### `.zakladka` ⏳

```css
.zakladka{font-family:var(--np-font);font-size:var(--np-h4);font-weight:var(--np-fw-semibold);color:var(--np-text-quiet);cursor:pointer;white-space:nowrap;transition:var(--np-transition-fast);background:0 0;border:none;padding:15px 18px;position:relative}
.zakladka:hover{color:var(--np-text-strong)}
.zakladka[aria-selected=true]{color:var(--np-primary)}
.zakladka[aria-selected=true]:after{content:"";background:var(--np-primary);width:100%;height:3px;position:absolute;bottom:-1px;left:0}
```

### `.zakladki` ⏳

```css
.zakladki{border-bottom:1px solid #f0f0f0;gap:4px;display:flex;overflow-x:auto}
```

### `.zakladki--srodek` ⏳

```css
.zakladki--srodek{justify-content:center;gap:80px;margin-bottom:50px}
.zakladki--srodek{justify-content:flex-start;gap:24px}
```

### `.menu-glowne` ⏳

```css
.menu-glowne{flex:1;justify-content:center;align-items:center;gap:26px;display:flex}
```

### `.menu-glowne__pozycja` ⏳

```css
.menu-glowne__pozycja{cursor:pointer;font-family:var(--np-font);font-size:var(--np-body);font-weight:var(--np-fw-bold);color:var(--np-secondary);white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:0;text-decoration:none;display:inline-flex}
.menu-glowne__pozycja:hover{color:var(--np-primary)}
```

### `.menu-panel` ⏳

```css
.menu-panel{z-index:45;padding-top:16px;position:absolute;top:100%;left:-16px}
```

### `.menu-panel__karta` ⏳

```css
.menu-panel__karta{border:1px solid var(--np-border);border-radius:var(--np-radius-xl);box-shadow:var(--np-shadow-modal);background:#fff;padding:12px}
```

### `.menu-panel__pozycja` ⏳

```css
.menu-panel__pozycja{border-radius:var(--np-radius-sm);transition:background var(--np-transition-fast);padding:10px 12px;text-decoration:none;display:block}
.menu-panel__pozycja:hover{background:var(--np-bg-page)}
```

---

## Wpisy list / tabel

### `.wpis` ✅

```css
.wpis{border:none;border-left:3px solid var(--np-secondary);border-radius:var(--np-radius-xs);background:var(--np-secondary-06);text-align:left;width:100%;font-family:var(--np-font);font-size:var(--np-caption);color:var(--np-granat);cursor:pointer;transition:var(--np-transition-fast);flex-direction:column;justify-content:center;padding:4px 8px;line-height:1.3;display:flex;overflow:hidden}
.wpis>span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.wpis:hover{background:var(--np-secondary-15)}
```

### `.wpis--blokada` ⏳

```css
.wpis--blokada{background:repeating-linear-gradient(135deg,var(--np-bg-grey) 0 6px,#fff 6px 12px);color:var(--np-text-subtle);cursor:default;border-left-color:#0000;justify-content:center;align-items:center;font-size:11px}
```

### `.wpis--uwaga` ⏳

```css
.wpis--uwaga{border-left-color:var(--np-warning);background:var(--np-warning-bg)}
```

### `.wpis--wolny` ⏳

```css
.wpis--wolny{border:1px dashed var(--np-primary-25);color:var(--np-primary);background:0 0;justify-content:center;align-items:center;font-size:11px}
.wpis--wolny:hover{background:var(--np-primary-10);border-style:solid}
```

### `.wpis__meta` ⏳

```css
.wpis__meta{color:var(--np-text-muted);font-size:11px}
```

### `.tabela` ⏳

```css
.tabela{border-collapse:collapse;width:100%;font-size:var(--psy-small)}
.tabela th{text-align:left;border-bottom:1px solid var(--psy-border);font-weight:var(--psy-fw-medium);font-size:var(--psy-caption);text-transform:uppercase;letter-spacing:.04em;color:var(--psy-text-subtle);white-space:nowrap;padding:12px 16px}
.tabela td{border-bottom:1px solid var(--psy-border-warm);vertical-align:middle;padding:14px 16px}
.tabela tbody tr{transition:background var(--psy-transition-fast)}
.tabela tbody tr:hover{background:var(--psy-bg-page)}
.tabela-scroll .tabela{min-width:700px}
```

### `.tabela-scroll` ⏳

```css
.tabela-scroll{overflow-x:auto}
.tabela-scroll .tabela{min-width:700px}
```

---

## Chipy / tagi / przełączniki

### `.chip` ⏳

```css
.chip{border:1px solid var(--psy-border);border-radius:var(--psy-radius-pill);font-family:var(--psy-font);font-size:var(--psy-caption);font-weight:var(--psy-fw-medium);color:var(--psy-text-muted);cursor:pointer;transition:var(--psy-transition-fast);background:#fff;align-items:center;gap:7px;padding:7px 14px;display:inline-flex}
.chip:hover{border-color:var(--psy-violet);color:var(--psy-violet)}
.chip[aria-pressed=true]{border-color:var(--psy-violet);background:var(--psy-violet-15);color:var(--psy-violet)}
```

### `.chipy` ⏳

```css
.chipy{flex-wrap:wrap;gap:8px;display:flex}
```

### `.tag-zawod` ⏳

```css
.tag-zawod{border:1px solid var(--np-primary);border-radius:var(--np-radius-photo);width:max-content;max-width:100%;color:var(--np-primary);font-size:var(--np-caption);font-weight:var(--np-fw-bold);text-transform:uppercase;background:0 0;padding:5px 18px;display:inline-block}
```

### `.rola-pill` ⏳

```css
.rola-pill{border:1.5px solid var(--np-primary);border-radius:var(--np-radius-pill);color:var(--np-primary);font-size:var(--np-caption);font-weight:var(--np-fw-bold);letter-spacing:.5px;text-transform:uppercase;background:0 0;align-self:flex-start;padding:6px 16px}
```

### `.przelacznik` ⏳

```css
.przelacznik{cursor:pointer;align-items:center;gap:12px;display:inline-flex}
.przelacznik input{opacity:0;pointer-events:none;position:absolute}
.przelacznik input:checked+.przelacznik__tor{background:var(--psy-green)}
.przelacznik input:checked+.przelacznik__tor:after{transform:translate(20px)}
```

### `.przelacznik-grupa` ⏳

```css
.przelacznik-grupa{background:var(--np-bg-grey);border-radius:var(--np-radius-pill);flex-shrink:0;padding:5px;display:inline-flex}
.przelacznik-grupa button{border-radius:var(--np-radius-pill);font-family:var(--np-font);font-size:var(--np-caption);font-weight:var(--np-fw-semibold);color:var(--np-text-muted);cursor:pointer;white-space:nowrap;transition:var(--np-transition-fast);background:0 0;border:none;padding:9px 18px}
.przelacznik-grupa button[aria-pressed=true]{color:var(--np-secondary);box-shadow:var(--np-shadow-card-small);background:#fff}
```

### `.przelacznik__tor` ⏳

```css
.przelacznik__tor{background:var(--psy-bg-grey-mid);width:44px;height:24px;transition:var(--psy-transition-fast);border-radius:999px;flex:none;position:relative}
.przelacznik__tor:after{content:"";width:18px;height:18px;transition:var(--psy-transition-fast);background:#fff;border-radius:50%;position:absolute;top:3px;left:3px}
.przelacznik input:checked+.przelacznik__tor{background:var(--psy-green)}
.przelacznik input:checked+.przelacznik__tor:after{transform:translate(20px)}
```

---

## Modal / dialog

### `.modal` ⏳

```css
.modal{background:var(--psy-bg-card);border-radius:var(--psy-radius-2xl);width:min(560px,100%);box-shadow:var(--psy-shadow-modal);animation:wejscie .3s var(--psy-ease-out-quint) both;padding:32px}
.modal{border-radius:var(--psy-radius-xl);padding:22px}
```

### `.modal--szeroki` ⏳

```css
.modal--szeroki{width:min(760px,100%)}
```

### `.modal-tlo` ⏳

```css
.modal-tlo{z-index:60;background:#1a1a1a73;place-items:center;padding:24px;display:grid;position:fixed;top:0;right:0;bottom:0;left:0;overflow-y:auto}
.modal-tlo{align-items:start;padding:12px}
```

### `.modal__stopka` ⏳

```css
.modal__stopka{flex-wrap:wrap;justify-content:flex-end;gap:12px;margin-top:26px;display:flex}
.modal__stopka{flex-direction:column-reverse}
.modal__stopka>*{width:100%}
```

---

## Link kryzysowy

### `.link-kryzys` ⏳

```css
.link-kryzys{border:1.5px solid var(--np-error);border-radius:var(--np-radius-pill);color:var(--np-error);font-size:14px;font-weight:var(--np-fw-bold);transition:var(--np-transition-fast);white-space:nowrap;align-items:center;gap:8px;padding:8px 14px;line-height:1;text-decoration:none;display:inline-flex}
.link-kryzys:hover{background:var(--np-error);color:#fff}
```

### `.link-kryzys__ikona` ⏳

```css
.link-kryzys__ikona{width:18px;height:18px;font-size:12px;font-weight:var(--np-fw-black);border:1.5px solid;border-radius:50%;place-items:center;display:grid}
```

---

## Pozostałe klasy bez grupy (layout, utility, elementy marketingowe/panelowe bez odpowiednika)

Nieistotne dla stylu komponentów interaktywnych (utility classes typu `flex`/`grid`/
`relative`, lub elementy stron/paneli, których w tej aplikacji jeszcze nie ma: telefon-mockup, 
wykresy, ranking, pasek demo ról, podgląd maila, profil specjalisty, hero sekcja marketingowa). 
Zostawione tu wyłącznie jako surowy zapis źródłowy, gdyby były potrzebne w przyszłości.

<details><summary>Rozwiń pełną listę (155 klas)</summary>

**`.absolute`**
```css
.absolute{position:absolute}
```
**`.anim-wejscie`**
```css
.anim-wejscie{animation:wejscie .5s var(--psy-ease-out-quint) both}
```
**`.awatar`**
```css
.awatar{background:var(--np-primary-light);width:42px;height:42px;color:var(--np-primary);font-weight:var(--np-fw-bold);font-size:var(--np-small);text-transform:uppercase;border-radius:50%;flex:none;place-items:center;display:grid}
```
**`.awatar--duzy`**
```css
.awatar--duzy{width:64px;height:64px;font-size:var(--psy-h4)}
```
**`.awatar--maly`**
```css
.awatar--maly{width:32px;height:32px;font-size:var(--psy-caption)}
```
**`.bez-druku`**
```css
.bez-druku{display:none!important}
```
**`.block`**
```css
.block{display:block}
```
**`.blur`**
```css
.blur{--tw-blur:blur(8px);filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}
```
**`.border`**
```css
.border{border-style:var(--tw-border-style);border-width:1px}
```
**`.border-collapse`**
```css
.border-collapse{border-collapse:collapse}
```
**`.break-all`**
```css
.break-all{word-break:break-all}
```
**`.contents`**
```css
.contents{display:contents}
```
**`.etykieta`**
```css
.etykieta{font-size:var(--psy-small);font-weight:var(--psy-fw-medium);color:var(--psy-text-strong);margin-bottom:6px;display:block}
```
**`.fixed`**
```css
.fixed{position:fixed}
```
**`.flex`**
```css
.flex{display:flex}
```
**`.flex-wrap`**
```css
.flex-wrap{flex-wrap:wrap}
```
**`.grid`**
```css
.grid{display:grid}
```
**`.h1`**
```css
.h1{font-size:var(--np-h1);font-weight:var(--np-fw-bold);line-height:var(--np-lh-tight);color:var(--np-text-strong);text-wrap:balance;margin:0}
```
**`.h2`**
```css
.h2{font-size:var(--np-h2);font-weight:var(--np-fw-bold);color:var(--np-text-strong);text-wrap:balance;margin:0;line-height:1.25}
```
**`.h3`**
```css
.h3{font-size:var(--np-h3);font-weight:var(--np-fw-bold);color:var(--np-text-strong);text-wrap:balance;margin:0;line-height:1.25}
```
**`.h4`**
```css
.h4{font-size:var(--np-h4);font-weight:var(--np-fw-bold);color:var(--np-text-strong);text-wrap:balance;margin:0;line-height:1.3}
```
**`.hero`**
```css
.hero{min-height:calc(100vh - var(--np-header-height) - var(--np-demobar-height) - 60px);align-items:stretch;padding:48px 0;display:flex;position:relative;overflow:hidden}
.hero{min-height:0;padding:32px 0}
```
**`.hero__akcje`**
```css
.hero__akcje{flex-wrap:wrap;align-items:center;gap:16px;margin:auto 0 32px;display:flex}
.hero__akcje{order:3;margin:0}
```
**`.hero__haslo`**
```css
.hero__haslo{color:var(--np-roz-hero);text-transform:uppercase;letter-spacing:-.01em;font-size:90px;font-weight:var(--np-fw-bold);margin:0;line-height:1em}
.hero__haslo strong{font-weight:800}
.hero__haslo{font-size:clamp(38px,11vw,64px)}
```
**`.hero__naglowek`**
```css
.hero__naglowek{color:var(--np-roz-hero);text-transform:uppercase;letter-spacing:.01em;font-size:42px;font-weight:var(--np-fw-regular);margin:0;line-height:1em}
.hero__naglowek{font-size:20px;line-height:1.3}
```
**`.hero__tlo`**
```css
.hero__tlo{z-index:0;position:absolute;top:0;right:0;bottom:0;left:0}
.hero__tlo img{object-fit:cover;object-position:50% 50%;width:100%;height:100%;display:block}
```
**`.hero__tresc`**
```css
.hero__tresc{z-index:1;flex-direction:column;flex:1;gap:24px;width:100%;max-width:720px;display:flex;position:relative}
.hero__tresc{gap:20px}
```
**`.hidden`**
```css
.hidden{display:none}
```
**`.inline`**
```css
.inline{display:inline}
```
**`.inline-flex`**
```css
.inline-flex{display:inline-flex}
```
**`.italic`**
```css
.italic{font-style:italic}
```
**`.jak-rezerwowac`**
```css
.jak-rezerwowac{background:var(--np-bg-warm);border-radius:var(--np-radius-card);margin-top:60px;padding:50px}
.jak-rezerwowac{border-radius:var(--np-radius-xxl);padding:28px 20px}
```
**`.kafel`**
```css
.kafel{background:var(--psy-bg-card);border-radius:var(--psy-radius-lg);box-shadow:var(--psy-shadow-card);padding:20px 22px}
```
**`.kafel__etykieta`**
```css
.kafel__etykieta{font-size:var(--psy-caption);color:var(--psy-text-subtle);text-transform:uppercase;letter-spacing:.04em}
```
**`.kafel__liczba`**
```css
.kafel__liczba{color:var(--psy-text-strong);font-variant-numeric:tabular-nums;margin:8px 0 4px;font-size:30px;font-weight:800;line-height:1.1;display:block}
```
**`.kafel__zmiana`**
```css
.kafel__zmiana{font-size:var(--psy-caption)}
```
**`.kafel__zmiana--neutralna`**
```css
.kafel__zmiana--neutralna{color:var(--psy-text-subtle)}
```
**`.kafel__zmiana--spadek`**
```css
.kafel__zmiana--spadek{color:var(--psy-error)}
```
**`.kafel__zmiana--wzrost`**
```css
.kafel__zmiana--wzrost{color:var(--psy-green)}
```
**`.kafle`**
```css
.kafle{gap:var(--psy-space);grid-template-columns:repeat(auto-fit,minmax(200px,1fr));display:grid}
```
**`.karta-osoby__bio`**
```css
.karta-osoby__bio{color:#666;margin-top:4px;font-size:14px;line-height:1.6}
```
**`.karta-osoby__cena`**
```css
.karta-osoby__cena{color:var(--np-secondary);white-space:nowrap;font-size:16px;font-weight:800}
```
**`.karta-osoby__dostepnosc`**
```css
.karta-osoby__dostepnosc{font-size:var(--np-caption);color:var(--np-text-quiet);white-space:nowrap}
.karta-osoby__dostepnosc strong{color:var(--np-granat);font-weight:var(--np-fw-semibold)}
```
**`.karta-osoby__forma`**
```css
.karta-osoby__forma{font-size:var(--np-caption);font-weight:var(--np-fw-semibold);color:var(--np-text-muted);flex-wrap:wrap;justify-content:flex-end;gap:8px;display:flex}
.karta-osoby__forma{justify-content:flex-start}
```
**`.karta-osoby__foto`**
```css
.karta-osoby__foto{background:#f9f9f9;border-right:1px solid #f0f0f0;flex:0 0 300px;align-self:stretch}
.karta-osoby__foto{border-bottom:1px solid #f0f0f0;border-right:none;flex:none}
```
**`.karta-osoby__glowne`**
```css
.karta-osoby__glowne{flex-direction:column;grid-area:2/1;gap:10px;display:flex}
```
**`.karta-osoby__meta`**
```css
.karta-osoby__meta{text-align:right;flex-direction:column;grid-area:2/2;align-items:flex-end;gap:8px;display:flex}
.karta-osoby__meta{text-align:left;grid-area:auto;align-items:flex-start}
```
**`.karta-osoby__nazwa`**
```css
.karta-osoby__nazwa{text-transform:uppercase;color:var(--np-secondary);grid-area:1/1/auto/-1;margin:0;font-size:28px;font-weight:800;line-height:1.15}
.karta-osoby__nazwa{font-size:22px}
```
**`.karta-osoby__tresc`**
```css
.karta-osoby__tresc{flex:1;grid-template-rows:auto 1fr;grid-template-columns:1fr 240px;align-items:start;gap:16px 24px;padding:32px 36px;display:grid}
.karta-osoby__tresc{grid-template-columns:1fr;padding:24px 20px}
```
**`.karta-osoby__zastepnik`**
```css
.karta-osoby__zastepnik{background:var(--np-primary-light);width:100%;height:100%;min-height:240px;color:var(--np-primary);font-size:48px;font-weight:var(--np-fw-bold);text-transform:uppercase;justify-content:center;align-items:center;display:flex}
.karta-osoby__zastepnik{min-height:180px}
```
**`.kontener`**
```css
.kontener{max-width:var(--psy-container);margin:0 auto;padding-inline:24px}
```
**`.krok-numer`**
```css
.krok-numer{background:var(--np-primary);color:#fff;min-width:40px;height:40px;font-size:var(--np-h4);font-weight:var(--np-fw-bold);border-radius:50%;flex-shrink:0;justify-content:center;align-items:center;display:flex}
```
**`.krok-pozycja`**
```css
.krok-pozycja{align-items:flex-start;gap:16px;display:flex}
```
**`.krok-tresc`**
```css
.krok-tresc{font-size:var(--np-body);padding-top:8px;line-height:1.5}
```
**`.kroki-lista`**
```css
.kroki-lista{flex-direction:column;gap:20px;margin-top:30px;display:flex}
```
**`.legenda`**
```css
.legenda{font-size:var(--psy-caption);color:var(--psy-text-muted);flex-wrap:wrap;gap:18px;display:flex}
.legenda span{align-items:center;gap:7px;display:inline-flex}
.legenda i{border-radius:3px;width:11px;height:11px;display:inline-block}
```
**`.liczby`**
```css
.liczby{font-variant-numeric:tabular-nums}
```
**`.lista-kart`**
```css
.lista-kart{flex-direction:column;gap:35px;display:flex}
```
**`.lista-podsumowania`**
```css
.lista-podsumowania>div{border-bottom:1px solid var(--psy-border-warm);font-size:var(--psy-small);justify-content:space-between;gap:16px;padding:11px 0;display:flex}
.lista-podsumowania>div:last-child{border-bottom:none}
.lista-podsumowania dt{color:var(--psy-text-subtle)}
.lista-podsumowania dd{text-align:right;color:var(--psy-text-strong);font-weight:var(--psy-fw-medium);margin:0}
.lista-podsumowania .suma{font-size:var(--psy-body);font-weight:var(--psy-fw-bold)}
```
**`.lista-zakres`**
```css
.lista-zakres{margin:8px 0 0;padding-left:20px}
.lista-zakres li{font-size:var(--np-small);color:var(--np-text);margin-bottom:4px;line-height:1.6}
.lista-zakres li::marker{color:var(--np-primary)}
```
**`.listing-filtry`**
```css
.listing-filtry{z-index:10;border:1px solid var(--np-border);background:#fff;border-radius:35px;margin-bottom:48px;padding:25px;position:relative;box-shadow:0 25px 60px #0000000f}
.listing-filtry{border-radius:var(--np-radius-xxl);margin-bottom:32px;padding:20px}
```
**`.listing-sekcja`**
```css
.listing-sekcja{background:var(--np-bg-page);padding:56px 0 80px}
```
**`.listing-szukajka`**
```css
.listing-szukajka{box-sizing:border-box;border:1px solid var(--np-bg-grey-mid);border-radius:var(--np-radius-medium);width:100%;height:50px;font-family:var(--np-font);font-size:var(--np-small);padding:0 20px}
.listing-szukajka:focus{border-color:var(--np-primary);box-shadow:var(--np-focus-ring);outline:none}
```
**`.naglowek-flex`**
```css
.naglowek-flex{align-items:center;gap:24px;display:flex}
```
**`.naglowek-logo`**
```css
.naglowek-logo img{width:180px;height:auto;display:block}
```
**`.naglowek-strony`**
```css
.naglowek-strony{top:var(--np-demobar-height);z-index:40;width:100%;box-shadow:var(--np-shadow-header);background:#fff;padding:15px 0;position:sticky}
```
**`.notka`**
```css
.notka{border:1px dashed var(--psy-violet);border-radius:var(--psy-radius-sm);background:var(--psy-violet-06);font-size:var(--psy-caption);color:var(--psy-text-muted);gap:10px;padding:12px 16px;line-height:1.55;display:flex}
.notka b{color:var(--psy-violet)}
```
**`.osoba`**
```css
.osoba{align-items:center;gap:12px;min-width:0;display:flex}
```
**`.outline`**
```css
.outline{outline-style:var(--tw-outline-style);outline-width:1px}
```
**`.pasek`**
```css
.pasek{background:var(--psy-bg-grey);border-radius:999px;width:100%;height:8px;overflow:hidden}
.pasek>span{background:var(--psy-green);height:100%;transition:width .6s var(--psy-ease-out-quint);border-radius:999px;display:block}
```
**`.pasek-demo`**
```css
.pasek-demo{z-index:180;border-radius:var(--np-radius-large);background:#fff;width:min(94vw,330px);position:fixed;bottom:20px;right:20px;overflow:hidden;box-shadow:0 12px 40px #0000002e}
.pasek-demo{width:auto;bottom:12px;left:12px;right:12px}
```
**`.pasek-demo__naglowek`**
```css
.pasek-demo__naglowek{text-transform:uppercase;letter-spacing:.04em;color:var(--np-text-subtle);margin:0 0 8px;font-size:12px}
```
**`.pasek-demo__persona`**
```css
.pasek-demo__persona{border-radius:var(--np-radius-xs);background:var(--np-bg-page);color:var(--np-text);font-family:var(--np-font);text-align:left;cursor:pointer;transition:var(--np-transition-fast);border:none;flex-direction:column;gap:2px;padding:9px 12px;display:flex}
.pasek-demo__persona:hover{background:var(--np-primary-10)}
```
**`.pasek-demo__persona--aktywna`**
```css
.pasek-demo__persona--aktywna{background:var(--np-primary);color:#fff}
.pasek-demo__persona--aktywna:hover{background:var(--np-primary)}
```
**`.pasek-demo__persona-nazwa`**
```css
.pasek-demo__persona-nazwa{font-size:13px;font-weight:var(--np-fw-medium)}
```
**`.pasek-demo__persona-opis`**
```css
.pasek-demo__persona-opis{opacity:.75;font-size:11px}
```
**`.pasek-demo__podpowiedz`**
```css
.pasek-demo__podpowiedz{color:var(--np-text-subtle);margin:8px 0 0;font-size:11px;line-height:1.5}
```
**`.pasek-demo__siatka`**
```css
.pasek-demo__siatka{grid-template-columns:1fr 1fr;gap:6px;display:grid}
```
**`.pasek-demo__skrot`**
```css
.pasek-demo__skrot{border:1px solid var(--np-border);border-radius:var(--np-radius-pill);color:var(--np-text-muted);font-family:var(--np-font);font-size:13px;font-weight:var(--np-fw-medium);cursor:pointer;transition:var(--np-transition-fast);text-align:left;background:#fff;align-items:center;gap:8px;padding:9px 14px;display:inline-flex}
.pasek-demo__skrot:hover:not(:disabled){background:var(--np-bg-page);color:var(--np-granat)}
.pasek-demo__skrot:disabled{opacity:.45;cursor:not-allowed}
```
**`.pasek-demo__skrot--reset`**
```css
.pasek-demo__skrot--reset{color:var(--np-error);border-color:var(--np-error-border)}
.pasek-demo__skrot--reset:hover{background:var(--np-error-bg);color:var(--np-error)}
```
**`.pasek-demo__tresc`**
```css
.pasek-demo__tresc{flex-direction:column;gap:16px;max-height:min(70vh,620px);padding:16px;display:flex;overflow-y:auto}
```
**`.pasek-demo__uchwyt`**
```css
.pasek-demo__uchwyt{color:#fff;width:100%;font-family:var(--np-font);font-size:14px;font-weight:var(--np-fw-medium);cursor:pointer;background:#1a1a1a;border:none;align-items:center;gap:10px;padding:12px 16px;display:flex}
```
**`.pasek-demo__znacznik`**
```css
.pasek-demo__znacznik{background:var(--np-primary);color:#fff;font-size:11px;font-weight:var(--np-fw-bold);white-space:nowrap;border-radius:999px;padding:2px 10px}
```
**`.pasek-misji`**
```css
.pasek-misji{background:var(--np-roz-pasek);color:var(--np-secondary);padding:15px 0}
```
**`.pasek-misji__srodek`**
```css
.pasek-misji__srodek{flex-wrap:nowrap;align-items:center;gap:30px;display:flex}
.pasek-misji__srodek{flex-wrap:wrap;gap:14px}
```
**`.pasek-misji__tekst`**
```css
.pasek-misji__tekst{font-size:var(--np-body);font-weight:var(--np-fw-regular);text-transform:uppercase;color:var(--np-text);flex:1;margin:0;line-height:1.3}
.pasek-misji__tekst{font-size:var(--np-small);flex:100%}
```
**`.pasek-misji__wsparcie`**
```css
.pasek-misji__wsparcie{align-items:center;gap:16px;display:flex}
.pasek-misji__wsparcie h2{font-size:var(--np-body);font-weight:var(--np-fw-bold);text-transform:uppercase;color:var(--np-secondary);white-space:nowrap;margin:0}
```
**`.pasek-trybu__kropka`**
```css
.pasek-trybu__kropka{background:#fff;border-radius:50%;flex-shrink:0;width:9px;height:9px}
```
**`.pasek-trybu__napis`**
```css
.pasek-trybu__napis{letter-spacing:.09em;text-transform:uppercase;font-size:14px;font-weight:800}
```
**`.pasek-trybu__opis`**
```css
.pasek-trybu__opis{font-size:var(--np-small);opacity:.85}
```
**`.pasek-trybu__srodek`**
```css
.pasek-trybu__srodek{max-width:var(--np-container);flex-wrap:wrap;align-items:center;gap:14px;margin-inline:auto;display:flex}
```
**`.pasek-trybu__wyjscie`**
```css
.pasek-trybu__wyjscie{cursor:pointer;border-radius:var(--np-radius-pill);color:#fff;font-family:var(--np-font);font-size:var(--np-small);background:#ffffff2e;border:1px solid #ffffff73;margin-left:auto;padding:6px 16px;font-weight:500;transition:background .18s}
.pasek-trybu__wyjscie:hover{background:#ffffff4d}
```
**`.podglad-maila`**
```css
.podglad-maila{border:1px solid var(--np-border);border-radius:var(--np-radius-md);overflow:hidden}
```
**`.podglad-maila__naglowek`**
```css
.podglad-maila__naglowek{background:var(--np-bg-grey);border-bottom:1px solid var(--np-border);color:var(--np-text-muted);align-items:center;gap:12px;padding:14px 16px;display:flex}
```
**`.podglad-maila__temat`**
```css
.podglad-maila__temat{font-size:var(--np-small);color:var(--np-granat);text-overflow:ellipsis;white-space:nowrap;font-weight:600;overflow:hidden}
```
**`.podglad-maila__tresc`**
```css
.podglad-maila__tresc{max-height:460px;font-family:var(--np-font);color:var(--np-text);white-space:pre-wrap;word-break:break-word;margin:0;padding:18px 20px;font-size:14px;line-height:1.65;overflow-y:auto}
```
**`.podpis`**
```css
.podpis{font-size:var(--np-caption);text-transform:uppercase;letter-spacing:.04em;color:var(--np-text-subtle);margin:0}
```
**`.profil-cena`**
```css
.profil-cena{font-size:20px;font-weight:var(--np-fw-bold);color:var(--np-secondary)}
```
**`.profil-meta`**
```css
.profil-meta{text-align:right;flex-direction:column;align-items:flex-end;gap:10px;display:flex;position:absolute;top:80px;right:80px}
.profil-meta{text-align:left;align-items:flex-start;position:static}
```
**`.profil-naglowek`**
```css
.profil-naglowek{gap:50px;margin-bottom:60px;display:flex}
.profil-naglowek{flex-direction:column;align-items:stretch;gap:24px}
```
**`.profil-nazwa`**
```css
.profil-nazwa{font-size:42px;font-weight:var(--np-fw-medium);color:var(--np-granat);margin:0 0 15px;line-height:1.15}
.profil-nazwa{font-size:32px}
```
**`.profil-sekcja`**
```css
.profil-sekcja h3{font-size:var(--np-h4);font-weight:var(--np-fw-bold);color:var(--np-secondary);margin:30px 0 20px}
```
**`.profil-termin`**
```css
.profil-termin{font-size:var(--np-caption);color:var(--np-text-quiet)}
.profil-termin strong{color:var(--np-granat);font-weight:var(--np-fw-semibold)}
```
**`.profil-zdjecie`**
```css
.profil-zdjecie{border-radius:var(--np-radius-photo);flex-shrink:0;width:300px;height:300px;overflow:hidden}
.profil-zdjecie{aspect-ratio:1;width:100%;max-width:420px;height:auto}
```
**`.profil-zdjecie--zastepnik`**
```css
.profil-zdjecie--zastepnik{background:var(--np-primary-light);color:var(--np-primary);font-size:56px;font-weight:var(--np-fw-bold);text-transform:uppercase;justify-content:center;align-items:center;display:flex}
.profil-zdjecie--zastepnik{aspect-ratio:1}
```
**`.proporcje`**
```css
.proporcje{gap:2px;height:12px;display:flex}
.proporcje>i{border-radius:3px;height:100%;display:block}
```
**`.pusty-stan`**
```css
.pusty-stan{text-align:center;color:var(--psy-text-subtle);place-items:center;gap:10px;padding:48px 24px;display:grid}
```
**`.ranking`**
```css
.ranking{flex-direction:column;gap:14px;display:flex}
```
**`.ranking__tor`**
```css
.ranking__tor{background:var(--psy-bg-grey);border-radius:4px;height:20px;overflow:hidden}
.ranking__tor>span{background:var(--psy-violet);border-radius:4px;height:100%;display:block}
```
**`.ranking__wiersz`**
```css
.ranking__wiersz{grid-template-columns:180px minmax(0,1fr) 96px;align-items:center;gap:14px;display:grid}
.ranking__wiersz{grid-template-columns:1fr 76px}
.ranking__wiersz>:first-child{grid-column:1/-1}
```
**`.relative`**
```css
.relative{position:relative}
```
**`.resize`**
```css
.resize{resize:both}
```
**`.rosnij`**
```css
.rosnij{flex:1;min-width:0}
```
**`.rozdzielacz`**
```css
.rozdzielacz{background:var(--psy-border);border:none;height:1px;margin:0}
```
**`.rzad`**
```css
.rzad{flex-wrap:wrap;align-items:center;gap:12px;display:flex}
```
**`.rzad--rozsuniety`**
```css
.rzad--rozsuniety{justify-content:space-between;align-items:flex-start}
```
**`.siatka`**
```css
.siatka{gap:20px;display:grid}
```
**`.siatka--2`**
```css
.siatka--2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
```
**`.siatka--3`**
```css
.siatka--3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
```
**`.siatka--boczna`**
```css
.siatka--boczna{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:start}
.siatka--boczna{grid-template-columns:1fr}
```
**`.slupek`**
```css
.slupek{flex-direction:column;flex:1;justify-content:flex-end;min-width:8px;height:100%;display:flex;position:relative}
.slupek:hover .slupek__wartosc{filter:brightness(1.08)}
.slupek[data-tip]:after{content:attr(data-tip);z-index:5;border-radius:var(--psy-radius-xs);background:var(--psy-text-strong);color:#fff;font-size:var(--psy-caption);white-space:pre;opacity:0;pointer-events:none;transition:opacity var(--psy-transition-fast);padding:8px 12px;line-height:1.4;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translate(-50%)}
.slupek[data-tip]:hover:after{opacity:1}
```
**`.slupek__etykieta`**
```css
.slupek__etykieta{text-align:center;font-size:var(--psy-caption);color:var(--psy-text-subtle);white-space:nowrap;position:absolute;bottom:-22px;left:0;right:0}
```
**`.slupek__stos`**
```css
.slupek__stos{flex-direction:column;justify-content:flex-end;gap:2px;height:100%;display:flex}
```
**`.slupek__wartosc`**
```css
.slupek__wartosc{background:var(--np-secondary-jasny);transition:height .6s var(--np-ease-out-quint);border-radius:4px 4px 0 0}
.slupek:hover .slupek__wartosc{filter:brightness(1.08)}
```
**`.slupek__wartosc--druga`**
```css
.slupek__wartosc--druga{background:var(--np-info);border-radius:0 0 4px 4px}
```
**`.static`**
```css
.static{position:static}
```
**`.sticky`**
```css
.sticky{position:sticky}
```
**`.stos`**
```css
.stos{flex-direction:column;gap:20px;display:flex}
```
**`.suma`**
```css
.lista-podsumowania .suma{font-size:var(--psy-body);font-weight:var(--psy-fw-bold)}
```
**`.table`**
```css
.table{display:table}
```
**`.tekst-przygaszony`**
```css
.tekst-przygaszony{color:var(--np-text-muted)}
```
**`.tekst-subtelny`**
```css
.tekst-subtelny{color:var(--np-text-quiet);font-size:var(--np-caption)}
```
**`.telefon`**
```css
.telefon{background:var(--np-bg-page);border:8px solid var(--np-granat);border-radius:26px;max-width:320px;margin-inline:auto;overflow:hidden}
```
**`.telefon__czas`**
```css
.telefon__czas{opacity:.7;margin-left:auto;font-weight:400}
```
**`.telefon__dymek`**
```css
.telefon__dymek{box-shadow:var(--np-shadow-card-small);color:var(--np-text);word-break:break-word;background:#fff;border-radius:16px 16px 16px 4px;padding:12px 14px;font-size:14px;line-height:1.5}
```
**`.telefon__ekran`**
```css
.telefon__ekran{padding:16px 14px 18px}
```
**`.telefon__pasek`**
```css
.telefon__pasek{background:var(--np-granat);color:#fff;align-items:center;gap:7px;padding:9px 14px;font-size:12px;font-weight:600;display:flex}
```
**`.telefon__stopka`**
```css
.telefon__stopka{color:var(--np-text-quiet);margin-top:8px;font-size:11px}
```
**`.transform`**
```css
.transform{transform:var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)}
```
**`.transition`**
```css
.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}
```
**`.tryb-platnosci`**
```css
.tryb-platnosci{background:var(--np-bg-grey);border-radius:var(--np-radius-pill);flex-shrink:0;padding:4px;display:inline-flex}
.tryb-platnosci button{cursor:pointer;font-family:var(--np-font);font-size:var(--np-small);color:var(--np-text-muted);border-radius:var(--np-radius-pill);background:0 0;border:0;align-items:center;gap:7px;padding:7px 15px;font-weight:500;transition:background .18s,color .18s;display:inline-flex}
.tryb-platnosci button i{border-radius:50%;flex-shrink:0;width:9px;height:9px}
.tryb-platnosci button:hover{color:var(--np-granat)}
.tryb-platnosci button[aria-pressed=true]{color:var(--np-granat);box-shadow:var(--np-shadow-card-small);background:#fff}
```
**`.tryb-wizyty`**
```css
.tryb-wizyty{border-radius:var(--np-radius-pill);font-size:14px;font-weight:var(--np-fw-semibold);white-space:nowrap;align-items:center;gap:6px;padding:6px 14px;line-height:1;display:inline-flex}
```
**`.tryb-wizyty--online`**
```css
.tryb-wizyty--online{color:var(--np-secondary);background:var(--np-secondary-light)}
```
**`.tryb-wizyty--stacjonarnie`**
```css
.tryb-wizyty--stacjonarnie{color:var(--np-zielen-ciemna);background:var(--np-primary-light)}
```
**`.typ-kropka`**
```css
.typ-kropka{font-size:var(--np-small);color:var(--np-text-muted);white-space:nowrap;align-items:center;gap:7px;display:inline-flex}
.typ-kropka i{border-radius:50%;flex-shrink:0;width:9px;height:9px}
```
**`.typ-pasek`**
```css
.typ-pasek{border-radius:999px;gap:2px;width:100%;display:flex;overflow:hidden}
.typ-pasek>span{transition:width .5s var(--psy-ease-out-quint);display:block}
.typ-pasek>span:first-child{border-radius:999px 0 0 999px}
.typ-pasek>span:last-child{border-radius:0 999px 999px 0}
```
**`.uppercase`**
```css
.uppercase{text-transform:uppercase}
```
**`.uwaga-zakres`**
```css
.uwaga-zakres{border-radius:var(--np-radius-sm);background:var(--np-warning-light,#fff8e6);color:var(--np-warning-text,#6b5300);font-size:var(--np-small);margin-top:8px;padding:8px 12px}
```
**`.visible`**
```css
.visible{visibility:visible}
```
**`.wykres`**
```css
.wykres{grid-template-columns:44px 1fr;gap:12px;display:grid}
```
**`.wykres__os`**
```css
.wykres__os{font-size:var(--psy-caption);color:var(--psy-text-subtle);font-variant-numeric:tabular-nums;flex-direction:column;justify-content:space-between;align-items:flex-end;padding-bottom:24px;display:flex}
```
**`.wykres__pole`**
```css
.wykres__pole{border-bottom:1px solid var(--psy-border);align-items:flex-end;gap:6px;height:200px;padding-bottom:24px;display:flex;position:relative}
.wykres__pole:before,.wykres__pole:after{content:"";border-top:1px dashed var(--psy-border);position:absolute;left:0;right:0}
.wykres__pole:before{top:0}
.wykres__pole:after{top:50%}
```
**`.wyroznik`**
```css
.wyroznik{color:var(--np-primary);font-weight:800}
```
**`.zadanie-zakres`**
```css
.zadanie-zakres{border-left:2px solid var(--np-border);padding-left:14px}
```
**`.znak-dobrostan`**
```css
.znak-dobrostan img{width:auto;height:34px;display:block}
```
</details>
