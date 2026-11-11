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

To fill missing, null, or empty `last_updated` values with the current UTC time, run from the repository root:

```
node tools/fill_last_updated.js docs/_data/plugins.yml
```

Existing non-empty values are preserved. The timestamp records when the field was filled, not necessarily when the plugin was last updated.

### update
**type**: on from the list github,

**mandatory**: no

**visible**: card: no, user input: yes

**short**: Plugin info update mode.

**description**: How the plugin info in the database is updated.

`github`: src_url must point to a GitHub repository. By default the release name is the version number; `release_pattern` can extract it from the name instead. The updater checks for new releases and updates the `version` entry.
If a `filename` is provided (can contain $version) the update will look for a file matching the filename in the assets directory and will update `download_url` with the url of this file.

`repository`: special update handling for packages, see `repositories`.

### filename
**type**: string

**visible**: card : no, user input yes

**mandatory**: no

**short**: Release assets file name.

**description**: if `update`is `github` search for this file in the release assets and replace `download_url` with the URL of this file. The filename can contain $version as placeholder.

### release_pattern
**type**: regexp pattern

**visible**: card no, user input: yes

**mandatory**: no

**short**: Regular Expression for version number

**description**: Only for update=`github`. A regular expression to extract the version number from the release name. You can use any regexp and include the predefined pattern `#semver#` or `#simple#`

--not for templates

_#semver#_: `((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?)`

Example: `v#semver#` for a release name of `v1.0.2-beta1`

_#simple#_: `([0-9]*)`

Example: `v#simple#` for a release name of `v20260101`.

Patterns use JavaScript regular expression syntax and match anywhere in the release name unless anchored. The first capturing group is the version; if there are no capturing groups, the entire match is the version. The predefined patterns each include a capturing group. If `release_pattern` is invalid, does not match, or yields an empty or unmatched version, the update fails.

If release_pattern is given first try the release name and if the matching fails try the release tag.
--end not for templates

### repository
**type**: dictionary - see description

**visible**: no

**mandatory**: no

**short**: Debian repository info

**description**: Only for type `package`. If this field is not empty the type field should show package [repository] on the cards.

-- not for templates
In this field we define which repository should have which variant. The update script should query the repositories and fetch the available information.

*structure*
```
  repository:
    url: #optional, otherwise default
    package: the-name-of-the-package #mandatory
    variants: [trixie.armhf,...]
    available: to be filled by updater with a list of variant: package
    version_pattern: a similar pattern to release_pattern to extract the final version from the package version. If not matching - error.
```
The variants must match entries from docs/_data/packages.yml. 
Updates should run when update==`repository`. It should fetch the package lists from the debian repository found at `url` (default: repositories.default from packages.yml). It should use the given variants, download the Package list for the variant from the debian repo, look for the package name and fill the `available`field with a dictionary (key is the variant) of:
   package_name:
   version:
   download_url

The mapping between variants and repository locations is in packages.yml.
The highest version being found should be used as the version in the update.
If a variant is not found, omit this. If no variant found handle this as error.

If no variants are given, default to all variants from packages.yml.

-- end not for templates


## Updates

The known update types and their handling is described below.

To run the update change to the base directory and run

```
npm --prefix tools run update -- docs/_data/plugins.yml .updated
```

This command is also run by the daily GitHub action.

The marker file is removed at the start of each run and created if there are updates or errors.
It contains an `UPDATED` section with one line per changed plugin and its changed fields,
and an `ERROR` section with one line per error. Sections without entries are omitted.
Field values and messages are JSON-encoded. Errors for individual plugins are reported
without preventing updates to other plugins.
The GitHub action uploads the marker as the `plugin-update-marker` workflow artifact
when it exists. It commits any catalog changes before failing the job if the marker
contains errors or the updater fails. GitHub notifications depend on the owner's
Actions notification settings.

### github

The update will consider the `src_url` being a GitHub repository and will determine the latest release. It uses the release name as the version unless `release_pattern` is set. If the extracted version differs from the current version it will update `version` and `last_updated`. Only valid for type `zip`.

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

**never change this file without explicit permission**

**translation hints**: keep SemVer in english and german.
