import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import YAML from "yaml";
import { expandPattern, matchVersion } from "./version_pattern.js";

const configUrl = new URL("../docs/_data/packages.yml", import.meta.url);

function compareDigits(a, b) {
  a = a.replace(/^0+/, "");
  b = b.replace(/^0+/, "");
  return Math.sign(a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);
}

function comparePart(a, b) {
  let i = 0;
  let j = 0;
  const order = (char) => {
    if (char === "~") return -1;
    if (!char || /[0-9]/.test(char)) return 0;
    const code = char.charCodeAt(0);
    return /[a-zA-Z]/.test(char) ? code : code + 256;
  };
  while (i < a.length || j < b.length) {
    while ((i < a.length && !/[0-9]/.test(a[i])) || (j < b.length && !/[0-9]/.test(b[j]))) {
      const difference = order(a[i]) - order(b[j]);
      if (difference) return Math.sign(difference);
      if (i < a.length && !/[0-9]/.test(a[i])) i++;
      if (j < b.length && !/[0-9]/.test(b[j])) j++;
    }
    const startA = i;
    const startB = j;
    while (i < a.length && /[0-9]/.test(a[i])) i++;
    while (j < b.length && /[0-9]/.test(b[j])) j++;
    const difference = compareDigits(a.slice(startA, i), b.slice(startB, j));
    if (difference) return difference;
  }
  return 0;
}

export function compareVersions(a, b) {
  const parts = (version) => {
    const colon = version.indexOf(":");
    const epoch = colon < 0 ? "0" : version.slice(0, colon);
    const rest = colon < 0 ? version : version.slice(colon + 1);
    const hyphen = rest.lastIndexOf("-");
    return [epoch, hyphen < 0 ? rest : rest.slice(0, hyphen), hyphen < 0 ? "0" : rest.slice(hyphen + 1)];
  };
  const left = parts(a);
  const right = parts(b);
  return compareDigits(left[0], right[0]) || comparePart(left[1], right[1]) || comparePart(left[2], right[2]);
}

function packageIndex(text, packageName) {
  const matches = [];
  for (const paragraph of text.split(/\r?\n[ \t]*\r?\n/)) {
    const fields = {};
    for (const line of paragraph.split(/\r?\n/)) {
      if (!line || /^[ \t]/.test(line)) continue;
      const match = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(line);
      if (!match) throw new Error(`Invalid package index line: ${line}`);
      fields[match[1].toLowerCase()] = match[2];
    }
    if (fields.package !== packageName) continue;
    if (!fields.version || !fields.filename) {
      throw new Error(`Package ${packageName} has no version or filename in index`);
    }
    if (!/^(?:\d+:)?[0-9][A-Za-z0-9.+:~\-]*$/.test(fields.version)) {
      throw new Error(`Invalid Debian version for ${packageName}: ${fields.version}`);
    }
    if (fields.filename.startsWith("/") || fields.filename.split("/").includes("..") ||
        /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(fields.filename)) {
      throw new Error(`Invalid package filename for ${packageName}: ${fields.filename}`);
    }
    matches.push(fields);
  }
  return matches.reduce((latest, item) =>
    !latest || compareVersions(item.version, latest.version) > 0 ? item : latest, undefined);
}

async function downloadIndex(base, distribution, directory) {
  const indexUrl = new URL(`dists/${distribution}/${directory}/Packages`, base);
  const compressedUrl = `${indexUrl.href}.gz`;
  let response = await fetch(compressedUrl);
  if (response.status === 404) {
    response = await fetch(indexUrl);
    if (!response.ok) throw new Error(`Package index request failed for ${indexUrl}: ${response.status} ${response.statusText}`);
    return await response.text();
  }
  if (!response.ok) throw new Error(`Package index request failed for ${compressedUrl}: ${response.status} ${response.statusText}`);
  return gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
}

async function fetchIndex(base, distribution, directory, cache) {
  if (!cache) return downloadIndex(base, distribution, directory);
  const key = new URL(`dists/${distribution}/${directory}/Packages`, base).href;
  if (!cache.has(key)) {
    const request = downloadIndex(base, distribution, directory);
    cache.set(key, request);
    try {
      return await request;
    } catch (error) {
      if (cache.get(key) === request) cache.delete(key);
      throw error;
    }
  }
  return await cache.get(key);
}

export default async function updateRepository(entry, options = {}) {
  if (entry.type !== "package") throw new Error(`Repository updater requires type package for ${entry.name}`);
  const repository = entry.repository;
  if (!repository || typeof repository !== "object" || Array.isArray(repository)) {
    throw new Error(`Repository configuration is missing or invalid for ${entry.name}`);
  }
  if (typeof repository.package !== "string" || !/^[a-z0-9][a-z0-9+.-]+$/.test(repository.package)) {
    throw new Error(`Invalid repository package name for ${entry.name}`);
  }
  if (repository.variants != null && (!Array.isArray(repository.variants) ||
      repository.variants.some((variant) => typeof variant !== "string" || !/^[a-z0-9-]+\.[a-z0-9-]+$/.test(variant)) ||
      new Set(repository.variants).size !== repository.variants.length)) {
    throw new Error(`Invalid repository variants for ${entry.name}`);
  }
  let versionExpression;
  if (repository.version_pattern != null) {
    if (typeof repository.version_pattern !== "string" || !repository.version_pattern.length) {
      throw new TypeError(`Invalid repository version_pattern for ${entry.name}: expected a non-empty string`);
    }
    const expanded = expandPattern(repository.version_pattern);
    try {
      versionExpression = new RegExp(expanded);
    } catch (error) {
      throw new Error(`Invalid repository version_pattern ${JSON.stringify(repository.version_pattern)} for ${entry.name}: ${error.message}`, { cause: error });
    }
  }
  const config = YAML.parse(await readFile(configUrl, "utf8"));
  let selectedVariants = repository.variants;
  if (selectedVariants == null || selectedVariants.length === 0) {
    if (!config?.variants || typeof config.variants !== "object" || Array.isArray(config.variants)) {
      throw new Error("Missing or invalid repository variants configuration");
    }
    selectedVariants = [];
    for (const [distribution, architectures] of Object.entries(config.variants)) {
      if (!architectures || typeof architectures !== "object" || Array.isArray(architectures)) {
        throw new Error(`Invalid repository variants configuration for ${distribution}`);
      }
      for (const architecture of Object.keys(architectures)) {
        selectedVariants.push(`${distribution}.${architecture}`);
      }
    }
    if (selectedVariants.length === 0) throw new Error("No repository variants configured");
  }
  const baseValue = repository.url ?? config?.repositories?.default;
  if (typeof baseValue !== "string" || !baseValue) throw new Error("Missing Debian repository URL");
  const base = new URL(baseValue);
  if (!["http:", "https:"].includes(base.protocol) || base.search || base.hash || base.username || base.password) {
    throw new Error(`Invalid Debian repository URL for ${entry.name}`);
  }
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const variants = selectedVariants.map((variant) => {
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(variant)) {
      throw new Error(`Unknown or invalid repository variant: ${variant}`);
    }
    const [distribution, architecture] = variant.split(".");
    const directory = config?.variants?.[distribution]?.[architecture];
    if (typeof directory !== "string" || !/^[a-z0-9-]+\/binary-[a-z0-9-]+$/.test(directory)) {
      throw new Error(`Unknown or invalid repository variant: ${variant}`);
    }
    return { variant, distribution, directory };
  });
  const available = {};
  let highest;
  for (const { variant, distribution, directory } of variants) {
    const text = await fetchIndex(base, distribution, directory, options.repositoryIndexCache);
    const item = packageIndex(text, repository.package);
    if (!item) continue;
    available[variant] = {
      package_name: item.package,
      version: item.version,
      download_url: new URL(item.filename, base).href,
    };
    if (!highest || compareVersions(item.version, highest) > 0) highest = item.version;
  }
  if (!highest) throw new Error(`Package ${repository.package} was not found in any requested variant`);
  const version = versionExpression ? matchVersion(versionExpression, highest) : highest;
  if (!version) {
    throw new Error(`Could not extract a version from package version ${JSON.stringify(highest)} for ${entry.name} using version_pattern ${JSON.stringify(repository.version_pattern)}`);
  }
  const updates = {};
  if (String(entry.version) !== version) updates.version = version;
  if (!isDeepStrictEqual(repository.available, available)) updates.repository = { ...repository, available };
  if (Object.keys(updates).length === 0) return undefined;
  updates.last_updated = new Date().toISOString();
  return updates;
}
