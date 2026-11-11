import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import updateDirectory from "../tools/update_directory.js";
import { updatePlugins } from "../tools/update.js";

const entry = {
  name: "plugin",
  directory: "https://example.com/downloads/",
  filename: String.raw`plugin-#semver#\.zip`,
  version: "1.0.0",
  download_url: "https://example.com/old.zip",
};

test("directory updates discover and validate download links", async (t) => {
  const originalFetch = globalThis.fetch;
  const page = (html, url = "") => {
    globalThis.fetch = async () => ({ ok: true, url, text: async () => html });
  };
  try {
    await t.test("uses the highest SemVer rather than page order or prereleases", async () => {
      page(`<a href="plugin-1.10.0-beta.1.zip">prerelease</a>
        <a href='plugin-1.2.0.zip'>older</a>
        <a HREF=plugin-1.10.0.zip>latest</a>
        <a href="plugin-99.0.0.zip.bak">not a match</a>`);
      const result = await updateDirectory(entry);
      assert.equal(result.version, "1.10.0");
      assert.equal(result.download_url, "https://example.com/downloads/plugin-1.10.0.zip");
      assert.ok(Number.isFinite(Date.parse(result.last_updated)));
      assert.equal(await updateDirectory({ ...entry, ...result }), undefined);
      assert.equal(await updateDirectory({ ...entry, version: "1.10.0", download_url: "https://example.com/downloads/plugin-$version.zip" }), undefined);
    });

    await t.test("resolves redirected and base-relative URLs, entities, and encoded filenames", async () => {
      page(`<base href="../files/"><a href="plugin-2.0.0%2Bbuild.1.zip?x=1&amp;y=2">download</a>`,
        "https://cdn.example.com/redirect/list.html");
      const result = await updateDirectory(entry);
      assert.equal(result.version, "2.0.0+build.1");
      assert.equal(result.download_url, "https://cdn.example.com/files/plugin-2.0.0%2Bbuild.1.zip?x=1&y=2");
    });

    await t.test("supports simple, custom capture and whole-match patterns", async () => {
      page('<a href="prefix-plugin-9.zip">9</a><a href="plugin-10.zip">10</a>');
      const result = await updateDirectory({ ...entry, filename: String.raw`plugin-#simple#\.zip` });
      assert.equal(result.version, "10");
      assert.equal(result.download_url, "https://example.com/downloads/plugin-10.zip");
      page('<a href="file-17.tar">17</a>');
      assert.equal((await updateDirectory({ ...entry, filename: String.raw`file-(\d+)\.tar` })).version, "17");
      assert.equal((await updateDirectory({ ...entry, filename: String.raw`\d+\.tar` })).version, "17.tar");
    });

    await t.test("orders mixed version formats consistently regardless of link order", async () => {
      const links = ['<a href="plugin-1.0.0-rc.1.zip">rc</a>', '<a href="plugin-1.0.0.zip">release</a>', '<a href="plugin-1.0.zip">short</a>'];
      const mixed = { ...entry, filename: String.raw`plugin-([0-9A-Za-z.-]+)\.zip` };
      page(links.join(""));
      const first = await updateDirectory(mixed);
      page(links.reverse().join(""));
      const second = await updateDirectory(mixed);
      assert.equal(first.version, second.version);
      assert.equal(first.download_url, second.download_url);
    });

    await t.test("changes only URL or version when appropriate", async () => {
      page('<a href="plugin-2.0.0.zip">2</a>');
      const onlyUrl = await updateDirectory({ ...entry, version: "2.0.0" });
      assert.equal(onlyUrl.version, undefined);
      assert.equal(onlyUrl.download_url, "https://example.com/downloads/plugin-2.0.0.zip");
      const onlyVersion = await updateDirectory({ ...entry, download_url: "https://example.com/downloads/plugin-$version.zip" });
      assert.equal(onlyVersion.version, "2.0.0");
      assert.equal(onlyVersion.download_url, undefined);
    });

    await t.test("rejects invalid input, invalid patterns, failed requests and missing versions", async () => {
      for (const invalid of [
        { directory: undefined }, { directory: "bad" }, { directory: "file:///tmp/" },
        { filename: "" }, { filename: 12 }, { filename: "[" },
      ]) await assert.rejects(updateDirectory({ ...entry, ...invalid }));
      globalThis.fetch = async () => new Response("unavailable", { status: 503 });
      await assert.rejects(updateDirectory(entry), /Directory request failed.*503/);
      page('<a href="plugin-.zip">empty</a><a href="plugin-3.0.0.zip.bak">backup</a>');
      await assert.rejects(updateDirectory({ ...entry, filename: String.raw`plugin-#simple#\.zip` }), /No version found.*plugin-#simple#/);
      page('<a href="mailto:plugin-2.0.0.zip">email</a>');
      await assert.rejects(updateDirectory(entry), /No version found/);
    });

    await t.test("dispatcher records a failed directory update and saves another", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-directory-update-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, "marker");
        await writeFile(plugins, `- name: bad
  type: package
  update: directory
  directory: https://example.com/bad/
  filename: 'plugin-#simple#\\.deb'
  version: "1"
  download_url: https://example.com/old.deb
- name: good
  type: package
  update: directory
  directory: https://example.com/good/
  filename: 'plugin-#simple#\\.deb'
  version: "1"
  download_url: https://example.com/old.deb
`);
        globalThis.fetch = async (url) => new Response(String(url).includes("/good/") ? '<a href="plugin-2.deb">download</a>' : "<p>empty</p>");
        assert.equal(await updatePlugins(plugins, marker), true);
        const output = await readFile(plugins, "utf8");
        assert.match(output, /name: bad[\s\S]*version: "1"/);
        assert.match(output, /name: good[\s\S]*version: "2"/);
        assert.match(output, /https:\/\/example.com\/good\/plugin-2.deb/);
        const report = await readFile(marker, "utf8");
        assert.match(report, /UPDATED\n"good":/);
        assert.match(report, /ERROR\n"bad": "update .*directory.*No version found/);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
