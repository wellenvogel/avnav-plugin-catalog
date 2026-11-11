---
  layout: default
  lang: en
  addlink:
    url: list.html
    title: 'Catalog'
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

You can send the information by email or open an [issue]({{site.github.repository_url}}/issues/new?template=AddPlugin.md) in this repository.

{% capture email_body %}{% include plugin-email-body.txt %}{% endcapture %}
{% include mailto.html
    subject="New Plugin"
    text="avnav@wellenvogel.de"
    body=email_body
%}

## Updating a plugin

Plugin catalog entries can be updated in two ways:

* Automatically
* Manually

### Automatic updates

An entry is updated automatically when a recognized update method is configured in the `update` field. The plugin then displays the 🔄 indicator. The currently available methods are `github` and `repository`.

#### GitHub updates

For this update method, `src_url` must point to a GitHub repository. For each new version, create a release in the repository and mark the most recent one as "Latest". The release name and tag must correspond to the version. Include the plugin zip as release asset in the release. The plugin must contain a `plugin.json` file with a version entry matching the release name.

You can specify a filename pattern using `filename`; the corresponding release asset will then be selected.

Example: `avnav-testplugin-$version.zip`

If the release name or tag is not exactly the version, for example because it contains a prefix or suffix, you can specify `release_pattern`. This is a regular expression whose first matching group is used as the version. For convenience, you can use `#semver#` or `#simple#`.

Examples:

| Release name | `release_pattern` | Version |
| --- | --- | --- |
| v20260901 | v#simple# | 20260901 |
| release-0.0.1 | release-#semver# | 0.0.1 |

Every day, the catalog checks for a release, determines the version from the release name (or, when `release_pattern` is specified, tries the release tag as an alternative), and checks for a release asset matching `filename`.

The ZIP file is downloaded and checked for a plugin directory containing a `plugin.json` with the correct version.

If the check succeeds, the version and download link are updated.

#### Repository updates

This update method reads the repository metadata to determine the version and creates download links for the packages. Within AvNav, such installations and updates are handled by the [Updater](https://github.com/wellenvogel/avnav-update-plugin).

### Manual updates

If no automatic update is configured, the author must update the entry manually.

The following fields describe the information needed for an update:

{% include plugin-fields-table.html fields="name,version,minversion,download_url" %}

For ZIP plugins, provide the download URL if it has changed. If the automatic `github` or `repository` update mode is enabled for the plugin, no manual update is needed.

{% capture update_body %}{% include plugin-email-body.txt fields="name,version,minversion,download_url" update=true %}{% endcapture %}

You can report a manual update by email
{% include mailto.html
    subject="Plugin Update"
    text="avnav@wellenvogel.de"
    body=update_body
%}
or by opening an [issue]({{site.github.repository_url}}/issues/new?template=UpdatePlugin.md).
