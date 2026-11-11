import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import updateRepository from "../tools/update_repository.js";
import { updatePlugins } from "../tools/update.js";

const index = gzipSync("Package: plugin-one\nVersion: 1\nFilename: pool/one.deb\n\nPackage: plugin-two\nVersion: 2\nFilename: pool/two.deb\n\n");

test("updater shares indexes across plugins but refreshes between runs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-repository-cache-"));
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    const plugins = path.join(directory, "plugins.yml");
    const marker = path.join(directory, ".update");
    await writeFile(plugins, `- name: first
  type: package
  update: repository
  repository:
    package: plugin-one
    variants: [trixie.armhf]
- name: second
  type: package
  update: repository
  repository:
    package: plugin-two
    variants: [trixie.armhf, trixie.arm64]
- name: third
  type: package
  update: repository
  repository:
    url: https://example.com/other
    package: plugin-one
    variants: [trixie.armhf]
`);
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return new Response(index);
    };
    assert.equal(await updatePlugins(plugins, marker), true);
    assert.equal(calls.length, 3);
    assert.equal(calls.filter((url) => url.includes("free-x.de/debian/dists/trixie/main/binary-armhf")).length, 1);
    assert.match(await readFile(plugins, "utf8"), /name: second[\s\S]*version: "2"/);
    assert.equal(await updatePlugins(plugins, marker), false);
    assert.equal(calls.length, 6);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});

test("cache shares pending requests and retries failures", async () => {
  const originalFetch = globalThis.fetch;
  const cache = new Map();
  const entry = {
    name: "test", type: "package",
    repository: { package: "plugin-one", variants: ["trixie.armhf"] },
  };
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(index);
    };
    const results = await Promise.all([
      updateRepository(entry, { repositoryIndexCache: cache }),
      updateRepository(entry, { repositoryIndexCache: cache }),
    ]);
    assert.equal(calls, 1);
    assert.equal(results[0].version, "1");
    assert.equal(results[1].version, "1");

    cache.clear();
    globalThis.fetch = async () => {
      calls++;
      return calls === 2 ? new Response("", { status: 500 }) : new Response(index);
    };
    await assert.rejects(updateRepository(entry, { repositoryIndexCache: cache }), /500/);
    assert.equal((await updateRepository(entry, { repositoryIndexCache: cache })).version, "1");
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("plain-index fallback is cached and direct calls without a cache stay fresh", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const entry = {
    name: "test", type: "package",
    repository: { package: "plugin-one", variants: ["trixie.armhf"] },
  };
  try {
    globalThis.fetch = async (url) => {
      calls++;
      return String(url).endsWith(".gz")
        ? new Response("", { status: 404 })
        : new Response("Package: plugin-one\nVersion: 1\nFilename: pool/one.deb\n\n");
    };
    const cache = new Map();
    await updateRepository(entry, { repositoryIndexCache: cache });
    await updateRepository(entry, { repositoryIndexCache: cache });
    assert.equal(calls, 2);
    await updateRepository(entry);
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
