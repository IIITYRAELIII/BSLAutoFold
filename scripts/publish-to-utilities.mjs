"use strict";

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const fileName = `${packageJson.name}-${packageJson.version}.vsix`;
const utilitiesDirectory = process.env.BSL_AUTO_FOLD_DISTRIBUTION_DIR
  ? path.resolve(process.env.BSL_AUTO_FOLD_DISTRIBUTION_DIR)
  : path.resolve(repositoryRoot, "..", "Utilities", "BSLAutoFold");
const utilitiesRepository = path.dirname(utilitiesDirectory);
const buildDirectory = path.join(repositoryRoot, ".build");
const artifactPath = path.join(buildDirectory, fileName);
const vsceEntryPoint = path.join(
  repositoryRoot,
  "node_modules",
  "@vscode",
  "vsce",
  "vsce",
);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function gitOutput(...args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function generatedReadme(commit) {
  const sourceUrl = packageJson.repository?.url?.replace(/\.git$/, "") ?? "";
  const sourceLine = sourceUrl
    ? `Исходный код: [${sourceUrl}](${sourceUrl})`
    : "Исходный код находится в отдельном репозитории `BSLAutoFold`.";
  return `# BSL Auto Fold

Готовая сборка расширения VS Code для автоматического сворачивания BSL-кода.

${sourceLine}

## Установка

1. Установите расширение \`Language 1C (BSL)\`.
2. Скачайте лежащий рядом файл [${fileName}](./${fileName}).
3. В VS Code выполните команду \`Extensions: Install from VSIX...\` и выберите файл.

Либо из терминала в этой папке:

\`\`\`powershell
code --install-extension .\\${fileName} --force
\`\`\`

Версия: \`${packageJson.version}\`<br>
Коммит исходников: \`${commit}\`

## Обновление

Этот README и VSIX генерируются автоматически после каждого коммита
репозитория исходников. Не редактируйте их вручную.
`;
}

if (!(await exists(path.join(utilitiesRepository, ".git")))) {
  const message = `Utilities repository not found: ${utilitiesRepository}`;
  if (process.env.BSL_AUTO_FOLD_DISTRIBUTION_DIR) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message}. Distribution update skipped.`);
  process.exit(0);
}
if (!(await exists(vsceEntryPoint))) {
  console.error("Local vsce is missing. Run npm install first.");
  process.exit(1);
}

await fs.rm(buildDirectory, { recursive: true, force: true });
await fs.mkdir(buildDirectory, { recursive: true });

const packageResult = spawnSync(process.execPath, [
  vsceEntryPoint,
  "package",
  "--allow-missing-repository",
  "--out",
  artifactPath,
], { cwd: repositoryRoot, stdio: "inherit" });
if (packageResult.status !== 0) process.exit(packageResult.status ?? 1);

await fs.mkdir(utilitiesDirectory, { recursive: true });
for (const entry of await fs.readdir(utilitiesDirectory)) {
  if (/^bsl-auto-fold-.*\.vsix$/i.test(entry) && entry !== fileName) {
    await fs.rm(path.join(utilitiesDirectory, entry), { force: true });
  }
}
await fs.copyFile(artifactPath, path.join(utilitiesDirectory, fileName));
await fs.writeFile(
  path.join(utilitiesDirectory, "README.md"),
  generatedReadme(gitOutput("rev-parse", "--short", "HEAD")),
  "utf8",
);
await fs.rm(buildDirectory, { recursive: true, force: true });

console.log(`Published ${fileName} to ${utilitiesDirectory}`);
