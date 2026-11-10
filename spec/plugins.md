# Spec for the plugins.yml

plugins.yml is located in the _data folder.

It contains the currently known list of plugins. Only the repo owner can edit this list.
If the plugin entry contians a known `update` mode a GitHub action will update the plugin entry on a daily basis.

## The plugin entry and its fields

### name
**label**: en: Name,  de: Name

**type**: string

**visible**: card: yes, user input: yes user update: yes

**mandatory**

**short**: The name of the plugin like visible in AvNav.

**description**: This is the plugin name. It is the name being used as directory name on the server. For debian packages (type `package`) the plugin data must be located below /usr/lib/avnav/plugins/*name*. For type `zip` this must be the name of the first directory in the zip file where all the plugin files are contained.

### description
**label**: en: Description, de: Beschreibung

**type**; dictionary with entries for en and de

**visible**: card: yes (language specific dict entry), user input: both dict entries - at least one of them

**mandatory**: in user input at least one of both must be provided

**short**: Short description of the plugin (max. 80 characters)

**description**: A short description of the plugin functionality.

### version
**label**: en: Version,  de: Version

**type**: number or SemVer string

**visible**: card: yes, user input: yes, user update: yes

**mandatory**

**short**: The current plugin version.

**description**: Either a number like 20260708 or a [semver](https://semver.org/) version string. It must match the version that the plugin reports in plugin.json.

### author
**label**: en: Author,  de: Autor

**type**: string

**visible**: card: yes, user input: yes

**mandatory**: no

**short**: The authors name.

**description**: The name of the author. For a GitHub `src_url` this should be the GitHub user name.

### email
**label**: en: Email,  de: E-Mail

**type**: email

**visible**: card: yes, user input: yes

**mandatory**: Only mandatory if the user cannot be determined from the `src_url`.

**short**: Email address of the author. 

**description**: Email of the author. Mandatory if the author cannot be reached via the src_url (like on GitHub).

### license
**label**: en: License,  de: Lizenz

**type**: string

**visible**: card yes, user input: yes

**mandatory**: no

**short**: The license abbreviation (like MIT, GPLv2)

**description**: The license of the plugin.

### src_url
**label**: en: Source,  de: Quelle

**type**: URL

**visible**: card: yes as download, user input: yes

**mandatory**: no

**short**: The plugin source url.

**description**: URL for the source code. For GitHub based plugins this must be the repository URL.

### download_url
**label**: en: Download,  de: Herunterladen

**type**: URL, cancontain $version

**visible**: card yes as download, user input yes, user update: yes

**mandatory**: yes if plugin type is zip.

**short**: Download URL for the plugin.

**description**: The URL that the plugin can be downloaded from (exactly the version mentioned in version). Can contain $version as placeholder.

### documentation
**label**: en: Documentation, de: Dokumentation

**type**: URL; may contain the `$version` placeholder, which is replaced with the current plugin version when the link is rendered.

**visible**: card: yes, as a documentation link; user input: yes

**mandatory**: no

**short**: URL of the plugin documentation.

**description**: Optional URL to the plugin documentation. If it contains `$version`, that placeholder is replaced with the current plugin version when the documentation link is rendered.

### minversion
**label**: en: Min. AvNav, de: Min. AvNav

**type**: String (optional nnn..nnn)

**visible**: card: yes, user input: yes, user update: yes

**mandatory**: no

**short**: Required AvNav version

**description**: The minimal required AvNav version. Optionally you can add a max AvNav version like 20120101..20260101.

### platform
**label**: en: Platform, de: Plattform

**type**: array of n of the keys from [platforms.yml](../docs/_data/platforms.yml)

**visible**: card yes, use the values from platforms.yml](../docs/_data/platforms.yml), user input: yes (using the keys)

**mandatory**: yes

**short**: The platform the plugin can run on.

**description**: This describes on which of the AvNav platforms the plugin can run on. `all` means all platforms.

### type
**label**:   en: Type,  de: Typ

**type**: one of `package`or `zip`

**mandatory**: yes

**short**: The type - `package` or `zip`.

**description**: How the plugin is packaged and delivered. `package`: debian package. `zip`: Zip File. Plugins of type `package` will become [system-plugins](https://www.wellenvogel.de/software/avnav/newDoc/latest/en/special/plugins.html#debian-packages), plugins of type `zip`will become [user-plugins](https://www.wellenvogel.de/software/avnav/newDoc/latest/en/special/plugins.html#zip-file).

### last_updated
**label**: en: Last updated,  de: Zuletzt aktualisiert

**type**: date string 

**mandatory**: no

**visible**: card: yes, user input: no

**short**: The last time that the plugin entry was updated.

**description**: Date and time of the last update of this plugin in the database.

### update
**type**: on from the list github,

**mandatory**: no

**visible**: card: no, user input: yes

**short**: Plugin info update mode.

**description**: How the plugin info in the database is updated.

`github`: src_url must point to a GitHub repository. The update expects a release to simply have the version number as name. It will check for new releases and update the `version` entry.
If a `filename` is provided (can contain $version) the update will look for a file matching the filename in the assets directory and will update `download_url` with the url of this file.

### filename
**type**: string

**visible**: card : no, user input yes

**mandatory**: no

**short**: Release assets file name.

**description**: if `update`is `github` search for this file in the release assets and replace `download_url` with the URL of this file. The filename can contain $version as placeholder.


## Updates

The known update types and their handling is described below.

To run the update change to the base directory and run

```
npm --prefix tools run update -- docs/_data/plugins.yml .updated
```

This command is also run by the daily GitHub action.

### github

The update will consider the `src_url` being a GitHub repository and will determine the latest release. It will consider the release name being the version. If it differs from the current version it will update `version` and `last_updated`. Only valid for type `zip`.

If `documentation` contains `$version`, the rendered documentation link follows the current version automatically; the stored `documentation` value is not changed by the update.


### Agents

If this file is changed, update the corresponding schema and UI surfaces as needed, including:

- `/docs/_data/cards.yml`
- `/docs/_data/plugin_fields.yml`
- `/docs/_includes/list-container.html`
- the email and issue templates that collect user input

Keep links in descriptions where possible.

- `visible: user input` means the field appears when creating a plugin (email and issue templates).
- `visible: user update` means the field appears when requesting a plugin update (email and issue templates).

**translation hints**: keep SemVer in english and german.


