"use strict";

const vscode = require("vscode");
const {
  analyzeFolding,
  collectAutomaticFoldLines,
  findContainingMethodInAnalysis,
} = require("./folding");
const {
  analyzeConstructs,
  findCurrentConstructInAnalysis,
  isPositionOnConstructKeyword,
} = require("./constructs");

const CONFIGURATION_SECTION = "bslAutoFold";
const DEFAULT_DELAY_MS = 150;

let autoFoldSession;
let constructHighlightSession;

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

class ConstructHighlightSession {
  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("editorBracketMatch.background"),
      borderColor: new vscode.ThemeColor("editorBracketMatch.border"),
      borderStyle: "solid",
      borderWidth: "1px",
      borderRadius: "2px",
    });
    this.analysisCache = new WeakMap();
    this.decoratedEditor = undefined;
  }

  analysisFor(document) {
    const cached = this.analysisCache.get(document);
    if (cached?.version === document.version) return cached.constructs;

    const constructs = analyzeConstructs(document.getText());
    this.analysisCache.set(document, { version: document.version, constructs });
    return constructs;
  }

  clear() {
    this.decoratedEditor?.setDecorations(this.decorationType, []);
    this.decoratedEditor = undefined;
  }

  update(editor) {
    if (this.decoratedEditor && this.decoratedEditor !== editor) this.clear();
    if (!isBslEditor(editor)
      || !configurationFor(editor.document).get("highlightCurrentConstruct", true)) {
      this.clear();
      return;
    }

    const config = configurationFor(editor.document);
    const constructs = this.analysisFor(editor.document);
    let current = findCurrentConstructInAnalysis(
      constructs,
      editor.selection.active.line,
    );
    if (!config.get("highlightConstructWhenCursorInside", false)
      && !isPositionOnConstructKeyword(
        current,
        editor.selection.active.line,
        editor.selection.active.character,
      )) {
      current = null;
    }
    const ranges = current?.keywords.map((keyword) => new vscode.Range(
      keyword.line,
      keyword.startCharacter,
      keyword.line,
      keyword.endCharacter,
    )) ?? [];

    editor.setDecorations(this.decorationType, ranges);
    this.decoratedEditor = editor;
  }

  documentChanged(document) {
    this.analysisCache.delete(document);
    const editor = vscode.window.activeTextEditor;
    if (editor?.document === document) this.update(editor);
  }

  close(document) {
    this.analysisCache.delete(document);
    if (this.decoratedEditor?.document === document) this.clear();
  }

  dispose() {
    this.clear();
    this.decorationType.dispose();
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
  const highlightSession = new ConstructHighlightSession();
  autoFoldSession = session;
  constructHighlightSession = highlightSession;

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { language: "bsl" },
      createFoldingRangeProvider(),
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      session.schedule(editor);
      highlightSession.update(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      handleNavigation(event);
      if (event.textEditor === vscode.window.activeTextEditor) {
        highlightSession.update(event.textEditor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      highlightSession.documentChanged(event.document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${CONFIGURATION_SECTION}.highlightCurrentConstruct`)
        || event.affectsConfiguration(`${CONFIGURATION_SECTION}.highlightConstructWhenCursorInside`)) {
        highlightSession.update(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      session.close(document);
      highlightSession.close(document);
    }),
    vscode.commands.registerCommand("bslAutoFold.foldMethods", async () => {
      await applyToMethods(vscode.window.activeTextEditor, "editor.fold");
    }),
    vscode.commands.registerCommand("bslAutoFold.unfoldMethods", async () => {
      await applyToMethods(vscode.window.activeTextEditor, "editor.unfold");
    }),
  );

  session.schedule(vscode.window.activeTextEditor);
  highlightSession.update(vscode.window.activeTextEditor);
}

function deactivate() {
  autoFoldSession?.dispose();
  constructHighlightSession?.dispose();
  autoFoldSession = undefined;
  constructHighlightSession = undefined;
}

module.exports = { activate, deactivate };
