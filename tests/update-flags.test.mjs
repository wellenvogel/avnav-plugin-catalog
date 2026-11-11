import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const script = fileURLToPath(new URL("../tools/update.js", import.meta.url));

test("CLI flags control checking and updates", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-flags-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const source = '- name: bad\n  type: unknown\n  update: missing_module\n- name: ok\n  type: package\n';
  try {
    for (const flags of [[], ["-c"], ["-n"], ["-c", "-n"]]) {
      await writeFile(plugins, source);
      await run(process.execPath, [script, ...flags, plugins, marker]);
      const report = await readFile(marker, "utf8");
      assert.equal(report.includes("Unknown update module"), !flags.includes("-n"));
      assert.equal(report.includes("Unknown check module"), flags.includes("-c") || flags.includes("-n"));
      assert.equal(await readFile(plugins, "utf8"), source);
    }

    await writeFile(plugins, '- name: ok\n  type: package\n  update: missing_module\n');
    await run(process.execPath, [script, plugins, marker, "-n"]);
    await assert.rejects(readFile(marker), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
