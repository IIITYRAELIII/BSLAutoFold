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

function findMethods(text) {
  const lines = String(text).split(/\r?\n/);
  const result = [];
  let currentStart = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (currentStart == null && METHOD_START.test(lines[index])) {
      currentStart = index;
      continue;
    }
    if (currentStart != null && METHOD_END.test(lines[index])) {
      result.push({ start: currentStart, end: index });
      currentStart = null;
    }
  }
  return result;
}

function findMethodStartLines(text) {
  return findMethods(text).map((method) => method.start);
}

function findMethodDescriptions(text) {
  const lines = String(text).split(/\r?\n/);
  const descriptions = [];

  for (const method of findMethods(text)) {
    let line = method.start - 1;
    while (line >= 0 && ANNOTATION.test(lines[line])) line -= 1;
    const end = line;
    while (line >= 0 && COMMENT.test(lines[line])) line -= 1;
    const start = line + 1;
    if (start < end) descriptions.push({ start, end, methodStart: method.start });
  }

  return descriptions;
}

function findStartLines(text, expression) {
  return String(text)
    .split(/\r?\n/)
    .flatMap((line, index) => expression.test(line) ? [index] : []);
}

function findRegionStartLines(text) {
  return findStartLines(text, REGION_START);
}

function findConditionalStartLines(text) {
  return findStartLines(text, CONDITIONAL_START);
}

function findLoopStartLines(text) {
  return findStartLines(text, LOOP_START);
}

function findTryStartLines(text) {
  return findStartLines(text, TRY_START);
}

function findPreprocessorStartLines(text) {
  return findStartLines(text, PREPROCESSOR_START);
}

function findBlockRanges(text) {
  const lines = String(text).split(/\r?\n/);
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

function findContainingMethod(text, line) {
  return findMethods(text).find((method) => method.start <= line && line <= method.end) ?? null;
}

module.exports = {
  findMethods,
  findMethodStartLines,
  findMethodDescriptions,
  findContainingMethod,
  findRegionStartLines,
  findConditionalStartLines,
  findLoopStartLines,
  findTryStartLines,
  findPreprocessorStartLines,
  findBlockRanges,
};
