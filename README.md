# 1C (BSL) Auto Fold

[Установить из Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Tyrael.bsl-auto-fold)

Небольшое расширение VS Code для BSL-модулей. При первом открытии файла
автоматически сворачивает все процедуры, функции и их многострочные
комментарии-описания. Переключение между уже
открытыми вкладками не сворачивает повторно методы, которые пользователь успел
развернуть.

При сворачивании метода закрывающая строка `КонецПроцедуры` или
`КонецФункции` также скрывается.

Если модуль открывается с переходом на конкретную строку, содержащий её метод
остаётся развёрнутым. Командная навигация к строке внутри уже свёрнутого метода
также разворачивает метод и внешние области, необходимые для показа строки.

## Команды

- `BSL Auto Fold: Свернуть все методы`;
- `BSL Auto Fold: Развернуть все методы`.

## Настройки

- `bslAutoFold.collapseMethodsOnOpen` — автоматическое сворачивание,
  по умолчанию включено;
- `bslAutoFold.collapseMethodDescriptionsOnOpen` — сворачивание описаний
  методов, по умолчанию включено;
- `bslAutoFold.collapseRegionsOnOpen` — сворачивание областей;
- `bslAutoFold.collapseConditionalsOnOpen` — сворачивание `Если`;
- `bslAutoFold.collapseLoopsOnOpen` — сворачивание циклов;
- `bslAutoFold.collapseTryBlocksOnOpen` — сворачивание `Попытка`;
- `bslAutoFold.collapsePreprocessorOnOpen` — сворачивание `#Если`;
- `bslAutoFold.delayMs` — задержка перед сворачиванием, по умолчанию
  150 мс.

Все дополнительные категории выключены по умолчанию и настраиваются
независимо друг от друга.

Расширение зависит от установленного `Language 1C (BSL)`: он регистрирует язык
`bsl`. Собственные folding ranges расширение рассчитывает самостоятельно.
Компонент `BSL Language Server` для автосворачивания не требуется и может
оставаться отключённым.

## Проверка

```powershell
npm test
```

## Установка

```powershell
code --install-extension Tyrael.bsl-auto-fold
```

Либо найдите `1C (BSL) Auto Fold` в панели Extensions VS Code.

## Локальная сборка VSIX

```text
npm install
npm run package:vsix
```
