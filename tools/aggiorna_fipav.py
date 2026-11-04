#!/usr/bin/env python3
"""Aggiorna data/matches.json e data/standings.json dal sito FIPAV Veneto.

Uso (dalla cartella del sito):  python3 tools/aggiorna_fipav.py

Scarica calendario, risultati, parziali e classifica di ODV Rio-Saonara
(iscritta in FIPAV come "OFFICINA DEL VOLLEY PD"). Il "tema" delle locandine
già presenti in matches.json viene mantenuto. Richiede curl.
"""
import datetime, html, json, os, re, subprocess

BASE = 'https://www.fipavveneto.net/mobile/risultati.asp'
# CampionatoId FIPAV della stagione 2026/27: aggiornali se cambiano (es. nuove fasi di Coppa)
SERIE_C = 92006            # Serie C femminile – Girone B
COPPA_GIRONE = 92509       # Coppa Veneto Femminile – Girone E
# Le fasi a eliminazione (Sedicesimi, Ottavi, Quarti…) vengono trovate da sole nell'elenco dei campionati FIPAV
ODV = 'OFFICINA DEL VOLLEY PD'
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')

THEMES = ['noir-agents', 'vintage-bw', 'western', 'abbey-road', '80s-rock', 'gothic']
ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
KEEP_UPPER = {'PLP', 'APV', 'VBP', 'LGI', 'VPS', 'U16', 'ASD', 'A.S.D.', 'PD', 'S.M.', 'P.'}
PARTICLES = {'della', 'dello', 'delle', 'dei', 'del', 'di', 'da'}
ACCENTS = {"A'": 'à', "O'": 'ò', "E'": 'è', "I'": 'ì', "U'": 'ù'}
FRIENDLY_TEAMS = {'VOLLEY COLOMBO C': 'Volley Colombo', ODV: 'ODV Rio-Saonara'}
FRIENDLY_VENUES = {'S.Salmaso': 'Palasalmaso · Villatora di Saonara (PD)', "Palarosa'": 'PalaRosà · Rosà (VI)'}


# ---------- scaricamento e testo ----------
def get(url):
    return subprocess.run(['curl', '-sSL', '--max-time', '30', '-A', 'Mozilla/5.0', url],
                          capture_output=True, check=True).stdout.decode('latin-1')

def text_lines(page):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', page, flags=re.S)
    t = re.sub(r'<br\s*/?>|</tr>|</div>|</p>|</td>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t))
    return [x for x in (re.sub(r'\s+', ' ', l).strip() for l in t.split('\n')) if x]

def coppa_phases():
    """[(CampionatoId, fase)] delle fasi a eliminazione della Coppa Veneto femminile."""
    index = get(BASE)
    found = re.findall(r'CampionatoId=(\d+)">Coppa Veneto Femminile - ([^<]+)<', index)
    return [(int(cid), html.unescape(name).strip()) for cid, name in found if not name.startswith('Girone')]

def odv_games(camp):
    """[(giornata, GaraId, righe di testo del dettaglio gara)] per le gare di ODV in un campionato."""
    page = get(f'{BASE}?CampionatoId={camp}')
    games, giornata = [], 0
    for m in re.finditer(r'<div class="divGiornata" id="giornata(\d+)">|<a href="[^"]*GaraId=(\d+)" class="gara".*?</a>', page, flags=re.S):
        if m.group(1):
            giornata = int(m.group(1))
        elif ODV in m.group(0):
            lines = text_lines(get(f'{BASE}?CampionatoId={camp}&GaraId={m.group(2)}'))
            i = next(k for k, l in enumerate(lines) if l.startswith('Giornata') and 'Gara' in l)
            games.append((giornata, int(m.group(2)), lines[i:i + 30]))
    return games


# ---------- nomi leggibili ----------
def word(w, first=False):
    if w in KEEP_UPPER:
        return w
    for k, v in ACCENTS.items():
        if w.upper().endswith(k):
            w = w[:-2] + v
    low = w.lower()
    if not first and low in PARTICLES:
        return low
    cap = lambda p: p[:1].upper() + p[1:]
    out = '-'.join("'".join(cap(q) for q in p.split("'")) for p in low.split('-'))
    return 'd' + out[1:] if not first and out.startswith("D'") else out  # "Quarto d'Altino"

def words(ws):
    return ' '.join(word(w, i == 0) for i, w in enumerate(ws))

def team(n):
    return FRIENDLY_TEAMS.get(n) or words(n.split())

def venue(v):
    for key, nice in FRIENDLY_VENUES.items():
        if key in v:
            return nice
    # FIPAV: "Nome impianto CITTÀ PR" → "Nome impianto · Città (PR)"
    ws = v.split()
    i = len(ws)
    while i > 0 and ws[i - 1] == ws[i - 1].upper() and re.search('[A-Z]', ws[i - 1]):
        i -= 1
    name, place = ' '.join(ws[:i]), ws[i:]
    if not place:
        return v
    prov = place[-1] if len(place[-1]) == 2 else ''
    city = words(place[:-1] if prov else place)
    if not name:
        return f'{city} ({prov})' if prov else city
    return f"{name} · {city}{f' ({prov})' if prov else ''}"


# ---------- dettaglio gara ----------
def parse(lines):
    d, t = re.search(r'(\d\d/\d\d/\d{4}) ore (\d\d:\d\d)', lines[1]).groups()
    dd, mm, yy = d.split('/')
    g = {'data': f'{yy}-{mm}-{dd}T{t}', 'home': lines[2], 'hs': None}
    if lines[3] == 'da disputare':
        g.update(away=lines[4], venue=lines[5], addr=lines[6] if len(lines) > 6 else '')
        return g
    # set casa, parziali casa, set ospite, parziali ospite, ospite, impianto, indirizzo
    hs, k, hp = int(lines[3]), 4, []
    while not (lines[k].isdigit() and int(lines[k]) <= 3 and len(hp) >= 3 and int(lines[k]) + hs == len(hp)):
        hp.append(int(lines[k]))
        k += 1
    a_s = int(lines[k])
    ap = [int(x) for x in lines[k + 1:k + 1 + len(hp)]]
    k += 1 + len(hp)
    g.update(hs=hs, as_=a_s, hp=hp, ap=ap, away=lines[k], venue=lines[k + 1], addr=lines[k + 2])
    return g

def to_match(lines, comp, turno, tema, camp, gara, giornata):
    g = parse(lines)
    casa = g['home'] == ODV
    out = {'competizione': comp, 'turno': turno, 'data': g['data'], 'campionato': camp, 'gara': gara, 'giornata': giornata,
           'avversario': team(g['away'] if casa else g['home']),
           'luogo': venue(g['venue']), 'indirizzo': g['addr'], 'casa': casa,
           'risultato': None, 'parziali': [], 'tema': tema}
    if g['hs'] is not None:  # sempre ODV per prima
        o, a = (g['hs'], g['as_']) if casa else (g['as_'], g['hs'])
        po, pa = (g['hp'], g['ap']) if casa else (g['ap'], g['hp'])
        out['risultato'] = f'{o}-{a}'
        out['parziali'] = [f'{x}-{y}' for x, y in zip(po, pa)]
    return out


def main():
    matches_path = os.path.join(DATA_DIR, 'matches.json')
    try:  # conserva i temi già scelti per ogni locandina
        old = {(m['data'][:10], m['competizione']): m.get('tema') for m in json.load(open(matches_path))}
    except (OSError, ValueError):
        old = {}

    matches = []
    for camp, fase in [(COPPA_GIRONE, 'girone')] + coppa_phases():
        for g, gara, lines in odv_games(camp):
            turno = f'{ROMAN[g]} giornata' if fase == 'girone' else fase
            matches.append(to_match(lines, 'Coppa Veneto', turno, THEMES[(g - 1) % 6], camp, gara, g))
    for g, gara, lines in odv_games(SERIE_C):
        turno = f'Andata – {ROMAN[g]} giornata' if g <= 11 else f'Ritorno – {ROMAN[g - 11]} giornata'
        matches.append(to_match(lines, 'Serie C', turno, THEMES[(g + 4) % 6], SERIE_C, gara, g))
    for m in matches:
        m['tema'] = old.get((m['data'][:10], m['competizione'])) or m['tema']
    matches.sort(key=lambda m: m['data'])

    cls = text_lines(get(f'{BASE}?CampionatoId={SERIE_C}&vis=classifica'))
    i, rows = cls.index('Pen.') + 1, []
    while i + 13 <= len(cls) and cls[i].isdigit():
        c = cls[i:i + 13]
        rows.append({'squadra': team(c[1]), 'pt': int(c[2]), 'g': int(c[3]), 'v': int(c[4]),
                     'p': int(c[5]), 'sv': int(c[6]), 'sp': int(c[7])})
        i += 13
    today = datetime.date.today()
    mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    nota = (f'Fonte: FIPAV Veneto, Serie C femminile Girone B · aggiornata al {today.day} {mesi[today.month - 1]} {today.year}'
            ' · ODV Rio-Saonara è iscritta come "Officina del Volley PD"')

    with open(matches_path, 'w') as f:
        f.write('[\n' + ',\n'.join('  ' + json.dumps(m, ensure_ascii=False) for m in matches) + '\n]\n')
    with open(os.path.join(DATA_DIR, 'standings.json'), 'w') as f:
        f.write('{\n  "nota": ' + json.dumps(nota, ensure_ascii=False) + ',\n  "squadre": [\n'
                + ',\n'.join('    ' + json.dumps(r, ensure_ascii=False) for r in rows) + '\n  ]\n}\n')
    played = sum(1 for m in matches if m['risultato'])
    print(f'{len(matches)} partite ({played} con risultato), {len(rows)} squadre in classifica.')


if __name__ == '__main__':
    main()
