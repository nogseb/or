#!/usr/bin/env python3
"""Alerte de cours : à chaque publication, compare le cours de l'or fin relevé (dist/data/cours.json)
aux seuils fixés. Au premier passage au-dessus d'un seuil, ouvre une issue GitHub qui mentionne le
propriétaire du dépôt (notification par e-mail et dans l'application GitHub). L'issue se referme
d'elle-même quand le cours repasse nettement sous le seuil, ce qui réarme l'alerte.

Variables d'environnement :
  SEUILS          seuils en €/g, séparés par des virgules (par défaut 120,125)
  ALERTE_MENTION  compte GitHub à prévenir (par défaut nogseb)
  ALERTE_TEST     « 1 » pour une alerte de test (titre préfixé [Test])
  DRY_RUN         « 1 » pour simuler sans appeler GitHub
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import subprocess
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
COURS = ROOT / "dist" / "data" / "cours.json"
LABEL = "alerte-or"
MARGE = 2.0  # €/g sous le seuil avant de refermer (évite les alertes en rafale autour du seuil)
SITE = "https://nogues.app/or/#lot"
NB, NNB = " ", " "

# Lot à vendre, inventaire du 25 octobre 2026 (or 18 carats estimé, en grammes)
TRANCHE_1 = 38.0   # collier, chaîne fine, créoles épaisses, demi-créoles, créoles moyennes
TRANCHE_2 = 20.2   # pendentifs, créoles fines, alliances, scarabée, bracelet
SEUIL_FISCAL = 5000.0

DRY = os.environ.get("DRY_RUN") == "1"
TEST = os.environ.get("ALERTE_TEST") == "1"
MENTION = os.environ.get("ALERTE_MENTION", "nogseb").lstrip("@")


def num(x: float, d: int = 2) -> str:
    return f"{x:,.{d}f}".replace(",", NNB).replace(".", ",")


def eur(x: float) -> str:
    return num(round(x), 0) + NB + "€"


def gh(*args: str) -> str:
    if DRY:
        print("[simulation] gh " + " ".join(a if len(a) < 70 else a[:67] + "…" for a in args))
        return "[]"
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def corps(prix: float, seuil: float, seuil_vente: float, releve: str, source: str) -> str:
    o85 = prix * 0.75 * 0.85
    total = (TRANCHE_1 + TRANCHE_2) * o85
    if seuil >= seuil_vente:
        tete = f"**Seuil de vente de la tranche 2 atteint.** Le cours de l'or fin est à **{num(prix)}{NB}€/g** (seuil : {num(seuil, 0)}{NB}€/g)."
        suite = "Prochaine étape : appeler les comptoirs avec le texte prévu sur le site et vendre la tranche 2 dès qu'une offre atteint au moins"
    else:
        tete = f"**Pré-alerte : le cours remonte.** L'or fin est à **{num(prix)}{NB}€/g** (seuil : {num(seuil, 0)}{NB}€/g ; seuil de vente de la tranche 2 : {num(seuil_vente, 0)}{NB}€/g)."
        suite = "Prochaine étape : vérifier les poinçons de la tranche 2 et faire chiffrer les bijoux sertis, pour être prêt. Une bonne offre démarre à"
    fisc = ("reste sous" if total <= SEUIL_FISCAL else "dépasse")
    test = "> Ceci est une alerte de test : aucune action n'est nécessaire.\n\n" if TEST else ""
    return f"""{test}@{MENTION} {tete}

Relevé : {releve} ({source}).

| Lot | Or estimé | Offre à 85{NB}% |
| --- | --- | --- |
| Tranche 2 (pendentifs, créoles fines, alliances, scarabée, bracelet) | {num(TRANCHE_2, 1)}{NB}g | ≈ {eur(TRANCHE_2 * o85)} |
| Tranche 1, si elle n'est pas encore vendue | {num(TRANCHE_1, 1)}{NB}g | ≈ {eur(TRANCHE_1 * o85)} |
| Lot complet | {num(TRANCHE_1 + TRANCHE_2, 1)}{NB}g | ≈ {eur(total)} |

{suite} **{num(o85)}{NB}€/g** en or 18 carats.

Fiscalité : à 85{NB}%, le lot complet {fisc} le seuil de 5{NB}000{NB}€ par vente.

Site : {SITE}

Cette alerte se referme d'elle-même si le cours repasse sous {num(seuil - MARGE, 0)}{NB}€/g ; elle se déclenchera de nouveau au prochain passage au-dessus de {num(seuil, 0)}{NB}€/g.
"""


def main() -> None:
    data = json.loads(COURS.read_text(encoding="utf-8"))
    if data.get("status") != "live":
        print("Cours du jour indisponible : pas de vérification d'alerte.")
        return
    prix = float(data["eur_g"])
    try:
        quand = dt.datetime.fromisoformat(data["updated"]).astimezone(ZoneInfo("Europe/Paris"))
        releve = quand.strftime("%d/%m/%Y à %Hh%M")
    except (KeyError, ValueError):
        releve = "date inconnue"
    seuils = sorted({float(s.strip().replace(",", ".")) for s in os.environ.get("SEUILS", "120,125").split(",") if s.strip()})
    if not seuils:
        print("Aucun seuil défini.")
        return
    seuil_vente = max(seuils)
    prefixe = "[Test] " if TEST else ""

    gh("label", "create", LABEL, "--color", "D6A536", "--description", "Alerte de cours de l'or", "--force")
    ouvertes = json.loads(gh("issue", "list", "--label", LABEL, "--state", "open", "--json", "number,title", "--limit", "100") or "[]")

    print(f"Cours relevé : {num(prix)} €/g ; seuils : {', '.join(num(s, 0) for s in seuils)} €/g")
    for seuil in seuils:
        titre = f"{prefixe}Alerte or : cours au-dessus de {num(seuil, 0)}{NB}€/g"
        deja = [i for i in ouvertes if i.get("title") == titre]
        if prix >= seuil and not deja:
            gh("issue", "create", "--title", titre, "--label", LABEL, "--body", corps(prix, seuil, seuil_vente, releve, data.get("source", "")))
            print(f"Alerte ouverte : {titre}")
        elif prix < seuil - MARGE and deja:
            for issue in deja:
                gh("issue", "close", str(issue["number"]), "--comment",
                   f"Cours redescendu à {num(prix)}{NB}€/g : alerte refermée. Elle se déclenchera de nouveau au prochain passage au-dessus de {num(seuil, 0)}{NB}€/g.")
            print(f"Alerte refermée : {titre}")
        else:
            print(f"Seuil {num(seuil, 0)} €/g : rien à signaler (alerte {'déjà ouverte' if deja else 'non déclenchée'}).")


if __name__ == "__main__":
    main()
