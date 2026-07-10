"use strict";

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooksPath = path.join(repositoryRoot, ".githooks").replaceAll(path.sep, "/");
const result = spawnSync("git", ["config", "core.hooksPath", hooksPath], {
  cwd: repositoryRoot,
  stdio: "inherit",
});

if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Git hooks enabled: ${hooksPath}`);
