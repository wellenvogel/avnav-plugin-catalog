import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const require = createRequire(new URL("../tools/package.json", import.meta.url));
const YAML = require("yaml");

async function workflowSteps() {
  const workflow = YAML.parse(await readFile(new URL("../.github/workflows/update-plugins.yml", import.meta.url), "utf8"));
  return workflow.jobs.update.steps;
}

test("workflow commits only actual catalog changes, independently of the marker", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-workflow-"));
  const repo = path.join(directory, "repo");
  const remote = path.join(directory, "remote.git");
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" });
  try {
    const step = (await workflowSteps()).find((item) => item.name === "Commit and push changes");
    assert.ok(step?.run);
    await mkdir(path.join(repo, "docs", "_data"), { recursive: true });
    execFileSync("git", ["init", "--bare", remote], { stdio: "pipe" });
    git("init", "--initial-branch=main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    git("remote", "add", "origin", remote);
    const catalog = path.join(repo, "docs", "_data", "plugins.yml");
    await writeFile(catalog, "- name: test\n");
    git("add", "docs/_data/plugins.yml");
    git("commit", "-m", "Initial");
    git("push", "-u", "origin", "main");
    const initialCommit = git("rev-parse", "HEAD").trim();

    await writeFile(path.join(repo, ".update"), "ERROR\nfailure\n");
    execFileSync("bash", ["-e", "-c", step.run], { cwd: repo, stdio: "pipe" });
    assert.equal(git("rev-parse", "HEAD").trim(), initialCommit);

    await unlink(path.join(repo, ".update"));
    await writeFile(catalog, "- name: changed\n");
    execFileSync("bash", ["-e", "-c", step.run], { cwd: repo, stdio: "pipe" });
    const updatedCommit = git("rev-parse", "HEAD").trim();
    assert.notEqual(updatedCommit, initialCommit);
    assert.equal(git("--git-dir", remote, "rev-parse", "refs/heads/main").trim(), updatedCommit);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow uploads hidden marker and defers updater errors until after commit", async () => {
  const steps = await workflowSteps();
  const updateIndex = steps.findIndex((step) => step.name === "Update plugin catalog");
  const commitIndex = steps.findIndex((step) => step.name === "Commit and push changes");
  const uploadIndex = steps.findIndex((step) => step.name === "Upload update marker");
  const reportIndex = steps.findIndex((step) => step.name === "Report update errors");
  const update = steps[updateIndex];
  const upload = steps[uploadIndex];
  const report = steps[reportIndex];
  assert.ok(updateIndex >= 0 && updateIndex < commitIndex && commitIndex < uploadIndex && uploadIndex < reportIndex);
  assert.equal(update.id, "update");
  assert.equal(update["continue-on-error"], true);
  assert.equal(update.env.GITHUB_TOKEN, "${{ secrets.GITHUB_TOKEN }}");
  assert.match(update.run, /node tools\/update\.js -a "\$GITHUB_TOKEN"/);
  assert.equal(upload.if, "${{ always() }}");
  assert.equal(upload.uses, "actions/upload-artifact@v4");
  assert.equal(upload.with.path, ".update");
  assert.equal(upload.with["include-hidden-files"], true);
  assert.equal(upload.with["if-no-files-found"], "ignore");
  assert.equal(report.if, "${{ always() }}");
  assert.equal(report.env.UPDATE_OUTCOME, "${{ steps.update.outcome }}");

  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-workflow-report-"));
  try {
    await mkdir(path.join(directory, "tools"));
    await writeFile(path.join(directory, "tools", "update.js"),
      'require("node:fs").writeFileSync(".update", "ERROR\\nfatal\\n"); process.exitCode = 1;\n');
    assert.throws(() => execFileSync("bash", ["-e", "-c", update.run], {
      cwd: directory, encoding: "utf8", stdio: "pipe",
    }), (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stdout, /ERROR\nfatal/);
      return true;
    });
    await unlink(path.join(directory, ".update"));

    const runReport = (outcome) => execFileSync("bash", ["-e", "-c", report.run], {
      cwd: directory,
      env: { ...process.env, UPDATE_OUTCOME: outcome },
      encoding: "utf8",
      stdio: "pipe",
    });
    runReport("success");
    await writeFile(path.join(directory, ".update"), 'UPDATED\n"test": {"version":"1"}\n');
    runReport("success");
    await writeFile(path.join(directory, ".update"), 'UPDATED\n"test": {"version":"2"}\nERROR\n"other": "failed"\n');
    assert.throws(() => runReport("success"), { status: 1 });
    await writeFile(path.join(directory, ".update"), 'ERROR\n"test": "failed"\n');
    assert.throws(() => runReport("success"), { status: 1 });
    await unlink(path.join(directory, ".update"));
    assert.throws(() => runReport("failure"), { status: 1 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
