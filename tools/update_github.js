const releasePatterns = {
  "#semver#": String.raw`((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?)`,
  "#simple#": String.raw`([0-9]*)`,
};

function releaseVersion(entry, release) {
  if (entry.release_pattern === undefined || entry.release_pattern === null) {
    if (typeof release.name !== "string" || release.name.length === 0) {
      throw new Error(`Latest GitHub release for ${entry.src_url} has no name`);
    }
    return release.name;
  }
  const describe = (value) => JSON.stringify(value) ?? "undefined";
  const context = `release_pattern=${describe(entry.release_pattern)}, release name=${describe(release.name)}, release tag=${describe(release.tag_name)}`;
  if (typeof entry.release_pattern !== "string" || entry.release_pattern.length === 0) {
    throw new TypeError(`Invalid release_pattern for ${entry.name}: expected a non-empty string (${context})`);
  }
  const pattern = entry.release_pattern.replace(/#semver#|#simple#/g, (token) => releasePatterns[token]);
  let expression;
  try {
    expression = new RegExp(pattern);
  } catch (error) {
    throw new Error(`Invalid release_pattern for ${entry.name}: ${error.message} (${context}, expanded pattern=${describe(pattern)})`, { cause: error });
  }
  for (const candidate of [release.name, release.tag_name]) {
    if (typeof candidate !== "string" || candidate.length === 0) {
      continue;
    }
    const match = expression.exec(candidate);
    const version = match && (match.length > 1 ? match[1] : match[0]);
    if (version) {
      return version;
    }
  }
  throw new Error(`Could not extract a version from release name or tag for ${entry.name} using release_pattern (${context}, expanded pattern=${describe(pattern)})`);
}

export default async function updateGithub(entry, options = {}) {
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
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${entry.src_url}: ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  if (!release || typeof release !== "object" || Array.isArray(release)) {
    throw new Error(`Latest GitHub release for ${entry.src_url} is invalid`);
  }
  if (!Array.isArray(release.assets)) {
    throw new Error(`Latest GitHub release for ${entry.src_url} has an invalid assets list`);
  }

  console.log(`Latest release for ${entry.name}: ${release.name}`);
  console.log(`Release assets for ${entry.name}:`);
  for (const asset of release.assets) {
    console.log(`- ${asset.name}: ${asset.browser_download_url}`);
  }

  const version = releaseVersion(entry, release);
  const updates = {};
  if (version !== String(entry.version)) {
    updates.version = version;
  }

  if (entry.filename !== undefined && entry.filename !== null && entry.filename !== "") {
    if (typeof entry.filename !== "string") {
      throw new TypeError(`Invalid release asset filename for ${entry.name}: expected a string`);
    }
    const filename = entry.filename.split("$version").join(version);
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
