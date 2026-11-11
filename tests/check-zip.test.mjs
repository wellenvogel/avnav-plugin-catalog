import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import checkZip from "../tools/check_zip.js";
import { updatePlugins } from "../tools/update.js";

function makeZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [filename, data] of files) {
    const name = Buffer.from(filename);
    const content = Buffer.from(data);
    const compressed = deflateRawSync(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(8, 10);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(content.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    local.push(header, name, compressed);
    central.push(record, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

test("ZIP checker downloads and validates plugin metadata", async (t) => {
  const originalFetch = globalThis.fetch;
  let archive = makeZip([["other/file", "ignored"], ["plugin/plugin.json", '{"version":"2.1"}']]);
  let requested;
  globalThis.fetch = async (url) => {
    requested = url;
    return new Response(archive);
  };
  const entry = { name: "plugin", version: "2.1", download_url: "https://example.com/$version/$version.zip" };
  try {
    await t.test("matches version and substitutes every placeholder", async () => {
      await checkZip(entry);
      assert.equal(requested, "https://example.com/2.1/2.1.zip");
      archive = makeZip([["plugin/plugin.json", '{"version":20260101}']]);
      await checkZip({ ...entry, version: "20260101" });
    });

    await t.test("does not unpack unrelated archive entries", async () => {
      archive = makeZip([["unused.dat", "unrelated contents"], ["plugin/plugin.json", '{"version":"2.1"}']]);
      archive.fill(0xff, 30 + Buffer.byteLength("unused.dat"), 30 + Buffer.byteLength("unused.dat") + 4);
      await checkZip(entry);
    });

    await t.test("rejects missing path, invalid JSON, version and duplicate metadata", async () => {
      for (const [files, expected] of [
        [[["other/plugin.json", '{"version":"2.1"}']], /does not contain plugin\/plugin.json/],
        [[["plugin/plugin.json", "{"]], /Invalid plugin.json/],
        [[["plugin/plugin.json", "{}"]], /no valid version/],
        [[["plugin/plugin.json", '{"version":"3.0"}']], /does not match catalog version/],
        [[["plugin/plugin.json", '{"version":"2.1"}'], ["plugin/plugin.json", '{"version":"2.1"}']], /multiple/],
      ]) {
        archive = makeZip(files);
        await assert.rejects(checkZip(entry), expected);
      }
    });

    await t.test("rejects invalid archives, HTTP failures and invalid input", async () => {
      archive = Buffer.from("not a zip");
      await assert.rejects(checkZip(entry));
      globalThis.fetch = async () => new Response("Not found", { status: 404, statusText: "Not Found" });
      await assert.rejects(checkZip(entry), /ZIP download failed.*404/);
      for (const invalid of [{ name: "../plugin" }, { download_url: "" }, { version: null }]) {
        await assert.rejects(checkZip({ ...entry, ...invalid }));
      }
    });

    await t.test("rejects a failed check but persists another successful update", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-zip-check-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        await writeFile(plugins, `- name: bad
  type: zip
  version: "1"
  download_url: https://example.com/bad.zip
- name: good
  type: zip
  version: "1"
  download_url: https://example.com/good.zip
`);
        globalThis.fetch = async (url) => new Response(makeZip([
          [url.endsWith("bad.zip") ? "bad/plugin.json" : "good/plugin.json",
            JSON.stringify({ version: url.endsWith("bad.zip") ? "wrong" : "2" })],
        ]));
        assert.equal(await updatePlugins(plugins, marker, async () => ({ version: "2" })), true);
        const output = await readFile(plugins, "utf8");
        assert.match(output, /name: bad[\s\S]*version: "1"/);
        assert.match(output, /name: good[\s\S]*version: "2"/);
        const report = await readFile(marker, "utf8");
        assert.match(report, /^UPDATED\n"good": .*\nERROR\n"bad": "check .*does not match catalog version.*\n$/);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
