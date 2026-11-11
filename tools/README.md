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
