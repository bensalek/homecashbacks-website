#!/usr/bin/env python3
"""Update the market figures on the city and neighbourhood pages from a TRREB Market Watch PDF.

Usage (from the repo root):
  python3 scripts/update-market-data.py --pdf mw_october_2026.pdf --month October --year 2026 \
      --gta-yoy -3.2 --hpi-yoy -4.1 --ldom 33

  --gta-yoy / --hpi-yoy : year-over-year change of the GTA average price / MLS HPI Composite (signed; from the
                          press-release text on page 1 of the PDF).
  --ldom                : GTA average days on market ("Avg. LDOM", All TRREB Areas row).

What it changes (and nothing else):
  data/cities.json         marketDate, the month and average/detached prices in marketText, stats, cashback
                           (cashback = average price x 2.5% - $4,999, rounded half up)
  data/neighbourhoods.json marketDate and the TRREB district figures (average, sales, house types with 10+ sales)

What it does NOT change (review by hand, see CLAUDE.md):
  pages/toronto-market-trends.html, the condo pages (Toronto condo benchmark), the homepage/calculator "average GTA home"
  figures, and the sentence "new listings falling faster than sales ..." in marketText (only true while it is true).
Source of the figures: the "All Home types" and "Detached" monthly tables (cities) and the Toronto district rows
(neighbourhoods) of the TRREB Market Watch PDF. Needs `pdftotext` (poppler-utils).
"""
import argparse, json, math, re, subprocess, sys

MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'
# city slug -> TRREB area name (default: the city name as printed in the PDF)
AREA = {'toronto': 'City of Toronto', 'etobicoke': 'Toronto West', 'scarborough': 'Toronto East',
        'north-york': 'Toronto Central', 'thornhill': 'Vaughan', 'stouffville': 'Stouffville', 'king-city': 'King'}
# neighbourhood slug -> TRREB district (confirm with Laleh; Danforth E03 is the least certain)
DISTRICT = {'annex-toronto': 'C02', 'st-lawrence-market-toronto': 'C08', 'leslieville-toronto': 'E01',
            'the-junction-toronto': 'W02', 'leaside-toronto': 'C11', 'harbourfront-toronto': 'C01',
            'yonge-eglinton-toronto': 'C10', 'corso-italia-toronto': 'W03', 'danforth-toronto': 'E03',
            'liberty-village-toronto': 'C01', 'the-beaches-toronto': 'E02', 'roncesvalles-toronto': 'W01'}
TYPE_HEADERS = {'All Home types': 'all', 'Detached': 'Detached', 'Semi-Detached': 'Semi-detached',
                'Att/Row/Townhouse': 'Townhouses', 'Condo Apartment': 'Condo apartments'}
OTHER_HEADERS = 'Condo Townhouse|Link|Co-Op Apartment|Det Condo|Co-Ownership Apartment'


def half_up(x):
    return int(math.floor(x + 0.5))


def short(v):
    return '$%.2fM' % (v / 1e6) if v >= 1_000_000 else '$%dK' % round(v / 1000)


def signed(x, suffix='%'):
    return ('-' if x < 0 else '+') + ('%.1f' % abs(x)) + suffix


def parse(pdf, month, year):
    text = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout
    lines = text.split('\n')
    hdr = re.compile(r'ALL TRREB AREAS\s+(%s|%s), %s %s' % ('|'.join(TYPE_HEADERS), OTHER_HEADERS, month, year))
    row_area = re.compile(r'^\s*([A-Za-z][A-Za-z .\-\'/]+?)\s{2,}([\d,]+)\s+(\$[\d,]+)\s+(\$[\d,]+)\s+(\$[\d,]+)')
    row_dist = re.compile(r'^\s*(Toronto [CWE]\d\d)\s+(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)')
    cur, areas, dists = None, {}, {}
    for l in lines:
        m = hdr.search(l)
        if m:
            cur = m.group(1)
            continue
        if cur not in TYPE_HEADERS:
            continue
        r = row_dist.match(l)
        if r:
            dists.setdefault((r.group(1).split()[1], TYPE_HEADERS[cur]), (int(r.group(2)), int(r.group(4).replace(',', ''))))
            continue
        a = row_area.match(l)
        if a and len(areas.get(TYPE_HEADERS[cur], {})) < 80:
            areas.setdefault(TYPE_HEADERS[cur], {}).setdefault(a.group(1).strip(), (int(a.group(2).replace(',', '')), int(a.group(4).replace('$', '').replace(',', ''))))
    if 'all' not in areas or 'Detached' not in areas or 'All TRREB Areas' not in areas['all']:
        sys.exit('Could not find the monthly tables for %s %s in the PDF (layout changed?). Stop and check by hand.' % (month, year))
    return areas, dists


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--month', required=True)
    ap.add_argument('--year', default='2026')
    ap.add_argument('--gta-yoy', type=float, required=True)
    ap.add_argument('--hpi-yoy', type=float, required=True)
    ap.add_argument('--ldom', type=int, required=True)
    a = ap.parse_args()
    label = '%s %s' % (a.month, a.year)
    areas, dists = parse(a.pdf, a.month, a.year)
    allt, det = areas['all'], areas['Detached']
    gta_word = lambda x: 'down' if x < 0 else 'up'
    clause = 'the average selling price was %s %.1f%% year-over-year and the MLS® HPI Composite benchmark was %s %.1f%%' % (
        gta_word(a.gta_yoy), abs(a.gta_yoy), gta_word(a.hpi_yoy), abs(a.hpi_yoy))
    clause_re = re.compile(r'the average selling price was (?:down|up) [\d.]+% year-over-year and the MLS® HPI Composite benchmark was (?:down|up) [\d.]+%')

    # ---- cities
    p = 'data/cities.json'
    raw = open(p, encoding='utf-8').read()
    d = json.loads(raw)
    assert json.dumps(d, indent=2, ensure_ascii=True) + ('\n' if raw.endswith('\n') else '') == raw, 'cities.json format changed'
    d['dataDate'] = label
    for c in d['cities']:
        name = AREA.get(c['slug'], c['name'])
        if name not in allt:
            sys.exit('Area "%s" (%s) not found in the PDF' % (name, c['slug']))
        avg = allt[name][1]
        t = re.sub(r'(%s) %s' % (MONTHS, a.year), label, c['marketText'])
        t, n = re.subn(r'(average sale price (?:in|across) [A-Za-z .\-]+? was )\$[\d,]+', lambda m: m.group(1) + '${:,}'.format(avg), t)
        assert n == 1, c['slug']
        has_det = 'Detached homes averaged' in t
        if has_det:
            t, n = re.subn(r'(Detached homes averaged )\$[\d,]+', lambda m: m.group(1) + '${:,}'.format(det[name][1]), t)
            assert n == 1, c['slug']
        t, n = clause_re.subn(clause, t)
        assert n == 1, c['slug'] + ' GTA clause'
        c['marketText'], c['marketDate'] = t, label
        c['cashback'] = '${:,}'.format(half_up(avg * 0.025 - 4999))
        for s in c['stats']:
            l = s['label']
            if l == 'Average home price' or l.startswith('Avg. price,'):
                s['val'] = short(avg)
            elif l == 'Average detached':
                s['val'] = short(det[name][1])
            elif l == 'GTA avg price, YoY':
                s['val'] = ('-' if a.gta_yoy < 0 else '') + '%.1f%%' % abs(a.gta_yoy)
            elif l == 'GTA avg days on market':
                s['val'] = '%d days' % a.ldom
            else:
                sys.exit('Unknown stat label ' + l)
    open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=True) + ('\n' if raw.endswith('\n') else ''))

    # ---- neighbourhoods
    p = 'data/neighbourhoods.json'
    raw = open(p, encoding='utf-8').read()
    d = json.loads(raw)
    assert json.dumps(d, indent=2, ensure_ascii=False) + '\n' == raw, 'neighbourhoods.json format changed'
    d['dataDate'] = label
    for n in d['neighbourhoods']:
        code = DISTRICT[n['slug']]
        sales, avg = dists[(code, 'all')]
        types = [{'type': t, 'avg': dists[(code, t)][1], 'sales': dists[(code, t)][0]}
                 for t in ('Detached', 'Semi-detached', 'Townhouses', 'Condo apartments')
                 if (code, t) in dists and dists[(code, t)][0] >= 10]
        n['district'] = {'code': code, 'avg': avg, 'sales': sales, 'types': types}
        n['marketDate'] = label
    open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    print('Updated cities and neighbourhoods to %s.' % label)
    print('NOW CHECK BY HAND: toronto-market-trends.html, the condo pages, homepage/calculators GTA average, and the')
    print('"new listings falling faster than sales" sentence in cities.json. Then run npm test.')


if __name__ == '__main__':
    main()
