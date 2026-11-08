import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import YAML from "yaml";

// Keep the source layout: no folding of long lines, no padding inside [a, b]
const stringifyOptions = { lineWidth: 0, flowCollectionPadding: false };
const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));

async function updateEntry(entry) {
  console.log(`updateEntry parameters: ${JSON.stringify(entry)}`);

  if (!entry.update) {
    return undefined;
  }
  if (typeof entry.update !== "string" || !/^[a-zA-Z0-9_-]+$/.test(entry.update)) {
    throw new TypeError(`Invalid update module name: ${entry.update}`);
  }

  const modulePath = path.join(toolsDirectory, `update_${entry.update}.js`);
  try {
    await access(modulePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return undefined;
  }

  try {
    const updateModule = await import(pathToFileURL(modulePath).href);
    if (typeof updateModule.default !== "function") {
      throw new TypeError(`${modulePath} must have a default-exported async function`);
    }
    return await updateModule.default(entry);
  } catch (error) {
    console.error(
      `Update failed for ${entry.name ?? "unknown plugin"} using ${entry.update}:`,
      error
    );
    return undefined;
  }
}

export async function updatePlugins(pluginsFile, markerFile, updater = updateEntry) {
  await rm(markerFile, { force: true });
  const source = await readFile(pluginsFile, "utf8");
  const document = YAML.parseDocument(source);
  if (document.errors.length > 0) {
    throw new AggregateError(document.errors, `Failed to parse ${pluginsFile}`);
  }
  const entries = document.toJS();
  if (!Array.isArray(entries)) {
    throw new TypeError(`Expected ${pluginsFile} to contain a YAML list`);
  }

  let changed = false;

  for (const [index, entry] of entries.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`Expected every entry in ${pluginsFile} to be an object`);
    }

    const updates = await updater(structuredClone(entry));
    if (updates === undefined || updates === null) {
      continue;
    }
    if (
      typeof updates !== "object" ||
      Array.isArray(updates) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(updates))
    ) {
      throw new TypeError("The updater must return an object or no value");
    }

    for (const [field, value] of Object.entries(updates)) {
      if (!isDeepStrictEqual(entry[field], value)) {
        document.setIn([index, field], value);
        changed = true;
      }
    }
  }

  if (changed) {
    await writeFile(pluginsFile, document.toString(stringifyOptions), "utf8");
    await writeFile(markerFile, "", "utf8");
  }

  return changed;
}

async function main() {
  const [, , pluginsArg, markerArg] = process.argv;
  if (!pluginsArg || !markerArg || process.argv.length !== 4) {
    throw new Error("Usage: node update.js <plugins.yml> <marker-file>");
  }

  // npm run changes the cwd to the package directory; INIT_CWD is where the user started it
  const baseDirectory = process.env.npm_lifecycle_event && process.env.INIT_CWD
    ? process.env.INIT_CWD
    : process.cwd();
  const pluginsFile = path.resolve(baseDirectory, pluginsArg);
  const markerFile = path.resolve(baseDirectory, markerArg);
  const changed = await updatePlugins(pluginsFile, markerFile);
  console.log(changed ? "Plugin data updated." : "No plugin data changes.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Plugin update failed: ${error.message}`);
    process.exitCode = 1;
  });
}
