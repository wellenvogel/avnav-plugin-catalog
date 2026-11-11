import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { updatePlugins } from "../tools/update.js";

test("logs updater results before checker parameters without exposing options", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-log-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const originalLog = console.log;
  const logs = [];
  try {
    await writeFile(plugins, '- name: example\n  type: package\n  version: "1"\n- name: unchanged\n  type: package\n');
    console.log = (...args) => logs.push(args.join(" "));
    const updater = async (entry) => entry.name === "example" ? { version: "2", url: "new" } : undefined;
    const checker = async (entry) => {
      assert.equal(logs.at(-1), `Check entry parameters: ${JSON.stringify(entry)}`);
      if (entry.name === "example") throw new Error("check failed");
    };
    assert.equal(await updatePlugins(plugins, marker, updater, { checkAll: true, accessToken: "private-token" }, checker), false);
    assert.deepEqual(logs, [
      'Update result for "example": {"version":"2","url":"new"}',
      'Check entry parameters: {"name":"example","type":"package","version":"2","url":"new"}',
      'Update result for "unchanged": undefined',
      'Check entry parameters: {"name":"unchanged","type":"package"}',
    ]);
    assert.ok(!logs.join("\n").includes("private-token"));
    assert.match(await readFile(marker, "utf8"), /check failed/);

    logs.length = 0;
    await updatePlugins(plugins, marker, updater, { skipUpdate: true }, async () => {});
    assert.deepEqual(logs, [
      'Check entry parameters: {"name":"example","type":"package","version":"1"}',
      'Check entry parameters: {"name":"unchanged","type":"package"}',
    ]);
  } finally {
    console.log = originalLog;
    await rm(directory, { recursive: true, force: true });
  }
});
