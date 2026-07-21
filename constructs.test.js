"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  analyzeConstructs,
  findCurrentConstruct,
  findCurrentConstructInAnalysis,
  isPositionOnConstructKeyword,
} = require("./constructs");

function keywordValues(source, construct) {
  const lines = source.split("\n");
  return construct.keywords.map((keyword) => (
    lines[keyword.line].slice(keyword.startCharacter, keyword.endCharacter)
  ));
}

test("finds nested conditionals with all structural keywords", () => {
  const source = [
    "Если Первое Тогда",
    "    ИначеЕсли Второе Тогда",
    "    Если Вложенное Тогда",
    "        Иначе",
    "    КонецЕсли;",
    "Иначе",
    "КонецЕсли;",
  ].join("\n");

  const constructs = analyzeConstructs(source);
  assert.equal(constructs.length, 2);
  assert.deepEqual(keywordValues(source, constructs[0]), [
    "Если",
    "ИначеЕсли",
    "Иначе",
    "КонецЕсли",
  ]);
  assert.deepEqual(keywordValues(source, constructs[1]), [
    "Если",
    "Иначе",
    "КонецЕсли",
  ]);
  assert.equal(findCurrentConstructInAnalysis(constructs, 3), constructs[1]);
  assert.equal(findCurrentConstructInAnalysis(constructs, 5), constructs[0]);
});

test("selects the innermost complete construct under the cursor", () => {
  const source = [
    "#Область Выполнение",
    "Процедура Выполнить()",
    "    Пока Истина Цикл",
    "        Попытка",
    "        Исключение",
    "        КонецПопытки;",
    "    КонецЦикла;",
    "КонецПроцедуры",
    "#КонецОбласти",
  ].join("\n");

  assert.equal(findCurrentConstruct(source, 4).type, "try");
  assert.equal(findCurrentConstruct(source, 6).type, "loop");
  assert.equal(findCurrentConstruct(source, 7).type, "method");
  assert.equal(findCurrentConstruct(source, 8).type, "region");
});

test("finds preprocessor branches and English constructs", () => {
  const source = [
    "#If Server Then",
    "#ElsIf Client Then",
    "#Else",
    "#EndIf",
    "For Each Item In Items Do",
    "EndDo;",
    "Try",
    "Except",
    "EndTry;",
    "Async Function Load()",
    "EndFunction",
  ].join("\n");

  const constructs = analyzeConstructs(source);
  assert.deepEqual(constructs.map((construct) => construct.type), [
    "preprocessor",
    "loop",
    "try",
    "method",
  ]);
  assert.deepEqual(keywordValues(source, constructs[0]), [
    "#If",
    "#ElsIf",
    "#Else",
    "#EndIf",
  ]);
  assert.deepEqual(keywordValues(source, constructs[1]), ["For Each", "EndDo"]);
  assert.deepEqual(keywordValues(source, constructs[2]), ["Try", "Except", "EndTry"]);
  assert.deepEqual(keywordValues(source, constructs[3]), ["Function", "EndFunction"]);
});

test("ignores keywords in comments, strings, calls, and incomplete constructs", () => {
  const source = [
    "// Если Ложь Тогда",
    "Текст = \"КонецЕсли\";",
    "ВызватьПроцедуру();",
    "Если Незакрыто Тогда",
  ].join("\n");

  assert.deepEqual(analyzeConstructs(source), []);
  assert.equal(findCurrentConstruct(source, 3), null);
});

test("returns exact keyword positions after indentation", () => {
  const source = "    Если Истина Тогда\n    Иначе\n    КонецЕсли;";
  const [construct] = analyzeConstructs(source);

  assert.deepEqual(construct.keywords, [
    { line: 0, startCharacter: 4, endCharacter: 8 },
    { line: 1, startCharacter: 4, endCharacter: 9 },
    { line: 2, startCharacter: 4, endCharacter: 13 },
  ]);
});

test("distinguishes a keyword position from a position inside its construct", () => {
  const source = [
    "Пока ЕстьДанные() Цикл",
    "    ОбработатьДанные();",
    "КонецЦикла;",
  ].join("\n");
  const construct = findCurrentConstruct(source, 1);

  assert.equal(isPositionOnConstructKeyword(construct, 0, 2), true);
  assert.equal(isPositionOnConstructKeyword(construct, 2, 5), true);
  assert.equal(isPositionOnConstructKeyword(construct, 0, 10), false);
  assert.equal(isPositionOnConstructKeyword(construct, 1, 8), false);
});
