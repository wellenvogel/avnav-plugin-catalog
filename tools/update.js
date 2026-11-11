import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import YAML from "yaml";

// Keep the source layout: no folding of long lines, no padding inside [a, b]
const stringifyOptions = { lineWidth: 0, flowCollectionPadding: false };
const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));

async function loadModule(kind, name) {
  if (typeof name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new TypeError(`Invalid ${kind} module name: ${name}`);
  }

  const modulePath = path.join(toolsDirectory, `${kind}_${name}.js`);
  try {
    await access(modulePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    throw new Error(`Unknown ${kind} module: ${name}`, { cause: error });
  }

  const module = await import(pathToFileURL(modulePath).href);
  if (typeof module.default !== "function") {
    throw new TypeError(`${modulePath} must have a default-exported async function`);
  }
  return module.default;
}

async function updateEntry(entry, options) {
  console.log(`updateEntry parameters: ${JSON.stringify(entry)}`);

  if (!entry.update) {
    return undefined;
  }
  const updater = await loadModule("update", entry.update);
  return await updater(entry, options);
}

async function checkEntry(entry, options) {
  const checker = await loadModule("check", entry.type);
  await checker(entry, options);
}

export async function updatePlugins(pluginsFile, markerFile, updater = updateEntry, options = {}, checker = checkEntry) {
  await rm(markerFile, { force: true });
  const updatedRows = [];
  const errorRows = [];

  try {
    const source = await readFile(pluginsFile, "utf8");
    const document = YAML.parseDocument(source);
    if (document.errors.length > 0) {
      throw new AggregateError(document.errors, `Failed to parse ${pluginsFile}`);
    }
    const entries = document.toJS();
    if (!Array.isArray(entries)) {
      throw new TypeError(`Expected ${pluginsFile} to contain a YAML list`);
    }

    for (const [index, entry] of entries.entries()) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new TypeError(`Expected every entry in ${pluginsFile} to be an object`);
      }

      const recordError = (phase, moduleName, error) => {
        const message = error instanceof Error ? error.message : String(error);
        const name = entry.name ?? `entry ${index + 1}`;
        const label = `${phase} (${phase === "check" ? "type" : "mode"}: ${JSON.stringify(moduleName) ?? "undefined"})`;
        console.error(`${label} failed for ${name}:`, error);
        errorRows.push(`${JSON.stringify(name)}: ${JSON.stringify(`${label}: ${message}`)}`);
      };
      let changedFields = {};
      if (!options.skipUpdate) {
        try {
          const updates = await updater(structuredClone(entry), options);
          console.log(`Update result for ${JSON.stringify(entry.name ?? `entry ${index + 1}`)}: ${JSON.stringify(updates) ?? "undefined"}`);
          if (updates !== undefined && updates !== null) {
            if (
              typeof updates !== "object" ||
              Array.isArray(updates) ||
              ![Object.prototype, null].includes(Object.getPrototypeOf(updates))
            ) {
              throw new TypeError("The updater must return an object or no value");
            }
            changedFields = Object.fromEntries(
              Object.entries(updates).filter(([field, value]) => !isDeepStrictEqual(entry[field], value))
            );
          }
        } catch (error) {
          recordError("update", entry.update, error);
          if (!options.checkAll) {
            continue;
          }
        }
      }

      if (options.checkAll || options.skipUpdate || Object.keys(changedFields).length > 0) {
        const proposedType = Object.hasOwn(changedFields, "type") ? changedFields.type : entry.type;
        try {
          const proposed = structuredClone({ ...entry, ...changedFields });
          console.log(`Check entry parameters: ${JSON.stringify(proposed)}`);
          await checker(proposed, options);
        } catch (error) {
          recordError("check", proposedType, error);
          continue;
        }
      }

      if (Object.keys(changedFields).length > 0) {
        for (const [field, value] of Object.entries(changedFields)) {
          document.setIn([index, field], value);
        }
        updatedRows.push(`${JSON.stringify(entry.name ?? `entry ${index + 1}`)}: ${JSON.stringify(changedFields)}`);
      }
    }

    if (updatedRows.length > 0) {
      await writeFile(pluginsFile, document.toString(stringifyOptions), "utf8");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorRows.push(`"Updater": ${JSON.stringify(message)}`);
    try {
      await writeFile(markerFile, `ERROR\n${errorRows.join("\n")}\n`, "utf8");
    } catch (markerError) {
      throw new AggregateError([error, markerError], "Updater and marker file write failed");
    }
    throw error;
  }

  const sections = [];
  if (updatedRows.length > 0) {
    sections.push(`UPDATED\n${updatedRows.join("\n")}`);
  }
  if (errorRows.length > 0) {
    sections.push(`ERROR\n${errorRows.join("\n")}`);
  }
  if (sections.length > 0) {
    await writeFile(markerFile, `${sections.join("\n")}\n`, "utf8");
  }

  return updatedRows.length > 0;
}

async function main() {
  const usage = "Usage: node update.js [-c] [-n] [-a <access-token>] <plugins.yml> <marker-file>";
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        access: { type: "string", short: "a" },
        check: { type: "boolean", short: "c" },
        "no-update": { type: "boolean", short: "n" },
      },
      allowPositionals: true,
      tokens: true,
    });
  } catch {
    throw new Error(usage);
  }
  const [pluginsArg, markerArg] = parsed.positionals;
  if (!pluginsArg || !markerArg || parsed.positionals.length !== 2 ||
      parsed.tokens.filter((token) => token.kind === "option" && token.name === "access").length > 1 ||
      (parsed.values.access !== undefined && !parsed.values.access.trim())) {
    throw new Error(usage);
  }

  // npm run changes the cwd to the package directory; INIT_CWD is where the user started it
  const baseDirectory = process.env.npm_lifecycle_event && process.env.INIT_CWD
    ? process.env.INIT_CWD
    : process.cwd();
  const pluginsFile = path.resolve(baseDirectory, pluginsArg);
  const markerFile = path.resolve(baseDirectory, markerArg);
  const changed = await updatePlugins(pluginsFile, markerFile, updateEntry, {
    accessToken: parsed.values.access,
    checkAll: parsed.values.check,
    skipUpdate: parsed.values["no-update"],
  });
  console.log(changed ? "Plugin data updated." : "No plugin data changes.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Plugin update failed: ${error.message}`);
    process.exitCode = 1;
  });
}
