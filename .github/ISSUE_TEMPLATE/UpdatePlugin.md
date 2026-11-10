---
name: UpdatePlugin
about: Request updating a plugin in the AvNav plugin catalog
title: "[Plugin] Update "
labels: update plugin
---

Please update the following information in the plugin catalog:

**name** (Required. The plugin name as shown in AvNav is also its directory name on the server. For `package` plugins, the files must be under `/usr/lib/avnav/plugins/<name>`. For `zip` plugins, it must be the name of the top-level directory containing all plugin files in the ZIP archive.):
>

**version** (Required. A number or [SemVer](https://semver.org/) version string matching the version reported in `plugin.json`.):
>

**minversion** (Optional minimum required AvNav version. You can optionally specify a maximum version as a range, for example `20120101..20260101`.):
>

**download_url** (Required for `zip`. A download URL; `$version` is replaced with the plugin version.):
>
