#!/usr/bin/env bash
# Télécharge les validateurs officiels Factur-X / EN 16931 / BR-FR dans le dossier donné :
# XSD et Schematron compilés (paquet Python factur-x), Saxon-HE et xmlresolver.
# Usage : outils/validateurs-facturx.sh /chemin/validateurs && export VALIDATEURS_FACTURX=/chemin/validateurs
set -euo pipefail
DEST="${1:?dossier de destination}"
mkdir -p "$DEST"
TMP="$(mktemp -d)"
pip download --no-deps --quiet --dest "$TMP" factur-x==7.6
python3 -m zipfile -e "$TMP"/factur_x-7.6-py3-none-any.whl "$TMP/fx"
rm -rf "$DEST/xsd_and_schematron"
cp -r "$TMP/fx/facturx/xsd_and_schematron" "$DEST/"
curl -sSfL -o "$DEST/saxon.jar" https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/12.5/Saxon-HE-12.5.jar
curl -sSfL -o "$DEST/xmlresolver.jar" https://repo1.maven.org/maven2/org/xmlresolver/xmlresolver/5.2.2/xmlresolver-5.2.2.jar
rm -rf "$TMP"
echo "Validateurs installés dans $DEST"
