"use strict";

const vscode = require("vscode");
const {
  analyzeFolding,
  collectAutomaticFoldLines,
  findContainingMethodInAnalysis,
} = require("./folding");

const CONFIGURATION_SECTION = "bslAutoFold";
const DEFAULT_DELAY_MS = 150;

let autoFoldSession;

function documentKey(document) {
  return document.uri.toString();
}

function isBslEditor(editor) {
  return editor?.document?.languageId === "bsl";
}

function configurationFor(document) {
  return vscode.workspace.getConfiguration(CONFIGURATION_SECTION, document.uri);
}

function automaticFoldOptions(document) {
  const config = configurationFor(document);
  return {
    methods: config.get("collapseMethodsOnOpen", true),
    methodDescriptions: config.get("collapseMethodDescriptionsOnOpen", true),
    region: config.get("collapseRegionsOnOpen", false),
    conditional: config.get("collapseConditionalsOnOpen", false),
    loop: config.get("collapseLoopsOnOpen", false),
    try: config.get("collapseTryBlocksOnOpen", false),
    preprocessor: config.get("collapsePreprocessorOnOpen", false),
  };
}

function reportError(context, error) {
  console.error(`BSL Auto Fold ${context}:`, error);
}

async function applyToMethods(editor, command) {
  if (!isBslEditor(editor)) return;
  const analysis = analyzeFolding(editor.document.getText());
  const selectionLines = analysis.methods.map((method) => method.start);
  if (selectionLines.length) {
    await vscode.commands.executeCommand(command, { selectionLines });
  }
}

async function revealTargetLine(editor, targetLine, analysis) {
  if (!isBslEditor(editor)) return;
  const currentAnalysis = analysis ?? analyzeFolding(editor.document.getText());
  if (!findContainingMethodInAnalysis(currentAnalysis, targetLine)) return;
  await vscode.commands.executeCommand("editor.unfold", {
    selectionLines: [targetLine],
    direction: "up",
    levels: 100,
  });
}

function createFoldingRangeProvider() {
  return {
    provideFoldingRanges(document) {
      const analysis = analyzeFolding(document.getText());
      const ranges = [
        ...analysis.blocks.map((block) => new vscode.FoldingRange(
          block.start,
          block.end,
          block.type === "region" ? vscode.FoldingRangeKind.Region : undefined,
        )),
        ...analysis.descriptions.map((description) => new vscode.FoldingRange(
          description.start,
          description.end,
          vscode.FoldingRangeKind.Comment,
        )),
      ];
      return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
    },
  };
}

class AutoFoldSession {
  constructor() {
    this.visitedDocuments = new Set();
    this.pendingDocuments = new Map();
  }

  schedule(editor) {
    if (!isBslEditor(editor)) return;

    const key = documentKey(editor.document);
    if (this.visitedDocuments.has(key) || this.pendingDocuments.has(key)) return;

    const delay = configurationFor(editor.document).get("delayMs", DEFAULT_DELAY_MS);
    const timer = setTimeout(() => {
      void this.run(key);
    }, delay);
    this.pendingDocuments.set(key, timer);
  }

  async run(key) {
    this.pendingDocuments.delete(key);
    const editor = vscode.window.activeTextEditor;
    if (!isBslEditor(editor) || documentKey(editor.document) !== key) return;

    try {
      const targetLine = editor.selection.active.line;
      const analysis = analyzeFolding(editor.document.getText());
      const options = automaticFoldOptions(editor.document);
      const selectionLines = collectAutomaticFoldLines(
        analysis,
        targetLine,
        options,
      );
      if (Object.values(options).some(Boolean)) {
        await vscode.commands.executeCommand("editor.unfoldAll");
      }
      if (selectionLines.length) {
        await vscode.commands.executeCommand("editor.fold", { selectionLines });
      }
      await revealTargetLine(editor, targetLine, analysis);
      this.visitedDocuments.add(key);
    } catch (error) {
      reportError("automatic folding", error);
    }
  }

  close(document) {
    const key = documentKey(document);
    this.visitedDocuments.delete(key);
    const timer = this.pendingDocuments.get(key);
    if (timer) clearTimeout(timer);
    this.pendingDocuments.delete(key);
  }

  dispose() {
    for (const timer of this.pendingDocuments.values()) clearTimeout(timer);
    this.pendingDocuments.clear();
    this.visitedDocuments.clear();
  }
}

function handleNavigation(event) {
  if (!isBslEditor(event.textEditor)) return;
  if (event.kind === vscode.TextEditorSelectionChangeKind.Keyboard
    || event.kind === vscode.TextEditorSelectionChangeKind.Mouse) return;
  const targetLine = event.selections[0]?.active.line;
  if (targetLine == null) return;
  void revealTargetLine(event.textEditor, targetLine)
    .catch((error) => reportError("navigation", error));
}

function activate(context) {
  const session = new AutoFoldSession();
  autoFoldSession = session;

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { language: "bsl" },
      createFoldingRangeProvider(),
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => session.schedule(editor)),
    vscode.window.onDidChangeTextEditorSelection(handleNavigation),
    vscode.workspace.onDidCloseTextDocument((document) => session.close(document)),
    vscode.commands.registerCommand("bslAutoFold.foldMethods", async () => {
      await applyToMethods(vscode.window.activeTextEditor, "editor.fold");
    }),
    vscode.commands.registerCommand("bslAutoFold.unfoldMethods", async () => {
      await applyToMethods(vscode.window.activeTextEditor, "editor.unfold");
    }),
  );

  session.schedule(vscode.window.activeTextEditor);
}

function deactivate() {
  autoFoldSession?.dispose();
  autoFoldSession = undefined;
}

module.exports = { activate, deactivate };
