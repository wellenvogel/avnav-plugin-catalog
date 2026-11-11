import { parse } from "parse5";
import semver from "semver";
import { expandPattern, matchVersion } from "./version_pattern.js";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function elements(node, tagName, result = []) {
  if (node.tagName === tagName) result.push(node);
  for (const child of node.childNodes ?? []) elements(child, tagName, result);
  return result;
}

function href(element) {
  return element.attrs.find((attribute) => attribute.name === "href")?.value;
}

export default async function updateDirectory(entry) {
  if (typeof entry.directory !== "string" || !entry.directory.trim()) {
    throw new TypeError(`Invalid directory URL for ${entry.name}: expected a non-empty URL`);
  }
  let directory;
  try {
    directory = new URL(entry.directory);
  } catch (error) {
    throw new TypeError(`Invalid directory URL for ${entry.name}: ${entry.directory}`, { cause: error });
  }
  if (!["http:", "https:"].includes(directory.protocol)) {
    throw new TypeError(`Invalid directory URL for ${entry.name}: expected HTTP or HTTPS`);
  }
  if (typeof entry.filename !== "string" || !entry.filename) {
    throw new TypeError(`Invalid filename pattern for ${entry.name}: expected a non-empty string`);
  }
  const pattern = expandPattern(entry.filename);
  let expression;
  try {
    expression = new RegExp(`(?:${pattern})$`);
  } catch (error) {
    throw new Error(`Invalid filename pattern for ${entry.name}: ${JSON.stringify(entry.filename)} (expanded: ${JSON.stringify(pattern)}): ${error.message}`, { cause: error });
  }

  console.log(`Fetching directory for ${entry.name} from ${directory.href}`);
  const response = await fetch(directory.href);
  if (!response.ok) {
    throw new Error(`Directory request failed for ${directory.href}: ${response.status} ${response.statusText}`);
  }
  const document = parse(await response.text());
  const responseUrl = response.url || directory.href;
  const baseHref = elements(document, "base").map(href).find((value) => value !== undefined);
  const base = baseHref === undefined ? responseUrl : new URL(baseHref, responseUrl).href;
  const candidates = [];
  for (const anchor of elements(document, "a")) {
    const value = href(anchor);
    if (!value) continue;
    let url;
    try {
      url = new URL(value, base);
    } catch (error) {
      throw new Error(`Invalid link in directory ${directory.href}: ${JSON.stringify(value)}`, { cause: error });
    }
    if (!["http:", "https:"].includes(url.protocol)) continue;
    let filename;
    try {
      filename = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf("/") + 1));
    } catch (error) {
      throw new Error(`Invalid URL encoding in directory link ${url.href}`, { cause: error });
    }
    const version = matchVersion(expression, filename);
    if (!version) continue;
    candidates.push({ version, downloadUrl: url.href });
  }
  if (!candidates.length) {
    throw new Error(`No version found in ${directory.href} for ${entry.name} using filename pattern ${JSON.stringify(entry.filename)} (expanded: ${JSON.stringify(pattern)})`);
  }
  const compareVersions = candidates.every(({ version }) => semver.valid(version))
    ? semver.compare
    : (left, right) => collator.compare(left, right);
  const latest = candidates.reduce((best, candidate) =>
    compareVersions(candidate.version, best.version) > 0 ? candidate : best);
  const updates = {};
  if (String(entry.version) !== latest.version) updates.version = latest.version;
  const currentUrl = typeof entry.download_url === "string"
    ? entry.download_url.split("$version").join(latest.version)
    : entry.download_url;
  if (currentUrl !== latest.downloadUrl) updates.download_url = latest.downloadUrl;
  if (!Object.keys(updates).length) return undefined;
  updates.last_updated = new Date().toISOString();
  return updates;
}
