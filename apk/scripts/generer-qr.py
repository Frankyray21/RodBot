#!/usr/bin/env python3
"""Regénère le code QR de l'application Android (racine du dépôt).

Le code QR pointe vers le lien stable de la Release GitHub. Cette adresse ne
change jamais : GitHub Actions remplace le fichier à chaque version du site.
Il n'y a donc rien à regénérer, sauf si le dépôt change de nom ou de propriétaire.

    pip install segno && python3 apk/scripts/generer-qr.py

L'adresse doit rester identique à APK_URL dans app.js (voir tests/apk.test.cjs).
"""
import pathlib
import segno

URL = "https://github.com/Frankyray21/RodBot/releases/download/apk-latest/RodBot-LP.apk"
RACINE = pathlib.Path(__file__).resolve().parents[2]

qr = segno.make(URL, error="m")
qr.save(RACINE / "qr-apk-android.svg", scale=24, border=4, dark="#141413", light="#FFFFFF")
qr.save(RACINE / "qr-apk-android.png", scale=10, border=4, dark="#141413", light="#FFFFFF")
print(f"code QR version {qr.version}, correction {qr.error} : {URL}")
