---
  layout: default
  lang: en
---
# Notes for plugin developers

To add a plugin to this list, it must meet a few conditions and you must provide some information.

For details on developing plugins, see the [AvNav documentation]({{ site.avnav_docbase_en | append: site.data.doclinks.create.url.en }}).

## Conditions

To be included in this list, a plugin must meet the following conditions:

1. The developer must be willing to maintain the plugin and support users when needed. Users must be able to contact the developer through GitHub or email.

2. The plugin must be available either as a Debian package in our repository (subject to a separate agreement) or as a ZIP download.

3. The plugin must provide a description that is available online.

4. The plugin must follow privacy rules. In particular, it must not store data online without the user's consent.

## Adding a plugin

The following fields describe the information needed for a catalog entry:

{% include plugin-fields-table.html %}

You can send the information by email or open an [issue](#TODO) in this repository.

{% capture email_body %}{% include plugin-email-body.txt %}{% endcapture %}
{% include mailto.html
    subject="New Plugin"
    text="avnav@wellenvogel.de"
    body=email_body
%}
