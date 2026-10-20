#!/usr/bin/env python3
"""Génère dist/ à partir de site/ et y écrit le cours du jour de l'or (data/cours.json).

Le cours est récupéré au moment de la publication : once d'or en dollars (gold-api.com),
convertie en euros au taux de référence BCE (Frankfurter). En cas d'échec réseau ou de valeur
aberrante, le cours de référence livré dans site/data/cours.json est conservé : la publication
ne s'arrête jamais pour une source de cours indisponible.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import shutil
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DIST = ROOT / "dist"
OZ = 31.1034768
UA = {"User-Agent": "nogues.app-or/1.0 (+https://nogues.app/or/)", "Accept": "application/json"}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def gold_usd_oz() -> float:
    data = get_json("https://api.gold-api.com/price/XAU")
    return float(data["price"])


def usd_to_eur() -> tuple[float, str]:
    errors = []
    for url in (
        "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR",
        "https://api.frankfurter.app/latest?from=USD&to=EUR",
    ):
        try:
            data = get_json(url)
            return float(data["rates"]["EUR"]), str(data.get("date", ""))
        except Exception as exc:  # noqa: BLE001 - on essaie la source suivante
            errors.append(f"{url}: {exc}")
    raise RuntimeError("; ".join(errors))


def live_price() -> dict | None:
    try:
        usd = gold_usd_oz()
        rate, rate_date = usd_to_eur()
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::Cours du jour indisponible, cours de référence conservé ({exc})")
        return None
    eur_g = usd * rate / OZ
    if not 30 < eur_g < 500:
        print(f"::warning::Cours calculé hors plage ({eur_g:.2f} €/g), cours de référence conservé")
        return None
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    return {
        "eur_g": round(eur_g, 2),
        "usd_oz": round(usd, 2),
        "eur_per_usd": round(rate, 5),
        "rate_date": rate_date,
        "updated": now.isoformat(),
        "status": "live",
        "source": "gold-api.com, taux BCE",
    }


def check_site() -> None:
    """Vérifie que chaque fichier local référencé par index.html existe."""
    html = (SITE / "index.html").read_text(encoding="utf-8")
    missing = []
    for ref in re.findall(r'(?:src|href)="([^"#:]+)"', html):
        if ref.startswith(("http", "mailto", "tel")) or ref == "":
            continue
        if not (SITE / ref).exists():
            missing.append(ref)
    if missing:
        sys.exit(f"Fichiers référencés introuvables : {', '.join(missing)}")


def bust_cache() -> None:
    """Ajoute ?v=<empreinte> aux feuilles de style et scripts pour que chaque publication soit vue sans vider le cache."""
    import hashlib
    index = DIST / "index.html"
    html = index.read_text(encoding="utf-8")
    for asset in ("assets/style.css", "assets/app.js", "assets/decor.js"):
        path = DIST / asset
        if path.exists():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()[:10]
            html = html.replace(f'"{asset}"', f'"{asset}?v={digest}"')
    index.write_text(html, encoding="utf-8")


def main() -> None:
    check_site()
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SITE, DIST)
    bust_cache()
    price = live_price()
    if price:
        (DIST / "data" / "cours.json").write_text(json.dumps(price, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Cours du jour : {price['eur_g']} €/g (once {price['usd_oz']} $, 1 $ = {price['eur_per_usd']} €)")
    files = sorted(p.relative_to(DIST).as_posix() for p in DIST.rglob("*") if p.is_file())
    print(f"dist/ : {len(files)} fichiers")
    for f in files:
        print(f"  {f}")


if __name__ == "__main__":
    main()
