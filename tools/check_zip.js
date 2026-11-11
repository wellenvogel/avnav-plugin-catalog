import { promisify } from "node:util";
import yauzl from "yauzl";

const openZip = promisify(yauzl.fromBuffer);

async function readPluginJson(zip, expectedPath) {
  let contents;
  for await (const entry of zip.eachEntry()) {
    if (entry.fileName !== expectedPath) {
      continue;
    }
    if (contents !== undefined) {
      throw new Error(`ZIP contains multiple ${expectedPath} entries`);
    }
    const stream = await new Promise((resolve, reject) => {
      zip.openReadStream(entry, (error, result) => error ? reject(error) : resolve(result));
    });
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    contents = Buffer.concat(chunks).toString("utf8");
  }
  if (contents === undefined) {
    throw new Error(`ZIP does not contain ${expectedPath}`);
  }
  return contents;
}

export default async function checkZip(entry) {
  if (typeof entry.name !== "string" || !entry.name || entry.name === "." ||
      entry.name === ".." || /[/\\]/.test(entry.name)) {
    throw new Error("ZIP check requires a valid plugin directory name");
  }
  if ((typeof entry.version !== "string" && typeof entry.version !== "number") ||
      String(entry.version).length === 0 || (typeof entry.version === "number" && !Number.isFinite(entry.version))) {
    throw new Error(`ZIP check requires a valid version for ${entry.name}`);
  }
  if (typeof entry.download_url !== "string" || !entry.download_url) {
    throw new Error(`ZIP check requires a download_url for ${entry.name}`);
  }
  const url = entry.download_url.split("$version").join(String(entry.version));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ZIP download failed for ${entry.name}: ${response.status} ${response.statusText}`);
  }
  const zip = await openZip(Buffer.from(await response.arrayBuffer()), { lazyEntries: true });
  let contents;
  try {
    contents = await readPluginJson(zip, `${entry.name}/plugin.json`);
  } finally {
    zip.close();
  }
  let metadata;
  try {
    metadata = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid plugin.json in ZIP for ${entry.name}: ${error.message}`, { cause: error });
  }
  const version = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata.version : undefined;
  if ((typeof version !== "string" && typeof version !== "number") ||
      String(version).length === 0 || (typeof version === "number" && !Number.isFinite(version))) {
    throw new Error(`plugin.json in ZIP for ${entry.name} has no valid version`);
  }
  if (String(version) !== String(entry.version)) {
    throw new Error(`ZIP plugin.json version ${JSON.stringify(version)} does not match catalog version ${JSON.stringify(entry.version)} for ${entry.name}`);
  }
}
