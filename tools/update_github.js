export default async function updateGithub(entry) {
  const sourceUrl = new URL(entry.src_url);
  if (sourceUrl.hostname !== "github.com") {
    throw new Error(`Expected a GitHub repository URL, got: ${entry.src_url}`);
  }

  const [owner, repository, ...extraPath] = sourceUrl.pathname
    .split("/")
    .filter(Boolean);
  if (!owner || !repository || extraPath.length > 0) {
    throw new Error(`Expected a GitHub repository URL, got: ${entry.src_url}`);
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository.replace(/\.git$/, ""))}/releases/latest`;
  console.log(`Fetching latest release for ${entry.name} from ${apiUrl}`);
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "avnav-plugin-catalog",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${entry.src_url}: ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  if (!release || typeof release.name !== "string" || release.name.length === 0) {
    throw new Error(`Latest GitHub release for ${entry.src_url} has no name`);
  }

  console.log(`Latest release for ${entry.name}: ${release.name}`);
  console.log(`Release assets for ${entry.name}:`);
  for (const asset of release.assets ?? []) {
    console.log(`- ${asset.name}: ${asset.browser_download_url}`);
  }

  if (release.name === String(entry.version)) {
    return undefined;
  }

  return {
    version: release.name,
    last_updated: new Date().toISOString(),
  };
}
