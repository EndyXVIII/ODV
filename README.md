# ODV RIO-SAONARA · Neon Arena

Sito one-page della Serie C Regionale Femminile di **Officina del Volley** (Padova), stagione 2026/27.
HTML + CSS + JavaScript puri, nessun build step. Animazioni con GSAP 3 (ScrollTrigger, Flip), smooth scroll con Lenis, pallone 3D con Three.js (fallback SVG automatico se WebGL non è disponibile).

## Avvio in locale

Il sito carica i dati da `/data/*.json` con `fetch`, quindi va aperto tramite un server statico (non con doppio clic su `index.html`).

```bash
cd ODV
python3 -m http.server 8080
```

Poi apri <http://localhost:8080>. In alternativa va bene qualsiasi server statico (`npx serve`, l'estensione Live Server di VS Code, ecc.).

## Struttura

```
index.html          markup di tutte le sezioni + sprite SVG (icone, pallone, silhouette)
css/style.css       stili, organizzati per sezione (indice in testa al file)
js/main.js          logica e animazioni, organizzate per sezione (indice in testa al file)
js/pov.js           scena 3D "POV: sei il pallone"
css/fonts.css       font in locale (assets/fonts/)
vendor/             GSAP, ScrollTrigger, Flip, Lenis e Three.js in locale
data/team.json      squadra, staff, giocatrici, rotazione
data/matches.json   calendario e risultati (da FIPAV)
data/standings.json classifica (da FIPAV)
data/instagram.json foto e link della griglia Instagram
tools/aggiorna_fipav.py  aggiorna la copia di riserva dei dati FIPAV
js/fipav.js         lettura in diretta di FIPAV Veneto dal browser
assets/
  logo-officina-del-volley-bianco.png  logo ufficiale (originale)
  logo-odv.webp                        logo ottimizzato usato nel sito
  players/    foto delle giocatrici (dal sito del club)
  staff/      foto dello staff (dal sito del club)
  instagram/  foto dei post Instagram (elencate in data/instagram.json)
  sponsors/   loghi sponsor (ora segnaposto sponsor-1…6.svg)
```

## Risultati e calendario sempre aggiornati (in diretta da FIPAV)

Il sito legge **FIPAV Veneto direttamente dal browser a ogni visita** (FIPAV lo permette: risponde con `Access-Control-Allow-Origin: *`), con `js/fipav.js`:
- aggiunge risultato e parziali delle partite appena giocate;
- ricontrolla data, ora e campo delle prossime 4 partite, per prendere anticipi e spostamenti;
- trova da solo le nuove fasi della **Coppa Veneto femminile** (Quarti, Semifinali, Finale…) se ODV è in tabellone;
- aggiorna la classifica di Serie C – Girone B.

In alto nella sezione Partite compare "Dati in diretta da FIPAV Veneto · aggiornati alle …". Il risultato resta in cache nel browser per 15 minuti. Se FIPAV non risponde entro 7 secondi il sito usa i file salvati `data/matches.json` e `data/standings.json` e lo scrive ("Dati FIPAV salvati").

Countdown, prossima partita, **ultima partita giocata con il punteggio** (nel riquadro dell'hero), locandine, tabellone e contatori si calcolano da questi dati. Nessuno deve aggiornarli a mano.

### Copia di riserva dei dati
Ogni tanto conviene aggiornare anche i file salvati, che fanno da riserva e contengono gli ID FIPAV delle gare:

```bash
python3 tools/aggiorna_fipav.py
```

Lo script riscrive `data/matches.json` e `data/standings.json` e mantiene il tema di ogni locandina. Gli ID del campionato di Serie C e del girone di Coppa sono in cima a `tools/aggiorna_fipav.py`. Le fasi a eliminazione della Coppa le trova da solo.

### Campionato e Coppa Veneto
La striscia delle locandine scorre in orizzontale in modo nativo: con il dito su telefono, con le frecce, la tastiera o trascinando col mouse su computer. Non blocca mai lo scroll della pagina. Le locandine di **campionato** hanno nastro e bordo magenta ("Campionato · Serie C"), quelle di **Coppa Veneto** nastro e bordo oro ("🏆 Coppa Veneto"). Gli stessi colori compaiono nel countdown, nell'ultima partita e nel tabellone. I pulsanti "Tutte / Campionato / Coppa Veneto" filtrano le locandine. Si vedono tutte le partite giocate più le prossime 4 di ogni competizione.

## Aggiornare i dati a mano (senza toccare il codice)

### `data/matches.json`
Ogni partita:

| campo | significato |
|---|---|
| `competizione` | `"Serie C"` o `"Coppa Veneto"` |
| `turno` | es. `"Andata – II giornata"` |
| `data` | data e ora locali, formato `"2026-11-07T21:00"` |
| `avversario`, `luogo` | testo libero |
| `casa` | `true` in casa, `false` in trasferta |
| `risultato` | `null` finché non si gioca, poi **set ODV–set avversarie**, es. `"3-1"` |
| `parziali` | punteggi dei set, sempre ODV per prima, es. `["25-20", "23-25", "25-18", "25-21"]` |
| `tema` | stile della locandina: `noir-agents`, `vintage-bw`, `western`, `abbey-road`, `80s-rock`, `gothic` |
| `segnaposto` | opzionale: `true` mostra il badge "Da confermare" |

- Il countdown dell'hero punta automaticamente alla prima partita futura, che riceve anche il badge pulsante **PROSSIMA**.
- Le partite passate mostrano il timbro col risultato (o "GIOCATA · risultato in arrivo" se `risultato` è `null`).
- Il tabellone in "Risultati" mostra l'ultima partita con risultato inserito.
- Nelle locandine compaiono tutte le partite giocate più le prossime 5; il calendario completo resta su FIPAV.

### `data/standings.json`
`{"nota": "...", "squadre": [ {"squadra", "pt", "g", "v", "p", "sv", "sp"} ]}`. L'ordine viene calcolato in automatico (punti, vittorie, quoziente set). La riga che contiene "Rio-Saonara" si illumina di magenta.

### `data/team.json`
- `giocatrici`: `nome`, `ruolo` (`Palleggiatrice`, `Opposto`, `Schiacciatrice`, `Centrale`, `Libero`) e `superpotere` (frase della card: **segnaposto**, da personalizzare con la squadra).
- `capitano: true` su una giocatrice (ora **Sandy Marini**): badge "C" sulla card e nel widget Rotazione, dicitura "Capitana" e, se c'è, il campo `dedica` (la frase romantica) al posto del superpotere nel pannello della card e sotto il superpotere nella scheda a schermo intero. La capitana è sempre fra le sei in campo nella Rotazione: se non è in `rotazione`, prende il posto di una compagna del suo ruolo.
- `grido` (facoltativo, per la capitana): il suo urlo di battaglia, ora "ANDIAMOO!!!!!!!!". Compare sulla card, in grande nella scheda a schermo intero e nella scena 3D; `dedica` è la frase che lo introduce.
- `staff`: `ruolo`, `nome`, `superpotere`. Anche le card dello staff si aprono a schermo intero, con le frecce per passare da una persona all'altra.
- `rotazione`: le 6 giocatrici in campo in ordine P1→P6 per il widget "Rotazione"; `liberoInCampo`: il libero mostrato sotto.
- `indirizzo`: indirizzo del Palasalmaso mostrato nella sezione Palasport.

Nessun numero di maglia viene mostrato sul sito.

## Dove mettere le immagini

### Foto delle giocatrici
Le foto attuali sono i ritratti scontornati (sfondo trasparente) pubblicati sulla pagina [Serie C Regionale](https://officinadelvolley-padova.com/serie-c-regionale/) del sito del club, ritagliati tutti alla stessa scala. Per sostituirle (per esempio con gli artwork dei post Instagram) usa `assets/players/<cognome>.webp`: cognome in minuscolo, senza accenti, spazi sostituiti da trattini.

| giocatrice | file |
|---|---|
| Laura Miazzi | `miazzi.webp` |
| Alessia Lorenzi | `lorenzi.webp` |
| Mame Coumba Seck | `seck.webp` |
| Elisa Vanzato | `vanzato.webp` |
| Virginia Zangrossi | `zangrossi.webp` |
| Elisa Benetazzo | `benetazzo.webp` |
| Beatrice Marcato | `marcato.webp` |
| Arianna Ponchio | `ponchio.webp` |
| Sandy Marini | `marini.webp` |
| Emily Fassina | `fassina.webp` |
| Sara Vio | `vio.webp` |
| Martina Erba | `erba.webp` |
| Aurora Viganò | `vigano.webp` |
| Ilenia Quiriti | `quiriti.webp` |
| Lisa Pierangelo | `pierangelo.webp` |

Formato consigliato: **4:5 verticale, 800×1000 px**, WebP qualità ~80, soggetto centrato con la testa nel terzo superiore. Le immagini con sfondo trasparente rendono meglio: dietro la giocatrice resta visibile l'icona del ruolo. Se un file manca, la card mostra una silhouette neon nel colore del ruolo.

Staff: stesso schema in `assets/staff/` (`cavinato.webp`, `vittadello.webp`, `sampieri.webp`; manca ancora `lorenzi.webp` della team manager Giorgia Lorenzi, che non ha una foto sul sito del club).

Conversione rapida da JPG/PNG:
```bash
cwebp -q 80 -resize 800 1000 foto.jpg -o assets/players/miazzi.webp
```

### Instagram
`data/instagram.json` elenca le tile della griglia: `{"immagine": "ig-1.webp", "post": "https://www.instagram.com/p/…/"}`. Ogni tile apre il proprio post. Le immagini stanno in `assets/instagram/`: ora ci sono gli ultimi 9 post pubblici di @officinadip (aggiornati al 4 novembre 2026). Per aggiornarle salva le nuove foto (formato 4:5), convertile in WebP e aggiorna il JSON:
```bash
cwebp -q 80 foto.jpg -o assets/instagram/ig-1.webp
```

### Sponsor
Sostituisci `assets/sponsors/sponsor-1.svg` … `sponsor-6.svg` (SVG o PNG trasparente, proporzione circa 2:1). Per cambiarne il numero modifica `initPartners()` in `js/main.js`.

## "POV: sei il pallone" (scena 3D durante lo scroll)
Subito dopo l'hero c'è una sezione 3D (Three.js, in `js/pov.js`) in cui la camera **è il pallone**: scorrendo si vive un'intera azione di set point sul 24–23. Si parte dalla battuta in salto di ODV, si passa a filo del nastro, poi arrivano la ricezione e l'attacco avversario. Il **muro** ODV riempie lo schermo di mani, poi c'è la vista dall'alto, l'alzata, la **schiacciata** e l'impatto a terra con "PUNTO!" e tabellone che va 25–23. HUD da diretta TV con km/h, linee di velocità e scosse sui colpi.
Le giocatrici ODV in campo sono le loro card (foto, riquadro nel colore del ruolo, nome e frase). Il sestetto viene da `rotazione` in `team.json`: la **capitana (Sandy Marini)** è sempre la schiacciatrice, con badge "C" e la sua `dedica`, una palleggiatrice alza, due centrali murano, poi ci sono le altre e il libero. Le avversarie restano sagome neon azzurre.
Funziona anche su mobile (campo visivo più ampio in verticale) e in entrambi i sensi di scroll. C'è il link "Salta l'azione". Con `prefers-reduced-motion` mostra un fotogramma fisso; senza WebGL la sezione si nasconde.
Il percorso del pallone si modifica in `KEYS` (posizione e punto guardato per ogni momento), i colpi in `HITS`, le didascalie in `ACTS` e `CALLS`.

## Privacy, prestazioni e accessibilità
- **Niente servizi esterni al caricamento:** font e librerie sono nel progetto (`assets/fonts/`, `vendor/`), quindi niente Google Fonts né CDN. I soli collegamenti esterni sono a FIPAV Veneto, per i risultati in diretta.
- **Mappa su richiesta:** la mappa OpenStreetMap si carica solo quando il visitatore preme "Mostra la mappa".
- **Cookie:** il sito non usa cookie di profilazione né statistiche. `localStorage` conserva solo preferenze tecniche (tema, cache FIPAV), quindi non serve un banner cookie. Se in futuro aggiungi statistiche o altri incorporamenti, servirà un banner di consenso.
- **Modulo contatti:** ha la casella obbligatoria di consenso all'informativa privacy (link iubenda) e la validazione dei campi. L'invio apre il programma di posta (`mailto:`). Per un invio diretto serve un servizio di form lato server.
- **Accessibilità:** bersagli touch da almeno 44 px, focus visibile, testi alternativi, scheda a schermo intero con trappola del focus ed Esc, supporto a `prefers-reduced-motion`.
- **Prestazioni su mobile:** niente sfocature costose durante lo scroll. Animazioni, canvas e scena 3D si fermano quando sono fuori schermo.
- **Motori di ricerca:** nel `<head>` ci sono i dati strutturati schema.org (`SportsTeam`).

## Interazioni nascoste
- Digita **A C E** (fuori dai campi del form) per una pioggia di palloni e l'insegna "ACE!".
- Il pulsante **Luci del palazzetto** in alto a destra passa alla modalità giorno (la scelta viene ricordata).
- Il loader resta finché il sito non è completo (scena 3D con le foto delle card, dati FIPAV, contenuti) e il tabellone segue l'avanzamento reale. FIPAV viene atteso al massimo 3,5 secondi, poi si usano i dati salvati; per sicurezza il loader si chiude comunque dopo 15 secondi. I tempi si vedono in DevTools → Performance (segni `odv:pov-pronta`, `odv:contenuti-pronti`, `odv:sito-visibile`).

## Accessibilità e performance
- `prefers-reduced-motion`: niente loader, smooth scroll, parallax, pioggia né scroll orizzontale fissato; tutto il contenuto resta visibile.
- Animazioni su `transform`/`opacity`; canvas e WebGL si mettono in pausa fuori schermo o con la scheda nascosta.
- Immagini in lazy-load, testo alternativo ovunque, focus visibile, modal con trappola del focus ed Esc per chiudere.

## Da completare
- Posizione precisa del Palasalmaso sulla mappa: il segnaposto dell'iframe OpenStreetMap in `index.html` (parametro `marker`) è al centro di Villatora, perché Via XI Febbraio non compare nella ricerca di OpenStreetMap. Il pulsante "Come arrivare" apre già Google Maps sull'indirizzo completo.
- Foto della team manager e frasi "superpotere" (ora segnaposto) in `team.json`.
- Loghi delle avversarie (ora iniziali dentro un cerchio) e loghi sponsor.
