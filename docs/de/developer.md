---
  layout: default
  lang: de
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

gesendet werden; alternativ kann in diesem Repository ein [Issue]({{site.github.repository_url}}/issues/new?template=AddPlugin) geöffnet werden.

## Update eines Plugins

Die folgenden Felder beschreiben die für ein Update benötigten Informationen:

{% include plugin-fields-table.html fields="name,version,download_url" %}

Bei ZIP-Plugins muss die Download-URL angegeben werden, sofern sie sich geändert hat. Wenn für das Plugin der automatische Erkennungsmechanismus `github` gesetzt ist, ist kein manuelles Update nötig.

{% capture update_body %}{% include plugin-email-body.txt fields="name,version,download_url" update=true %}{% endcapture %}

Ein manuelles Update kann per E-Mail
{% include mailto.html
    subject="Plugin Update"
    text="avnav@wellenvogel.de"
    body=update_body
%}
oder per [Issue]({{site.github.repository_url}}/issues/new?template=UpdatePlugin) gemeldet werden.