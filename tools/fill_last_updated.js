import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

export async function fillLastUpdated(pluginsFile) {
  const source = await readFile(pluginsFile, "utf8");
  const document = YAML.parseDocument(source);
  if (document.errors.length > 0) {
    throw new AggregateError(document.errors, `Failed to parse ${pluginsFile}`);
  }
  const entries = document.toJS();
  if (!Array.isArray(entries)) {
    throw new TypeError(`Expected ${pluginsFile} to contain a YAML list`);
  }

  for (const entry of entries) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`Expected every entry in ${pluginsFile} to be an object`);
    }
  }

  const timestamp = new Date().toISOString();
  let count = 0;
  for (const [index, entry] of entries.entries()) {
    if (entry.last_updated === undefined || entry.last_updated === null || entry.last_updated === "") {
      document.setIn([index, "last_updated"], timestamp);
      count += 1;
    }
  }

  if (count > 0) {
    await writeFile(pluginsFile, document.toString({ lineWidth: 0, flowCollectionPadding: false }), "utf8");
  }
  return count;
}

async function main() {
  const [, , pluginsArg] = process.argv;
  if (!pluginsArg || process.argv.length !== 3) {
    throw new Error("Usage: node tools/fill_last_updated.js <plugins.yml>");
  }
  const count = await fillLastUpdated(path.resolve(pluginsArg));
  console.log(`Updated ${count} plugin ${count === 1 ? "entry" : "entries"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Failed to fill last_updated: ${error.message}`);
    process.exitCode = 1;
  });
}
