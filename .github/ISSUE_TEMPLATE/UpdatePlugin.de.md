---
name: UpdatePlugin (Deutsch)
about: Ein Plugin im AvNav-Plugin-Katalog aktualisieren
title: "[Plugin] Aktualisieren "
labels: update plugin
---

Bitte aktualisiere die folgenden Angaben im Plugin-Katalog:

**name** (Pflicht. Der in AvNav angezeigte Plugin-Name ist zugleich der Verzeichnisname auf dem Server. Bei `package`-Plugins müssen die Dateien unter `/usr/lib/avnav/plugins/<name>` liegen. Bei `zip`-Plugins muss er dem Namen des obersten Verzeichnisses entsprechen, das alle Plugin-Dateien im ZIP-Archiv enthält.):
>

**version** (Pflicht. Eine Zahl oder eine [SemVer](https://semver.org/)-Versionszeichenkette, die der Version in `plugin.json` entspricht.):
>

**minversion** (Optionale minimale erforderliche AvNav-Version. Optional kann eine maximale Version als Bereich angegeben werden, zum Beispiel `20120101..20260101`.):
>

**download_url** (Pflicht für `zip`. Eine Download-URL; `$version` wird durch die Plugin-Version ersetzt.):
>
