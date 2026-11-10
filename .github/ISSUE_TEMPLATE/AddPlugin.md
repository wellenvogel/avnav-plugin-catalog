---
name: AddPlugin
about: Request adding a plugin to the AvNav plugin catalog
title: "[Plugin] Add "
labels: new plugin
---

Please provide the following information for the plugin catalog:

**name** (Required. The plugin name as shown in AvNav is also its directory name on the server. For `package` plugins, the files must be under `/usr/lib/avnav/plugins/<name>`. For `zip` plugins, it must be the name of the top-level directory containing all plugin files in the ZIP archive.):
>

**description** (Required. Provide a short description of the plugin's functionality in at least one of `en` or `de`, with at most 80 characters per description.):
>

**version** (Required. A number or [SemVer](https://semver.org/) version string matching the version reported in `plugin.json`.):
>

**platform** (Required. List supported platforms: `android`, `linux`, `windows`, `raspberry`, or `all`. `all` means every platform.):
>

**type** (Required. The plugin distribution type is `zip` or `package`. Debian `package` plugins become [system plugins](https://www.wellenvogel.de/software/avnav/newDoc/latest/en/special/plugins.html#debian-packages); `zip` plugins become [user plugins](https://www.wellenvogel.de/software/avnav/newDoc/latest/en/special/plugins.html#zip-file).):
>

**download_url** (Required for `zip`. A download URL; `$version` is replaced with the plugin version.):
>

**documentation** (Optional URL to the plugin documentation. If it contains `$version`, that placeholder is replaced with the current plugin version when the link is rendered.):
>

**minversion** (Optional minimum required AvNav version. You can optionally specify a maximum version as a range, for example `20120101..20260101`.):
>

**src_url** (Optional. URL of the source code; for a GitHub-based plugin it must be the GitHub repository URL.):
>

**author** (Optional. Name of the plugin author; for a GitHub `src_url`, this should be the GitHub username.):
>

**email** (Required when `src_url` is missing or the author cannot be contacted through it; otherwise optional.):
>

**license** (Optional. An abbreviation identifying the plugin license.):
>

**update** (Optional. `github` checks the repository in `src_url` for releases named with the version number and updates `version`. It is valid for `zip` plugins only. If `filename` is provided, a matching release asset also updates `download_url`.):
>

**filename** (Optional for `github`. Search release assets for this filename and set `download_url` to the matching asset URL. The filename may contain `$version` as a placeholder.):
>
