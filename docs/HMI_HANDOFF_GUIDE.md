# HMI Handoff Guide / Передача HMI / HMI 交付指南

## Русский

Рабочая область **«Передача HMI»** предназначена для подготовки одного
самодостаточного ZIP-пакета разработчикам прошивки.

1. Откройте или создайте проект 128×64.
2. Нажмите **«Установить профиль ЭКРОС»**. В проект будут добавлены
   динамические теги, формулы и источники данных ЭКРОС-5300ВИ/5310.
3. Выберите экран и надпись. Нажмите карточку динамического поля, чтобы
   записать в объект привязку `CanvasObject.bindings.text`.
4. Используйте **«Клон только макета»**, если копия не должна участвовать в
   FSM. Используйте **«Клон с FSM-состоянием»**, если нужен новый экранный
   шаг сценария.
5. В настольной Electron-версии выберите COM-порт и нажмите
   **«Подключить и определить»**. Программа выполняет `connect`, `gettype`,
   `getsoftver`, `getsn` последовательно.
6. Нажмите **«Экспорт ZIP поставщику»**.

Пакет содержит C/H, общий BIN, XBM, Arduino PROGMEM, Rust, PNG-превью для
RU/EN/ZH, реестр текстов CSV, карту экранов JSON, минимальный набор глифов,
формулы C, CLI-контракты и `manifest.json` с SHA-256.

### Ограничения расчётов

- Однолучевая оптическая плотность:
  `A = log10((E100 - E0) / (Esample - E0))`.
- Пропускание:
  `%T = 100 * (Esample - E0) / (E100 - E0)`.
- Текущая формула концентрации предполагает
  `A = m*C + k`, поэтому `C = (A - k) / m`.
- Деление на ноль, отрицательный аргумент логарифма и нечисловой результат
  помечаются как недействительные.
- Формула повторяемости `r, %` ещё должна быть подтверждена владельцем
  методики; редактор пока хранит её как входной/расчётный тег.

## English

Use **HMI Handoff** to bind LCD text objects to runtime tags and create a
supplier-ready ZIP. Install the ECROS preset, select a screen and text object,
click a dynamic-field card, optionally verify the instrument through the
desktop COM panel, then export the package.

The simulator and generated C use the same restricted formula language. The
formula language accepts numeric references, parentheses, `+ - * /`, and
`abs`, `log10`, `sqrt`, `min`, `max`, `pow`; it never executes JavaScript.

## 简体中文

使用 **HMI 交付** 工作区将 LCD 文本对象绑定到运行时标签，并生成供应商
可直接使用的 ZIP 包。

1. 安装 ECROS 预设。
2. 选择屏幕和文本对象。
3. 点击动态字段卡片完成绑定。
4. 桌面版可通过 COM 端口依次执行 `connect`、`gettype`、
   `getsoftver`、`getsn`。
5. 导出供应商 ZIP。

ZIP 包含 C/H、BIN、XBM、Arduino、Rust、三语 PNG、CSV、JSON、使用字形、
公式源代码以及带 SHA-256 的清单。
