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

Расширение VS Code для удобной работы с большими модулями 1С. Автоматически
сворачивает процедуры, функции и их комментарии-описания при открытии
BSL-файла.

## Возможности

- автоматически сворачивает процедуры и функции;
- скрывает вместе с методом строку \`КонецПроцедуры\` или \`КонецФункции\`;
- отдельно сворачивает многострочные комментарии-описания перед методами;
- оставляет развёрнутым метод, содержащий строку, на которую выполнен переход;
- разворачивает метод при командной навигации к строке внутри него;
- умеет опционально сворачивать области, условия, циклы, \`Попытка\` и
  директивы препроцессора;
- не требует включённого BSL Language Server.

Методы и их описания сворачиваются по умолчанию. Остальные категории включаются
независимо друг от друга в настройках VS Code.

## Установка

1. Установите
   [Language 1C (BSL)](https://marketplace.visualstudio.com/items?itemName=1c-syntax.language-1c-bsl).
2. Скачайте [${fileName}](./${fileName}).
3. В VS Code откройте палитру команд \`Ctrl+Shift+P\`.
4. Выполните \`Extensions: Install from VSIX...\` и выберите скачанный файл.
5. Один раз выполните \`Developer: Reload Window\`.

Установка из терминала в этой папке:

\`\`\`powershell
code --install-extension .\\${fileName} --force
\`\`\`

## Настройки

| Параметр | По умолчанию | Назначение |
| --- | ---: | --- |
| \`bslAutoFold.collapseMethodsOnOpen\` | Вкл. | Сворачивать процедуры и функции. |
| \`bslAutoFold.collapseMethodDescriptionsOnOpen\` | Вкл. | Сворачивать описания методов. |
| \`bslAutoFold.collapseRegionsOnOpen\` | Выкл. | Сворачивать \`#Области\`. |
| \`bslAutoFold.collapseConditionalsOnOpen\` | Выкл. | Сворачивать конструкции \`Если\`. |
| \`bslAutoFold.collapseLoopsOnOpen\` | Выкл. | Сворачивать циклы \`Для\` и \`Пока\`. |
| \`bslAutoFold.collapseTryBlocksOnOpen\` | Выкл. | Сворачивать конструкции \`Попытка\`. |
| \`bslAutoFold.collapsePreprocessorOnOpen\` | Выкл. | Сворачивать блоки препроцессора \`#Если\`. |
| \`bslAutoFold.delayMs\` | \`150\` | Задержка автосворачивания в миллисекундах. |

## Команды

- \`BSL Auto Fold: Свернуть все методы\`;
- \`BSL Auto Fold: Развернуть все методы\`.

## Обновление

Скачайте новый VSIX и повторите установку с параметром \`--force\` либо снова
выполните \`Extensions: Install from VSIX...\`.

## Удаление

\`\`\`powershell
code --uninstall-extension tyrael.bsl-auto-fold
\`\`\`

## Сборка

- версия: \`${packageJson.version}\`;
- коммит исходников: \`${commit}\`;
- лицензия: [MIT](./LICENSE).

${sourceLine}

> VSIX, лицензия и этот README автоматически обновляются после каждого коммита
> репозитория исходников. README не следует редактировать вручную.
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
await fs.copyFile(path.join(repositoryRoot, "LICENSE"), path.join(utilitiesDirectory, "LICENSE"));
await fs.writeFile(
  path.join(utilitiesDirectory, "README.md"),
  generatedReadme(gitOutput("rev-parse", "--short", "HEAD")),
  "utf8",
);
await fs.rm(buildDirectory, { recursive: true, force: true });

console.log(`Published ${fileName} to ${utilitiesDirectory}`);
