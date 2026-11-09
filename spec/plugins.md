# Spec for the plugins.yml

plugins.yml is located in the _data folder.

It contains the currently known list of plugins. Only the repo owner can edit this list.
If the plugin entry contians a known `update` mode a GitHub action will update the plugin entry on a daily basis.

## The plugin entry and its fields

| Field | Visible | Type/Structure | Description |
| --- | --- | --- | ---|
| name | yes | string | the name of the plugin. This must match the name as it is seen in AvNav |
| description | yes | dict with subkeys for en, de | A short description for the plugin <~80 chars |
| version | yes | string or number | The plugin version. Either a number like 20260708 or a [semver](https://semver.org/) version string. It must match the version that the plugin reports in plugin.json |
| author | yes optional | string| A name of the author. |
| email | yes optional | email address | An email address of the author. Mandatory if no src_url is given or the author cannot be reached via src_url |
| license | yes optional | string | License abbreviation |
| src_url | yes optional | url string | URL to the plugin source code. For update `github` this must be the GitHub repository URL |
| download_url | yes optioonal | url string | A download URL for the plugin if the type is `zip` (mandatory for this type). The URL can contain $version as placeholder. This will be replaced with the `version` string.|
| platform | yes, texts in _data/platforms.yml| array of strings | The platforms that this plugin can run on. Only values from _data/platforms.yml are valid. Special value: `all`|
| type | yes | string | Type of plugin. Either `zip` or `package` |
|last_updated| yes translated to local time | time string | The time the entry was last updated | 
| update | no | string | Any known update type. Currently: `github`|

There can be further fields only necessary/recognized by particular update types. They will normally not be visible.

## Updates

The known update types and their handling is described below.

To run the update change to the base directory and run

```
npm --prefix tools run update -- docs/_data/plugins.yml .updated
```

This command is also run by the daily GitHub action.

### github

The update will consider the `src_url` being a GitHub repository and will determine the latest release. It will consider the release name being the version. If it differs from the current version it will update `version` and `last_updated`. Only valid for type `zip`.

**Additional fields**:

| Name | type | Description |
| --- | --- | --- |
| pattern | string | a file name pattern that can contain $version to be replaced with the release name. If there is a file with this pattern in the release assets `download_url` will be replaced with the URL for this file. Pattern must be a .zip file. |



