# 1C (BSL) Auto Fold

[![Версия в Marketplace](https://img.shields.io/visual-studio-marketplace/v/Tyrael.bsl-auto-fold?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=Tyrael.bsl-auto-fold)
[![Установки](https://img.shields.io/visual-studio-marketplace/i/Tyrael.bsl-auto-fold?label=Установки)](https://marketplace.visualstudio.com/items?itemName=Tyrael.bsl-auto-fold)

Расширение для VS Code, которое автоматически сворачивает методы BSL-модуля
при его открытии. Большие модули сразу показываются как компактный список
процедур и функций, похожий на представление в конфигураторе 1С.

## Возможности

- сворачивает процедуры и функции при первом открытии BSL-файла;
- сворачивает многострочные комментарии-описания над методами;
- скрывает вместе с телом метода строку `КонецПроцедуры` или `КонецФункции`;
- не сворачивает методы повторно при переключении между открытыми вкладками;
- оставляет развёрнутым метод, если файл открыт с переходом на строку внутри
  него;
- разворачивает метод и содержащие его области при последующей навигации к
  конкретной строке;
- опционально сворачивает области, условия, циклы, блоки `Попытка` и директивы
  препроцессора.

## Установка

Откройте расширение в
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Tyrael.bsl-auto-fold)
или найдите `1C (BSL) Auto Fold` в панели Extensions VS Code.

Установка через командную строку:

```powershell
code --install-extension Tyrael.bsl-auto-fold
```

## Команды

Команды доступны через палитру `Ctrl+Shift+P`:

- `BSL Auto Fold: Свернуть все методы`;
- `BSL Auto Fold: Развернуть все методы`.

## Настройки

| Параметр | По умолчанию | Назначение |
| --- | ---: | --- |
| `bslAutoFold.collapseMethodsOnOpen` | `true` | Сворачивать процедуры и функции при открытии модуля. |
| `bslAutoFold.collapseMethodDescriptionsOnOpen` | `true` | Сворачивать многострочные описания перед методами. |
| `bslAutoFold.collapseRegionsOnOpen` | `false` | Сворачивать области. |
| `bslAutoFold.collapseConditionalsOnOpen` | `false` | Сворачивать конструкции `Если`. |
| `bslAutoFold.collapseLoopsOnOpen` | `false` | Сворачивать циклы `Для` и `Пока`. |
| `bslAutoFold.collapseTryBlocksOnOpen` | `false` | Сворачивать конструкции `Попытка`. |
| `bslAutoFold.collapsePreprocessorOnOpen` | `false` | Сворачивать условные блоки `#Если`. |
| `bslAutoFold.delayMs` | `150` | Задержка перед автоматическим сворачиванием, от 0 до 2000 мс. |

Дополнительные категории сворачивания независимы друг от друга и выключены по
умолчанию.

## Требования

Для регистрации языка `bsl` используется расширение
[`Language 1C (BSL)`](https://marketplace.visualstudio.com/items?itemName=1c-syntax.language-1c-bsl),
указанное как зависимость. Folding ranges рассчитывает само `1C (BSL) Auto
Fold`, поэтому запуск `BSL Language Server` для автосворачивания не требуется.

## Разработка

Установка зависимостей и запуск тестов:

```powershell
npm install
npm test
```

Локальная сборка VSIX для проверки перед публикацией:

```powershell
npm run package:vsix
```
