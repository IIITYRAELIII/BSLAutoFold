"use strict";

const METHOD_START = /^\s*(?:(?:Асинх|Async)\s+)?(?:Процедура|Функция|Procedure|Function)(?=\s)/i;
const METHOD_END = /^\s*(?:КонецПроцедуры|КонецФункции|EndProcedure|EndFunction)(?=\s|;|$)/i;
const ANNOTATION = /^\s*&/;
const COMMENT = /^\s*\/\//;
const REGION_START = /^\s*#(?:Область|Region)(?=\s|$)/i;
const REGION_END = /^\s*#(?:КонецОбласти|EndRegion)(?=\s|$)/i;
const CONDITIONAL_START = /^\s*(?:Если|If)(?=\s)/i;
const CONDITIONAL_END = /^\s*(?:КонецЕсли|EndIf)(?=\s|;|$)/i;
const LOOP_START = /^\s*(?:Для|For|Пока|While)(?=\s)/i;
const LOOP_END = /^\s*(?:КонецЦикла|EndDo)(?=\s|;|$)/i;
const TRY_START = /^\s*(?:Попытка|Try)\s*(?:\/\/.*)?$/i;
const TRY_END = /^\s*(?:КонецПопытки|EndTry)(?=\s|;|$)/i;
const PREPROCESSOR_START = /^\s*#(?:Если|If)(?=\s)/i;
const PREPROCESSOR_END = /^\s*#(?:КонецЕсли|EndIf)(?=\s|$)/i;

const BLOCKS = [
  { type: "region", start: REGION_START, end: REGION_END },
  { type: "preprocessor", start: PREPROCESSOR_START, end: PREPROCESSOR_END },
  { type: "method", start: METHOD_START, end: METHOD_END },
  { type: "conditional", start: CONDITIONAL_START, end: CONDITIONAL_END },
  { type: "loop", start: LOOP_START, end: LOOP_END },
  { type: "try", start: TRY_START, end: TRY_END },
];

const START_EXPRESSIONS = {
  region: REGION_START,
  conditional: CONDITIONAL_START,
  loop: LOOP_START,
  try: TRY_START,
  preprocessor: PREPROCESSOR_START,
};

function splitLines(text) {
  return String(text).split(/\r?\n/);
}

function findMethodsInLines(lines) {
  const methods = [];
  let currentStart = null;

  for (let line = 0; line < lines.length; line += 1) {
    if (currentStart == null && METHOD_START.test(lines[line])) {
      currentStart = line;
    } else if (currentStart != null && METHOD_END.test(lines[line])) {
      methods.push({ start: currentStart, end: line });
      currentStart = null;
    }
  }
  return methods;
}

function findMethodDescriptionsInLines(lines, methods) {
  const descriptions = [];

  for (const method of methods) {
    let line = method.start - 1;
    while (line >= 0 && ANNOTATION.test(lines[line])) line -= 1;
    const end = line;
    while (line >= 0 && COMMENT.test(lines[line])) line -= 1;
    const start = line + 1;
    if (start < end) descriptions.push({ start, end, methodStart: method.start });
  }
  return descriptions;
}

function findStartLinesInLines(lines, expression) {
  const result = [];
  for (let line = 0; line < lines.length; line += 1) {
    if (expression.test(lines[line])) result.push(line);
  }
  return result;
}

function findBlockRangesInLines(lines) {
  const stack = [];
  const ranges = [];

  for (let line = 0; line < lines.length; line += 1) {
    const sourceLine = lines[line];
    const endingBlock = BLOCKS.find((block) => block.end.test(sourceLine));
    if (endingBlock) {
      const stackIndex = stack.findLastIndex((entry) => entry.type === endingBlock.type);
      if (stackIndex >= 0) {
        const [start] = stack.splice(stackIndex, 1);
        if (start.line < line) ranges.push({ start: start.line, end: line, type: start.type });
      }
      continue;
    }

    const startingBlock = BLOCKS.find((block) => block.start.test(sourceLine));
    if (startingBlock) stack.push({ type: startingBlock.type, line });
  }

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

function analyzeFolding(text) {
  const lines = splitLines(text);
  const methods = findMethodsInLines(lines);
  const startLines = Object.fromEntries(
    Object.entries(START_EXPRESSIONS)
      .map(([type, expression]) => [type, findStartLinesInLines(lines, expression)]),
  );

  return {
    methods,
    descriptions: findMethodDescriptionsInLines(lines, methods),
    blocks: findBlockRangesInLines(lines),
    startLines,
  };
}

function findContainingMethodInAnalysis(analysis, line) {
  return analysis.methods.find((method) => method.start <= line && line <= method.end) ?? null;
}

function collectAutomaticFoldLines(analysis, targetLine, options) {
  const targetMethod = findContainingMethodInAnalysis(analysis, targetLine);
  const result = [];

  if (options.methodDescriptions) {
    result.push(...analysis.descriptions
      .filter((description) => !(description.start <= targetLine && targetLine <= description.end))
      .map((description) => description.start));
  }
  if (options.methods) {
    result.push(...analysis.methods
      .map((method) => method.start)
      .filter((line) => line !== targetMethod?.start));
  }

  for (const type of ["region", "conditional", "loop", "try", "preprocessor"]) {
    if (options[type]) result.push(...analysis.startLines[type]);
  }

  return [...new Set(result)].sort((left, right) => right - left);
}

function findMethods(text) {
  return findMethodsInLines(splitLines(text));
}

function findMethodStartLines(text) {
  return findMethods(text).map((method) => method.start);
}

function findMethodDescriptions(text) {
  const lines = splitLines(text);
  return findMethodDescriptionsInLines(lines, findMethodsInLines(lines));
}

function findStartLines(text, type) {
  return findStartLinesInLines(splitLines(text), START_EXPRESSIONS[type]);
}

function findRegionStartLines(text) {
  return findStartLines(text, "region");
}

function findConditionalStartLines(text) {
  return findStartLines(text, "conditional");
}

function findLoopStartLines(text) {
  return findStartLines(text, "loop");
}

function findTryStartLines(text) {
  return findStartLines(text, "try");
}

function findPreprocessorStartLines(text) {
  return findStartLines(text, "preprocessor");
}

function findBlockRanges(text) {
  return findBlockRangesInLines(splitLines(text));
}

function findContainingMethod(text, line) {
  return findContainingMethodInAnalysis({ methods: findMethods(text) }, line);
}

module.exports = {
  analyzeFolding,
  collectAutomaticFoldLines,
  findContainingMethod,
  findContainingMethodInAnalysis,
  findMethodStartLines,
  findMethods,
  findMethodDescriptions,
  findRegionStartLines,
  findConditionalStartLines,
  findLoopStartLines,
  findTryStartLines,
  findPreprocessorStartLines,
  findBlockRanges,
};
