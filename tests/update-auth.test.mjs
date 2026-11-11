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

test("CLI passes optional token through the dispatcher to GitHub requests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-auth-"));
  const catalog = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const capture = path.join(directory, "headers.json");
  const preload = path.join(directory, "fetch.mjs");
  const token = "test-access-token";
  try {
    await writeFile(preload, `
import { writeFile } from "node:fs/promises";
globalThis.fetch = async (url, options) => {
  await writeFile(process.env.CAPTURE, JSON.stringify({ url, headers: options.headers }));
  return { ok: true, json: async () => ({ name: "2.0", assets: [] }) };
};
`);
    const source = '- name: example\n  type: package\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  update: github\n';
    const invoke = async (args) => {
      await writeFile(catalog, source);
      return run(process.execPath, ["--import", preload, script, ...args], {
        env: { ...process.env, CAPTURE: capture },
      });
    };

    for (const args of [[catalog, marker], ["-a", token, catalog, marker], [catalog, marker, "-a", token]]) {
      const { stdout, stderr } = await invoke(args);
      const request = JSON.parse(await readFile(capture, "utf8"));
      assert.equal(request.url, "https://api.github.com/repos/owner/repo/releases/latest");
      assert.equal(request.headers.Authorization, args.includes("-a") ? `Bearer ${token}` : undefined);
      assert.equal(request.headers.Accept, "application/vnd.github+json");
      assert.equal(request.headers["User-Agent"], "avnav-plugin-catalog");
      assert.doesNotMatch(stdout + stderr + await readFile(marker, "utf8") + await readFile(catalog, "utf8"), /test-access-token/);
    }

    for (const args of [["-a"], ["-a", "", catalog, marker], ["-a", token, "-a", token, catalog, marker], ["--unknown", token, catalog, marker]]) {
      await assert.rejects(run(process.execPath, [script, ...args]), (error) => {
        assert.match(error.stderr, /Usage: node update\.js/);
        assert.doesNotMatch(error.stderr, /test-access-token/);
        return true;
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
