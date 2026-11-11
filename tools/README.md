# Catalog updater

From the repository root, run:

```sh
npm --prefix tools run update -- docs/_data/plugins.yml .updated
```

To authenticate GitHub API requests, supply an access token with `-a`:

```sh
npm --prefix tools run update -- -a "$GITHUB_TOKEN" docs/_data/plugins.yml .updated
```

Without a token, requests are anonymous. The daily GitHub action uses its
`GITHUB_TOKEN`. Use a token with access to the repositories being queried;
the workflow token's access is limited to the current repository and public
repositories. Command-line arguments may be visible to other users or saved in
shell history, so avoid typing a token directly.

## Update checks

When an updater proposes changed fields, the updater loads
`check_<type>.js` and calls its default-exported async function with the
complete proposed plugin entry and the updater options. The checker must
throw an error to reject the update; its return value is ignored. A failed
check is recorded in the marker and other plugins are still processed. A
missing or invalid checker is an error. Entries without actual changes are
not checked by default. Per-plugin errors in the console and marker identify
the failing phase (`update` or `check`) and its update mode or proposed plugin
type.
The console logs each updater result before checking and the proposed entry
passed to each checker. Runtime options, including the access token, are not
included in these logs.

Use `-c` to check every entry, including unchanged entries and entries whose
update failed. Changed entries are checked once, with their proposed values;
if updating fails, the existing entry is checked. Use `-n` to skip updates and
check every existing entry without modifying the catalog. `-c` and `-n` can
also be combined:

```sh
npm --prefix tools run update -- -c -n docs/_data/plugins.yml .updated
```

The marker is created for errors (including check-only errors) or accepted
updates; successful checks alone do not create a marker.

The `zip` checker downloads the proposed `download_url` (substituting
`$version`) and reads only `<name>/plugin.json` from the archive. It rejects
missing or invalid metadata and version mismatches. The `package` checker is
currently a placeholder and accepts all updates.
