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

## Eintrag in die Liste

Die folgenden Felder beschreiben die für einen Katalogeintrag benötigten Informationen:

{% include plugin-fields-table.html %}

Die Informationen können per E-Mail gesendet werden; alternativ kann in diesem Repository ein [Issue](#TODO) geöffnet werden.

{% capture email_body %}{% include plugin-email-body.txt %}{% endcapture %}
{% include mailto.html
    subject="Neues Plugin"
    text="avnav@wellenvogel.de"
    body=email_body
%}
