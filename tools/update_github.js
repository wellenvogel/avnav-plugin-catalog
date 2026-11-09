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
  if (!Array.isArray(release.assets)) {
    throw new Error(`Latest GitHub release for ${entry.src_url} has an invalid assets list`);
  }

  console.log(`Latest release for ${entry.name}: ${release.name}`);
  console.log(`Release assets for ${entry.name}:`);
  for (const asset of release.assets) {
    console.log(`- ${asset.name}: ${asset.browser_download_url}`);
  }

  const updates = {};
  if (release.name !== String(entry.version)) {
    updates.version = release.name;
  }

  if (entry.filename !== undefined && entry.filename !== null && entry.filename !== "") {
    if (typeof entry.filename !== "string") {
      throw new TypeError(`Invalid release asset filename for ${entry.name}: expected a string`);
    }
    const filename = entry.filename.split("$version").join(release.name);
    const asset = release.assets.find((candidate) => candidate.name === filename);
    if (!asset) {
      throw new Error(`Release asset "${filename}" not found for ${entry.name}`);
    }
    if (typeof asset.browser_download_url !== "string" || !asset.browser_download_url) {
      throw new Error(`Release asset "${filename}" for ${entry.name} has no download URL`);
    }
    if (asset.browser_download_url !== entry.download_url) {
      updates.download_url = asset.browser_download_url;
    }
  }

  if (Object.keys(updates).length === 0) {
    return undefined;
  }

  updates.last_updated = new Date().toISOString();
  return updates;
}
