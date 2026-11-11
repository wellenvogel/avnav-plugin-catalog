---
name: AddPlugin (Deutsch)
about: Ein Plugin zum AvNav-Plugin-Katalog hinzufügen
title: "[Plugin] Hinzufügen "
labels: new plugin
---

Bitte ergänze die folgenden Angaben für den Plugin-Katalog:

**name** (Pflicht. Der in AvNav angezeigte Plugin-Name ist zugleich der Verzeichnisname auf dem Server. Bei `package`-Plugins müssen die Dateien unter `/usr/lib/avnav/plugins/<name>` liegen. Bei `zip`-Plugins muss er dem Namen des obersten Verzeichnisses entsprechen, das alle Plugin-Dateien im ZIP-Archiv enthält.):
>

**description** (Pflicht. Eine kurze Beschreibung der Plugin-Funktionalität in mindestens einer der Sprachen `en` oder `de` angeben, mit höchstens 80 Zeichen je Beschreibung.):
>

**version** (Pflicht. Eine Zahl oder eine [SemVer](https://semver.org/)-Versionszeichenkette, die der Version in `plugin.json` entspricht.):
>

**platform** (Pflicht. Unterstützte Plattformen angeben: `android`, `linux`, `windows`, `raspberry` oder `all`. `all` steht für alle Plattformen.):
>

**type** (Pflicht. Der Verteilungstyp des Plugins ist `zip` oder `package`. Debian-`package`-Plugins werden zu [System-Plugins](https://www.wellenvogel.de/software/avnav/newDoc/latest/special/plugins.html#debian-pakete); `zip`-Plugins werden zu [Benutzer-Plugins](https://www.wellenvogel.de/software/avnav/newDoc/latest/special/plugins.html#zip-datei).):
>

**download_url** (Pflicht für `zip`. Eine Download-URL; `$version` wird durch die Plugin-Version ersetzt.):
>

**documentation** (Optionale URL zur Plugin-Dokumentation. Wenn sie `$version` enthält, wird dieser Platzhalter beim Erzeugen des Links durch die aktuelle Plugin-Version ersetzt.):
>

**minversion** (Optionale minimale erforderliche AvNav-Version. Optional kann eine maximale Version als Bereich angegeben werden, zum Beispiel `20120101..20260101`.):
>

**src_url** (Optional. URL des Quellcodes; bei einem GitHub-basierten Plugin muss es die GitHub-Repository-URL sein.):
>

**author** (Optional. Name des Plugin-Autors; bei einer GitHub-`src_url` sollte dies der GitHub-Benutzername sein.):
>

**email** (Pflicht, wenn `src_url` fehlt oder der Autor darüber nicht erreichbar ist; ansonsten optional.):
>

**license** (Optional. Eine Abkürzung für die Plugin-Lizenz.):
>

**update** (Optional. `github` prüft das Repository in `src_url` auf Releases und aktualisiert `version` anhand des Release-Namens oder von `release_pattern`. Nur für `zip`-Plugins gültig. Ist `filename` angegeben, aktualisiert ein passendes Release-Asset auch `download_url`. `repository` aktualisiert Pakete aus einem konfigurierten Debian-Repository.):
>

**filename** (Optional für `github`. In den Release-Assets nach diesem Dateinamen suchen und `download_url` auf die URL des passenden Assets setzen. Der Dateiname kann `$version` als Platzhalter enthalten.):
>

**release_pattern** (Optional für `github`. Ein regulärer JavaScript-Ausdruck, um die Version aus dem Release-Namen zu ermitteln. `#semver#` oder `#simple#` können als vordefinierte Muster verwendet werden, zum Beispiel `v#semver#`. Die erste Fanggruppe liefert die Version; ohne Fanggruppe wird der gesamte Treffer verwendet.):
>
