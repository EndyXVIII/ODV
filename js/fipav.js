/* =========================================================
   ODV RIO-SAONARA · aggiornamento LIVE da FIPAV Veneto
   FIPAV risponde con "Access-Control-Allow-Origin: *", quindi il sito
   legge i dati direttamente dal browser a ogni visita, senza server.
   Parte da data/matches.json (calendario con gli ID FIPAV) e lo aggiorna:
     · risultati e parziali delle partite appena giocate
     · data, ora e campo delle prossime partite (anticipi e spostamenti)
     · nuove gare di Coppa Veneto (Quarti, Semifinali, Finale…)
     · classifica di Serie C
   Il risultato resta in cache nel browser per 15 minuti. Se FIPAV non
   risponde si usano i JSON locali (aggiornabili con tools/aggiorna_fipav.py).
   Espone window.ODVFipav.refresh(matches, standings) → Promise.
   Le regole di formattazione dei nomi sono le stesse di tools/aggiorna_fipav.py.
   ========================================================= */
(() => {
  'use strict';

  const BASE = 'https://www.fipavveneto.net/mobile/risultati.asp';
  const ODV = 'OFFICINA DEL VOLLEY PD';
  const CACHE_KEY = 'odv-fipav-v1';
  const CACHE_MS = 15 * 60 * 1000;
  const UPCOMING_DETAILS = 4; // per quante prossime partite ricontrollare data e campo
  const THEMES = ['noir-agents', 'vintage-bw', 'western', 'abbey-road', '80s-rock', 'gothic'];
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

  // ---------- nomi leggibili (come tools/aggiorna_fipav.py) ----------
  const KEEP_UPPER = new Set(['PLP', 'APV', 'VBP', 'LGI', 'VPS', 'U16', 'ASD', 'A.S.D.', 'PD', 'S.M.', 'P.']);
  const PARTICLES = new Set(['della', 'dello', 'delle', 'dei', 'del', 'di', 'da']);
  const ACCENTS = { "A'": 'à', "O'": 'ò', "E'": 'è', "I'": 'ì', "U'": 'ù' };
  const FRIENDLY_TEAMS = { 'VOLLEY COLOMBO C': 'Volley Colombo', [ODV]: 'ODV Rio-Saonara' };
  const FRIENDLY_VENUES = { 'S.Salmaso': 'Palasalmaso · Villatora di Saonara (PD)', "Palarosa'": 'PalaRosà · Rosà (VI)' };
  function word(w, first) {
    if (KEEP_UPPER.has(w)) return w;
    for (const [k, v] of Object.entries(ACCENTS)) if (w.toUpperCase().endsWith(k)) w = w.slice(0, -2) + v;
    const low = w.toLowerCase();
    if (!first && PARTICLES.has(low)) return low;
    const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1);
    const out = low.split('-').map((p) => p.split("'").map(cap).join("'")).join('-');
    return !first && out.startsWith("D'") ? `d${out.slice(1)}` : out;
  }
  const words = (ws) => ws.map((w, i) => word(w, i === 0)).join(' ');
  const team = (n) => FRIENDLY_TEAMS[n] || words(n.split(/\s+/));
  function venue(v) {
    for (const [k, nice] of Object.entries(FRIENDLY_VENUES)) if (v.includes(k)) return nice;
    const ws = v.split(/\s+/);
    let i = ws.length;
    while (i > 0 && ws[i - 1] === ws[i - 1].toUpperCase() && /[A-Z]/.test(ws[i - 1])) i--;
    const name = ws.slice(0, i).join(' '), place = ws.slice(i);
    if (!place.length) return v;
    const prov = place[place.length - 1].length === 2 ? place[place.length - 1] : '';
    const city = words(prov ? place.slice(0, -1) : place);
    if (!name) return prov ? `${city} (${prov})` : city;
    return `${name} · ${city}${prov ? ` (${prov})` : ''}`;
  }

  // ---------- scaricamento e testo ----------
  async function get(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`FIPAV ${r.status}`);
    return r.text();
  }
  const decode = (t) => { const el = document.createElement('textarea'); el.innerHTML = t; return el.value; };
  function textLines(page) {
    let t = page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
    t = t.replace(/<br\s*\/?>|<\/tr>|<\/div>|<\/p>|<\/td>/g, '\n');
    t = decode(t.replace(/<[^>]+>/g, ' '));
    return t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  // Gare di ODV nell'elenco di un campionato (senza dettagli): [{ giornata, gara, played }]
  async function odvGames(camp) {
    const page = await get(`${BASE}?CampionatoId=${camp}`);
    const re = /<div class="divGiornata" id="giornata(\d+)">|<a href="[^"]*GaraId=(\d+)" class="gara"[\s\S]*?<\/a>/g;
    const out = [];
    let m, giornata = 0;
    while ((m = re.exec(page))) {
      if (m[1]) { giornata = Number(m[1]); continue; }
      if (!m[0].includes(ODV)) continue;
      const sets = [...m[0].matchAll(/class="set(?:Casa|Ospite)"[^>]*>\s*(\d*)\s*</g)].map((x) => x[1]);
      out.push({ giornata, gara: Number(m[2]), played: sets.length === 2 && sets[0] !== '' && sets[1] !== '' });
    }
    return out;
  }

  // Dettaglio gara → stessi campi di matches.json
  function parseDetail(lines) {
    const i = lines.findIndex((l) => l.startsWith('Giornata') && l.includes('Gara'));
    const L = lines.slice(i, i + 30);
    const [, d, t] = L[1].match(/(\d\d\/\d\d\/\d{4}) ore (\d\d:\d\d)/);
    const [dd, mm, yy] = d.split('/');
    const g = { data: `${yy}-${mm}-${dd}T${t}`, home: L[2], hs: null };
    if (L[3] === 'da disputare') return Object.assign(g, { away: L[4], venue: L[5], addr: L[6] || '' });
    const hs = Number(L[3]), hp = [];
    let k = 4;
    while (!(/^\d+$/.test(L[k]) && Number(L[k]) <= 3 && hp.length >= 3 && Number(L[k]) + hs === hp.length)) { hp.push(Number(L[k])); k++; }
    const as = Number(L[k]);
    const ap = L.slice(k + 1, k + 1 + hp.length).map(Number);
    k += 1 + hp.length;
    return Object.assign(g, { hs, as, hp, ap, away: L[k], venue: L[k + 1], addr: L[k + 2] });
  }
  function toMatch(lines, base) {
    const g = parseDetail(lines);
    const casa = g.home === ODV;
    const m = Object.assign({}, base, {
      data: g.data, avversario: team(casa ? g.away : g.home), luogo: venue(g.venue), indirizzo: g.addr,
      casa, risultato: null, parziali: []
    });
    if (g.hs !== null) { // sempre ODV per prima
      const [o, a] = casa ? [g.hs, g.as] : [g.as, g.hs];
      const [po, pa] = casa ? [g.hp, g.ap] : [g.ap, g.hp];
      m.risultato = `${o}-${a}`;
      m.parziali = po.map((x, j) => `${x}-${pa[j]}`);
    }
    return m;
  }
  const detail = async (camp, gara, base) => toMatch(textLines(await get(`${BASE}?CampionatoId=${camp}&GaraId=${gara}`)), base);

  async function standingsFor(camp) {
    const cls = textLines(await get(`${BASE}?CampionatoId=${camp}&vis=classifica`));
    let i = cls.indexOf('Pen.') + 1;
    const rows = [];
    while (i > 0 && i + 13 <= cls.length && /^\d+$/.test(cls[i])) {
      const c = cls.slice(i, i + 13);
      rows.push({ squadra: team(c[1]), pt: +c[2], g: +c[3], v: +c[4], p: +c[5], sv: +c[6], sp: +c[7] });
      i += 13;
    }
    return rows;
  }

  // Fasi a eliminazione della Coppa Veneto femminile presenti nell'elenco FIPAV
  async function coppaPhases() {
    const index = await get(BASE);
    return [...index.matchAll(/CampionatoId=(\d+)">Coppa Veneto Femminile - ([^<]+)</g)]
      .map((x) => ({ camp: Number(x[1]), fase: decode(x[2]).trim() }))
      .filter((x) => !x.fase.startsWith('Girone'));
  }

  // ---------- aggiornamento ----------
  async function refresh(matches, standings) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.t < CACHE_MS) return { matches: c.matches, standings: c.standings, aggiornato: new Date(c.t), live: true };
    } catch (e) { /* cache non disponibile */ }

    const now = Date.now();
    const byGara = new Map(matches.filter((m) => m.gara).map((m) => [m.gara, m]));
    const serieC = (matches.find((m) => m.competizione === 'Serie C') || {}).campionato;
    const camps = new Map(); // campionato → { competizione, fase }
    matches.forEach((m) => { if (m.campionato && !camps.has(m.campionato)) camps.set(m.campionato, { competizione: m.competizione, fase: m.competizione === 'Serie C' ? 'campionato' : null }); });
    try { (await coppaPhases()).forEach((p) => { if (!camps.has(p.camp)) camps.set(p.camp, { competizione: 'Coppa Veneto', fase: p.fase }); else camps.get(p.camp).fase = p.fase; }); } catch (e) { /* si tengono le fasi note */ }

    // 1) elenchi dei campionati: dove gioca ODV e quali gare hanno già un risultato
    const lists = await Promise.all([...camps.keys()].map(async (camp) => ({ camp, games: await odvGames(camp).catch(() => []) })));

    // 2) dettagli solo dove serve: risultati nuovi, gare nuove, prossime partite
    const upcoming = matches.filter((m) => !m.risultato && new Date(m.data).getTime() > now - 3 * 3600e3)
      .sort((a, b) => a.data.localeCompare(b.data)).slice(0, UPCOMING_DETAILS).map((m) => m.gara);
    const jobs = [];
    lists.forEach(({ camp, games }) => games.forEach((gm) => {
      const known = byGara.get(gm.gara);
      const info = camps.get(camp);
      if (!known) {
        const turno = info.competizione === 'Serie C'
          ? (gm.giornata <= 11 ? `Andata – ${ROMAN[gm.giornata]} giornata` : `Ritorno – ${ROMAN[gm.giornata - 11]} giornata`)
          : (info.fase && info.fase !== 'girone' ? info.fase : `${ROMAN[gm.giornata] || gm.giornata} giornata`);
        jobs.push({ camp, gara: gm.gara, base: { competizione: info.competizione, turno, campionato: camp, gara: gm.gara, giornata: gm.giornata, tema: THEMES[(gm.giornata + 2) % 6] } });
      } else if ((gm.played && !known.risultato) || upcoming.includes(gm.gara)) {
        const { data, avversario, luogo, indirizzo, casa, risultato, parziali, ...base } = known;
        jobs.push({ camp, gara: gm.gara, base });
      }
    }));
    const fresh = await Promise.all(jobs.map((j) => detail(j.camp, j.gara, j.base).catch(() => null)));
    fresh.filter(Boolean).forEach((m) => byGara.set(m.gara, m));
    const merged = [...matches.filter((m) => !m.gara), ...byGara.values()].sort((a, b) => a.data.localeCompare(b.data));

    // 3) classifica
    let squadre = (standings && standings.squadre) || standings || [];
    if (serieC) { try { const rows = await standingsFor(serieC); if (rows.length) squadre = rows; } catch (e) { /* resta quella locale */ } }
    const t = Date.now();
    const out = {
      matches: merged,
      standings: { nota: 'Fonte: FIPAV Veneto, Serie C femminile Girone B · dati in diretta · ODV Rio-Saonara è iscritta come "Officina del Volley PD"', squadre },
      aggiornato: new Date(t), live: true
    };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t, matches: out.matches, standings: out.standings })); } catch (e) { /* ok */ }
    return out;
  }

  window.ODVFipav = { refresh };
})();
