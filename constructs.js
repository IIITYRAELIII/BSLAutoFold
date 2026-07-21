"use strict";

const CONSTRUCTS = [
  {
    type: "region",
    start: /^\s*(#(?:Область|Region))(?=\s|$)/i,
    end: /^\s*(#(?:КонецОбласти|EndRegion))(?=\s|$)/i,
  },
  {
    type: "preprocessor",
    start: /^\s*(#(?:Если|If))(?=\s)/i,
    branch: /^\s*(#(?:ИначеЕсли|ElsIf|Иначе|Else))(?=\s|$)/i,
    end: /^\s*(#(?:КонецЕсли|EndIf))(?=\s|$)/i,
  },
  {
    type: "method",
    start: /^\s*(?:(?:Асинх|Async)\s+)?(Процедура|Функция|Procedure|Function)(?=\s)/i,
    end: /^\s*(КонецПроцедуры|КонецФункции|EndProcedure|EndFunction)(?=\s|;|$)/i,
  },
  {
    type: "conditional",
    start: /^\s*(Если|If)(?=\s)/i,
    branch: /^\s*(ИначеЕсли|ElsIf|Иначе|Else)(?=\s|$)/i,
    end: /^\s*(КонецЕсли|EndIf)(?=\s|;|$)/i,
  },
  {
    type: "loop",
    start: /^\s*((?:Для(?:\s+Каждого)?|For(?:\s+Each)?|Пока|While))(?=\s)/i,
    end: /^\s*(КонецЦикла|EndDo)(?=\s|;|$)/i,
  },
  {
    type: "try",
    start: /^\s*(Попытка|Try)(?=\s*(?:\/\/.*)?$)/i,
    branch: /^\s*(Исключение|Except)(?=\s*(?:\/\/.*)?$)/i,
    end: /^\s*(КонецПопытки|EndTry)(?=\s|;|$)/i,
  },
];

function splitLines(text) {
  return String(text).split(/\r?\n/);
}

function tokenOnLine(sourceLine, expression, line) {
  const match = expression?.exec(sourceLine);
  if (!match) return null;

  const value = match[1];
  const startCharacter = match.index + match[0].lastIndexOf(value);
  return {
    line,
    startCharacter,
    endCharacter: startCharacter + value.length,
  };
}

function findMatchingDefinition(sourceLine, property, line) {
  for (const definition of CONSTRUCTS) {
    const token = tokenOnLine(sourceLine, definition[property], line);
    if (token) return { definition, token };
  }
  return null;
}

function findOpenConstruct(stack, type) {
  const index = stack.findLastIndex((entry) => entry.type === type);
  return index < 0 ? null : { entry: stack[index], index };
}

function analyzeConstructs(text) {
  const lines = splitLines(text);
  const stack = [];
  const constructs = [];

  for (let line = 0; line < lines.length; line += 1) {
    const sourceLine = lines[line];
    const ending = findMatchingDefinition(sourceLine, "end", line);
    if (ending) {
      const open = findOpenConstruct(stack, ending.definition.type);
      if (open) {
        stack.splice(open.index, 1);
        constructs.push({
          type: open.entry.type,
          start: open.entry.start,
          end: line,
          keywords: [...open.entry.keywords, ending.token],
        });
      }
      continue;
    }

    const branch = findMatchingDefinition(sourceLine, "branch", line);
    if (branch) {
      const open = findOpenConstruct(stack, branch.definition.type);
      if (open) open.entry.keywords.push(branch.token);
      continue;
    }

    const starting = findMatchingDefinition(sourceLine, "start", line);
    if (starting) {
      stack.push({
        type: starting.definition.type,
        start: line,
        keywords: [starting.token],
      });
    }
  }

  return constructs.sort((left, right) => (
    left.start - right.start || right.end - left.end
  ));
}

function findCurrentConstructInAnalysis(constructs, line) {
  let current = null;

  for (const construct of constructs) {
    if (construct.start > line || construct.end < line) continue;
    if (!current
      || construct.end - construct.start < current.end - current.start
      || (construct.end - construct.start === current.end - current.start
        && construct.start > current.start)) {
      current = construct;
    }
  }

  return current;
}

function findCurrentConstruct(text, line) {
  return findCurrentConstructInAnalysis(analyzeConstructs(text), line);
}

module.exports = {
  analyzeConstructs,
  findCurrentConstruct,
  findCurrentConstructInAnalysis,
};
