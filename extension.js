"use strict";

const vscode = require("vscode");
const {
  findContainingMethod,
  findMethodStartLines,
  findMethodDescriptions,
  findRegionStartLines,
  findConditionalStartLines,
  findLoopStartLines,
  findTryStartLines,
  findPreprocessorStartLines,
  findBlockRanges,
} = require("./folding");

const visitedDocuments = new Set();
const pendingDocuments = new Map();

function documentKey(document) {
  return document.uri.toString();
}

function isBslEditor(editor) {
  return editor?.document?.languageId === "bsl";
}

function delayForDocument(document) {
  return vscode.workspace.getConfiguration("bslAutoFold", document.uri).get("delayMs", 150);
}

async function applyToMethods(editor, command) {
  if (!isBslEditor(editor)) return;
  const selectionLines = findMethodStartLines(editor.document.getText());
  if (!selectionLines.length) return;
  await vscode.commands.executeCommand(command, { selectionLines });
}

function automaticFoldLines(document, targetLine) {
  const text = document.getText();
  const config = vscode.workspace.getConfiguration("bslAutoFold", document.uri);
  const targetMethod = findContainingMethod(text, targetLine);
  const lines = [];

  if (config.get("collapseMethodDescriptionsOnOpen", true)) {
    lines.push(...findMethodDescriptions(text)
      .filter((description) => !(description.start <= targetLine && targetLine <= description.end))
      .map((description) => description.start));
  }
  if (config.get("collapseMethodsOnOpen", true)) {
    lines.push(...findMethodStartLines(text).filter((line) => line !== targetMethod?.start));
  }
  if (config.get("collapseRegionsOnOpen", false)) lines.push(...findRegionStartLines(text));
  if (config.get("collapseConditionalsOnOpen", false)) lines.push(...findConditionalStartLines(text));
  if (config.get("collapseLoopsOnOpen", false)) lines.push(...findLoopStartLines(text));
  if (config.get("collapseTryBlocksOnOpen", false)) lines.push(...findTryStartLines(text));
  if (config.get("collapsePreprocessorOnOpen", false)) lines.push(...findPreprocessorStartLines(text));

  return [...new Set(lines)].sort((left, right) => right - left);
}

async function revealTargetLine(editor, targetLine) {
  if (!isBslEditor(editor)) return;
  const method = findContainingMethod(editor.document.getText(), targetLine);
  if (!method) return;
  await vscode.commands.executeCommand("editor.unfold", {
    selectionLines: [targetLine],
    direction: "up",
    levels: 100,
  });
}

function scheduleAutomaticFold(editor) {
  if (!isBslEditor(editor)) return;

  const key = documentKey(editor.document);
  if (visitedDocuments.has(key) || pendingDocuments.has(key)) return;
  visitedDocuments.add(key);

  const timer = setTimeout(async () => {
    pendingDocuments.delete(key);
    const active = vscode.window.activeTextEditor;
    if (!active || documentKey(active.document) !== key) return;
    try {
      const targetLine = active.selection.active.line;
      const targetMethod = findContainingMethod(active.document.getText(), targetLine);
      const selectionLines = automaticFoldLines(active.document, targetLine);
      if (selectionLines.length) {
        await vscode.commands.executeCommand("editor.fold", { selectionLines });
      }
      if (targetMethod) await revealTargetLine(active, targetLine);
    } catch (error) {
      console.error("BSL Auto Fold:", error);
    }
  }, delayForDocument(editor.document));
  pendingDocuments.set(key, timer);
}

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider({ language: "bsl" }, {
      provideFoldingRanges(document) {
        const text = document.getText();
        const ranges = [
          ...findBlockRanges(text).map((block) => ({
            start: block.start,
            end: block.end,
            kind: block.type === "region" ? vscode.FoldingRangeKind.Region : undefined,
          })),
          ...findMethodDescriptions(text).map((description) => ({
            start: description.start,
            end: description.end,
            kind: vscode.FoldingRangeKind.Comment,
          })),
        ].sort((left, right) => left.start - right.start || right.end - left.end);
        return ranges.map((range) => new vscode.FoldingRange(range.start, range.end, range.kind));
      },
    }),
    vscode.window.onDidChangeActiveTextEditor(scheduleAutomaticFold),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (!isBslEditor(event.textEditor)) return;
      if (event.kind === vscode.TextEditorSelectionChangeKind.Keyboard
        || event.kind === vscode.TextEditorSelectionChangeKind.Mouse) return;
      const targetLine = event.selections[0]?.active.line;
      if (targetLine == null) return;
      void revealTargetLine(event.textEditor, targetLine).catch((error) => {
        console.error("BSL Auto Fold navigation:", error);
      });
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      const key = documentKey(document);
      visitedDocuments.delete(key);
      const timer = pendingDocuments.get(key);
      if (timer) clearTimeout(timer);
      pendingDocuments.delete(key);
    }),
    vscode.commands.registerCommand("bslAutoFold.foldMethods", async () => {
      await applyToMethods(vscode.window.activeTextEditor, "editor.fold");
    }),
    vscode.commands.registerCommand("bslAutoFold.unfoldMethods", async () => {
      await applyToMethods(vscode.window.activeTextEditor, "editor.unfold");
    }),
  );

  scheduleAutomaticFold(vscode.window.activeTextEditor);
}

function deactivate() {
  for (const timer of pendingDocuments.values()) clearTimeout(timer);
  pendingDocuments.clear();
}

module.exports = { activate, deactivate };
