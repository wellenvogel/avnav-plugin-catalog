---
  layout: default
  lang: de
  addlink:
    url: list.html
    title: 'Zum Katalog'
---

# Hinweise für Plugin Entwickler

Um ein Plugin in diese Liste aufzunehmen, muss das Plugin einige wenige Bedingungen erfüllen und es müssen einige Informationen bereitgestellt werden.

Für Details zum Entwickeln von Plugins siehe die Erklärungen in der [AvNav Dokumentation]({{ site.avnav_docbase_de | append: site.data.doclinks.create.url.de }}).

## Bedingungen

Damit ein Plugin in diese Liste aufgenommen werden kann, müssen die folgenden Bedingungen erfüllt sein:

1. Der/die Plugin-Entwickler[in] muss bereit sein, das Plugin zu betreuen und Nutzer ggf. zu unterstützen. Dazu muss es eine Erreichbarkeit für Nutzuer geben - entweder per GitHub oder per Email.

2. Das Plugin muss entweder als debian Paket in unserem Repository verfügbar sein (das erfordert gesonderte Absprachen) oder es muss als Zip-Datei zum Download bereitgestellt werden.

3. Das Plugin muss eine Beschreibung bereitstellen, die online erreichbar ist.

3. Das Plugin muss die Datenschutz-Regeln einhalten. Es darf insbesondere nicht ohne Zustimmung des Nutzers Daten online speichern.

## Eintrag eines neuen Plugins

Die folgenden Felder beschreiben die für einen Katalogeintrag benötigten Informationen:

{% include plugin-fields-table.html %}

Die Informationen können per E-Mail an

{% capture email_body %}{% include plugin-email-body.txt %}{% endcapture %}
{% include mailto.html
    subject="Neues Plugin"
    text="avnav@wellenvogel.de"
    body=email_body
%}

gesendet werden; alternativ kann in diesem Repository ein [Issue]({{site.github.repository_url}}/issues/new?template=AddPlugin.de.md) geöffnet werden.

## Update eines Plugins

Plugin updates im Katalog können auf zwei Arten erfolgen:

 * automatisch
 * manuell

### Automatischer Update

Der Eintrag wird automatisch aktualisiert, wenn eine bekannte Update Funktion hinterlegt ist (Eigenschaft `update`). Beim jeweiligen Plugin wird dann der Indicator 🔄 angezeigt. Momentan sind die Funktionen `github` und `repository` verfügbar.

#### Update github

Für diesen Update Typ muss `src_url` auf ein GitHub-Repository verweisen.
Für jede neue Version muss im Repository eine Release erzeugt werden, die aktuellste muss als "Latest" gekennzeichnet sein. 
Der Name der Release und das Tag müssen der Version entsprechen. Als Bestandteil der Release muss das Plugin-Zip als Release-Asset gespeichert werden. Im Plugin muss eine `plugin.json` existieren, die einen Versions-Eintrag enthält, der dem Release-Namen entspricht. 

Für den Dateinamen des Plugins kann mit `filename` ein Pattern angegeben werden, dann wird das entsprechende Release-Asset gewählt.

Beispiel: `avnav-testplugin-$version.zip`

Falls der Name (oder Release Tag) nicht exakt die Version ist sondern z.B. noch einen Prefix oder Suffix enthält, kann ein Parameter `release_pattern` angegeben werden. Das ist eine regular expression, deren erste Matchgrupppe als Version verwendet wird. Zur Vereinfachung können dabei  `#semver#` oder `#simple#` genutzt werden.

Beispiele:

| Release-Name | `release_pattern` | Version
| --- | --- | --- |
| v20260901 | v#simple# | 20260901 |
| release-0.0.1 | release-#semver# | 0.0.1 |


Der Katalog prüft jeden Tag, ob eine Release existiert, bestimmt die Version aus dem Release-Namen (wenn release_pattern angegeben ist wird auch noch alternativ das release_tag versucht) und prüft, ob ein Release-Asset mit dem Namen `filename` vorhanden ist.

Die zip-Datei wird heruntergeladen und es wird geprüft, das sie ein Plugin-Verzeichnis mit einer plugin.json mit korrekter Version enhält.

Bei Erfolg werden Version und Download-Link aktualisiert.

#### Update repository

Diese Update-Funktion liest die Repository-Metadaten und ermittelt darüber die Version.
Es werden entsprechende Download-Links für die Pakete erzeugt. Innerhalb von AvNav werden solche Installationen oder Updates über den [Updater](https://github.com/wellenvogel/avnav-update-plugin) ausgeführt. 

### Manueller Update

Wenn keine automatische Aktualisierung konfiguriert ist, muss der Eintrag durch den Autor manuell aktualisiert werden.

Die folgenden Felder beschreiben die für ein Update benötigten Informationen:

{% include plugin-fields-table.html fields="name,version,minversion,download_url" %}

Bei ZIP-Plugins muss die Download-URL angegeben werden, sofern sie sich geändert hat. Wenn für das Plugin der automatische Erkennungsmechanismus `github` oder `repository` gesetzt ist, ist kein manuelles Update nötig.

{% capture update_body %}{% include plugin-email-body.txt fields="name,version,minversion,download_url" update=true %}{% endcapture %}

Ein manuelles Update kann per E-Mail
{% include mailto.html
    subject="Plugin Update"
    text="avnav@wellenvogel.de"
    body=update_body
%}
oder per [Issue]({{site.github.repository_url}}/issues/new?template=UpdatePlugin.de.md) gemeldet werden.