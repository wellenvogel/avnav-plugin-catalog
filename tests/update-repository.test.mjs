import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import updateRepository, { compareVersions } from "../tools/update_repository.js";
import { updatePlugins } from "../tools/update.js";

const record = (version, file = `pool/p/plugin_${version}.deb`) =>
  `Package: avnav-plugin\nVersion: ${version}\nFilename: ${file}\nDescription: test\n continuation\n\n`;
const require = createRequire(new URL("../tools/package.json", import.meta.url));
const YAML = require("yaml");

test("Debian version comparison agrees with dpkg", () => {
  const versions = ["0", "1", "1.0", "1.00", "1.0-0", "1.0~rc1", "1.0~~", "1.0-1",
    "1.0-10", "1.0+git", "1.0a", "1.0.0", "2.0", "1:1.0", "2:0", "0002:0",
    "1.0000000000000000000000001", "1.9999999999999999999999999"];
  for (const a of versions) {
    for (const b of versions) {
      const dpkg = (op) => {
        try {
          execFileSync("dpkg", ["--compare-versions", a, op, b], { stdio: "pipe" });
          return true;
        } catch (error) {
          if (error.status === 1) return false;
          throw error;
        }
      };
      const expected = dpkg("lt") ? -1 : dpkg("gt") ? 1 : 0;
      assert.equal(compareVersions(a, b), expected, `${a} vs ${b}`);
    }
  }
});

test("repository updater reads variants and reports changes atomically", async (t) => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  const entry = {
    name: "test", type: "package", version: "1.0",
    repository: { package: "avnav-plugin", variants: ["trixie.armhf", "bookworm.amd64", "trixie.arm64"] },
  };
  try {
    globalThis.fetch = async (url) => {
      const address = String(url);
      requested.push(address);
      if (address.includes("trixie/main/binary-armhf")) {
        return new Response(gzipSync(record("1.0~rc1") + record("1.0-1") + record("1.0-2")));
      }
      if (address.includes("bookworm/main/binary-amd64") && address.endsWith(".gz")) {
        return new Response("", { status: 404 });
      }
      if (address.includes("bookworm/main/binary-amd64")) {
        return new Response(record("1:0.1"));
      }
      return new Response(gzipSync("Package: other\nVersion: 1\nFilename: pool/other.deb\n\n"));
    };

    await t.test("uses default URL, gzip, plain fallback, and Debian version ordering", async () => {
      const result = await updateRepository(entry);
      assert.equal(result.version, "1:0.1");
      assert.deepEqual(result.repository.available, {
        "trixie.armhf": { package_name: "avnav-plugin", version: "1.0-2", download_url: "https://www.free-x.de/debian/pool/p/plugin_1.0-2.deb" },
        "bookworm.amd64": { package_name: "avnav-plugin", version: "1:0.1", download_url: "https://www.free-x.de/debian/pool/p/plugin_1:0.1.deb" },
      });
      assert.equal(result.repository.package, "avnav-plugin");
      assert.ok(Number.isFinite(Date.parse(result.last_updated)));
      assert.ok(requested.includes("https://www.free-x.de/debian/dists/bookworm/main/binary-amd64/Packages"));
      assert.equal(await updateRepository({ ...entry, ...result }), undefined);
    });

    await t.test("uses a custom repository base and handles availability-only changes", async () => {
      const result = await updateRepository({ ...entry, version: "1:0.1", repository: { ...entry.repository, url: "https://example.com/repo" } });
      assert.equal(result.version, undefined);
      assert.match(result.repository.available["trixie.armhf"].download_url, /^https:\/\/example\.com\/repo\/pool\//);
    });

    await t.test("extracts the top-level version from the highest Debian package version", async () => {
      for (const [pattern, expected] of [["^[0-9]+:#semver#$", "0.1.0"], ["^[0-9]+:([0-9.]+)$", "0.1.0"], ["[0-9]+\\.[0-9]+\\.[0-9]+", "0.1.0"]]) {
        globalThis.fetch = async (url) => new Response(gzipSync(record(String(url).includes("bookworm") ? "1:0.1.0" : "9.0.0")));
        const result = await updateRepository({ ...entry, repository: { ...entry.repository, version_pattern: pattern } });
        assert.equal(result.version, expected);
        assert.equal(result.repository.available["bookworm.amd64"].version, "1:0.1.0");
        assert.equal(result.repository.available["trixie.armhf"].version, "9.0.0");
        assert.equal(await updateRepository({ ...entry, ...result }), undefined);
      }
    });

    await t.test("supports simple pattern and rejects invalid or nonmatching patterns", async () => {
      globalThis.fetch = async () => new Response(gzipSync(record("20260101-2")));
      const base = { ...entry, repository: { ...entry.repository, variants: ["trixie.armhf"] } };
      const result = await updateRepository({ ...base, repository: { ...base.repository, version_pattern: "^#simple#-" } });
      assert.equal(result.version, "20260101");
      assert.equal(result.repository.available["trixie.armhf"].version, "20260101-2");
      for (const pattern of ["", 42, "[", "^v#semver#$", "(x)?20260101", "z#simple#"]) {
        await assert.rejects(updateRepository({ ...base, repository: { ...base.repository, version_pattern: pattern } }), /version_pattern/);
      }
    });

    await t.test("defaults omitted, null, and empty variants to every configured variant", async () => {
      globalThis.fetch = async (url) => {
        const address = String(url);
        requested.push(address);
        if (address.includes("trixie/main/binary-armhf")) return new Response(gzipSync(record("1.0-2")));
        if (address.includes("bookworm/main/binary-amd64") && address.endsWith(".gz")) return new Response("", { status: 404 });
        if (address.includes("bookworm/main/binary-amd64")) return new Response(record("1:0.1"));
        return new Response(gzipSync("Package: other\nVersion: 1\nFilename: pool/other.deb\n\n"));
      };
      const config = YAML.parse(await readFile(new URL("../docs/_data/packages.yml", import.meta.url), "utf8"));
      const expected = Object.entries(config.variants).flatMap(([distribution, architectures]) =>
        Object.keys(architectures).map((architecture) => `${distribution}.${architecture}`));
      for (const configured of [undefined, null, []]) {
        const repository = { package: entry.repository.package };
        if (configured !== undefined) repository.variants = configured;
        const start = requested.length;
        const result = await updateRepository({ ...entry, repository });
        const calls = requested.slice(start);
        for (const variant of expected) {
          const [distribution, architecture] = variant.split(".");
          assert.ok(calls.includes(`https://www.free-x.de/debian/dists/${distribution}/${config.variants[distribution][architecture]}/Packages.gz`));
        }
        assert.equal(calls.filter((url) => url.endsWith(".gz")).length, expected.length);
        assert.deepEqual(Object.keys(result.repository.available), ["trixie.armhf", "bookworm.amd64"]);
        assert.deepEqual(result.repository.variants, configured);
        assert.equal(await updateRepository({ ...entry, ...result }), undefined);
      }
    });

    await t.test("rejects invalid input and missing variants without network requests", async () => {
      const count = requested.length;
      for (const input of [
        { ...entry, type: "zip" },
        { ...entry, repository: { ...entry.repository, variants: ["trixie.fake"] } },
        { ...entry, repository: { ...entry.repository, variants: "trixie.armhf" } },
        { ...entry, repository: { ...entry.repository, variants: ["trixie.armhf", "trixie.armhf"] } },
        { ...entry, repository: { ...entry.repository, package: "../bad" } },
        { ...entry, repository: { ...entry.repository, url: "file:///tmp/" } },
      ]) await assert.rejects(updateRepository(input));
      assert.equal(requested.length, count);
    });

    await t.test("rejects download, malformed index, invalid package data, and no matches", async () => {
      for (const response of [
        () => new Response("", { status: 500 }),
        () => new Response("broken gzip"),
        () => new Response(gzipSync("not a field\n\n")),
        () => new Response(gzipSync("Package: avnav-plugin\nVersion: 2\n\n")),
        () => new Response(gzipSync(record("2", "../outside.deb"))),
        () => new Response(gzipSync("Package: other\nVersion: 1\nFilename: pool/a.deb\n\n")),
      ]) {
        globalThis.fetch = async () => response();
        await assert.rejects(updateRepository(entry));
      }
    });

    await t.test("dispatcher records errors and persists valid package update", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-repository-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        await writeFile(plugins, `- name: invalid\n  type: package\n  update: repository\n  repository:\n    package: bad-name\n    variants: [not.real]\n- name: valid\n  type: package\n  version: "1"\n  update: repository\n  repository:\n    package: avnav-plugin\n    variants: [trixie.armhf]\n`);
        globalThis.fetch = async () => new Response(gzipSync(record("2")));
        assert.equal(await updatePlugins(plugins, marker), true);
        assert.match(await readFile(plugins, "utf8"), /available:[\s\S]*trixie.armhf:[\s\S]*package_name: avnav-plugin/);
        assert.match(await readFile(marker, "utf8"), /ERROR\n"invalid": .*Unknown or invalid repository variant/);
        assert.equal(await updatePlugins(plugins, marker), false);
        assert.match(await readFile(marker, "utf8"), /^ERROR\n/);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    await t.test("pattern failures are reported without persisting partial results", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-repository-pattern-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        const source = '- name: invalid\n  type: package\n  version: "1"\n  update: repository\n  repository:\n    package: avnav-plugin\n    variants: [trixie.armhf]\n    version_pattern: "^v#simple#$"\n';
        await writeFile(plugins, source);
        globalThis.fetch = async () => new Response(gzipSync(record("20260101-1")));
        assert.equal(await updatePlugins(plugins, marker), false);
        assert.equal(await readFile(plugins, "utf8"), source);
        const report = await readFile(marker, "utf8");
        assert.match(report, /^ERROR\n"invalid": .*version_pattern/);
        assert.match(report, /20260101-1/);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
