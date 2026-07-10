"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findContainingMethod,
  findMethodStartLines,
  findMethods,
  findMethodDescriptions,
  findRegionStartLines,
  findConditionalStartLines,
  findLoopStartLines,
  findTryStartLines,
  findPreprocessorStartLines,
  findBlockRanges,
} = require("./folding");

test("finds Russian and English methods", () => {
  const source = [
    "&НаСервере",
    "Процедура Первая()",
    "КонецПроцедуры",
    "",
    "Функция Вторая() Экспорт",
    "КонецФункции",
    "Async Function Third()",
    "EndFunction",
  ].join("\n");
  assert.deepEqual(findMethodStartLines(source), [1, 4, 6]);
  assert.deepEqual(findMethods(source), [
    { start: 1, end: 2 },
    { start: 4, end: 5 },
    { start: 6, end: 7 },
  ]);
  assert.deepEqual(findContainingMethod(source, 5), { start: 4, end: 5 });
  assert.equal(findContainingMethod(source, 3), null);
});

test("ignores comments and calls", () => {
  const source = [
    "// Процедура НеМетод()",
    "    ВызватьПроцедуру();",
    "Строка = \"Функция ТожеНеМетод()\";",
  ].join("\n");
  assert.deepEqual(findMethodStartLines(source), []);
});

test("ignores an incomplete method", () => {
  assert.deepEqual(findMethods("Процедура Незакрытая()\n    Возврат;"), []);
});

test("finds multi-line method descriptions above annotations", () => {
  const source = [
    "// Создаёт документ.",
    "//",
    "// Параметры:",
    "//  Документ - ДокументСсылка",
    "&НаСервере",
    "Процедура Создать(Документ)",
    "КонецПроцедуры",
    "",
    "// Однострочный комментарий не сворачивается",
    "Функция Получить()",
    "КонецФункции",
  ].join("\n");
  assert.deepEqual(findMethodDescriptions(source), [
    { start: 0, end: 3, methodStart: 5 },
  ]);
});

test("finds optional folding categories", () => {
  const source = [
    "#Область Служебные",
    "Если Истина Тогда",
    "Для Каждого Элемент Из Массив Цикл",
    "Пока Истина Цикл",
    "Попытка",
    "#Если Сервер Тогда",
    "#КонецЕсли",
    "КонецПопытки",
    "КонецЦикла",
    "КонецЦикла",
    "КонецЕсли",
    "#КонецОбласти",
  ].join("\n");
  assert.deepEqual(findRegionStartLines(source), [0]);
  assert.deepEqual(findConditionalStartLines(source), [1]);
  assert.deepEqual(findLoopStartLines(source), [2, 3]);
  assert.deepEqual(findTryStartLines(source), [4]);
  assert.deepEqual(findPreprocessorStartLines(source), [5]);
});

test("returns complete nested ranges including closing lines", () => {
  const source = [
    "#Область Служебные",
    "Функция Получить()",
    "Если Условие",
    "Тогда",
    "Для Каждого Элемент Из Массив Цикл",
    "Попытка",
    "#Если Сервер Тогда",
    "#КонецЕсли",
    "Исключение",
    "КонецПопытки",
    "КонецЦикла",
    "КонецЕсли",
    "КонецФункции",
    "#КонецОбласти",
  ].join("\n");
  assert.deepEqual(findBlockRanges(source), [
    { start: 0, end: 13, type: "region" },
    { start: 1, end: 12, type: "method" },
    { start: 2, end: 11, type: "conditional" },
    { start: 4, end: 10, type: "loop" },
    { start: 5, end: 9, type: "try" },
    { start: 6, end: 7, type: "preprocessor" },
  ]);
});
