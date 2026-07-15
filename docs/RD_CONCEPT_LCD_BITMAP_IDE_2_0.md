# R&D Concept Paper 2.0: LCD-bitmap-IDE

Дата актуализации: 24 июня 2026
Статус: архитектурная концепция развития после Phase 3A
Рабочая копия: `LCD-bitmap-IDE-production`, ветка `refactor/fsm-semantic-roundtrip`

## 1. Краткое позиционирование

LCD-bitmap-IDE следует развивать не как набор отдельных редакторов экранов, а как model-driven and agent-verifiable Embedded HMI Workbench - среду проектирования малоресурсных графических интерфейсов, где LCD-экраны, FSM-логика, ресурсы локализации, симуляция и C-export управляются через формальную доменную модель.

Ключевая идея версии 2.0: все пользовательские, API- и AI-агентные изменения должны проходить через единый application core: typed commands, query API, deterministic compiler/codegen boundary, semantic diagnostics, dry-run, ChangeSet, approval и audit trail.

Такой подход превращает IDE в инженерную платформу:

- человек работает через GUI;
- автоматизация работает через CLI/HTTP API;
- AI-агент работает через MCP-адаптер;
- тесты работают через те же команды и запросы;
- C-codegen получает только нормализованную, проверенную модель.

## 2. Фактическое состояние проекта

На момент актуализации это уже не начальный прототип. В локальном репозитории реализованы и проверены следующие архитектурные слои:

- четырехзонная рабочая среда для экранов, FSM, панели управления и симуляции;
- project schema v5 с миграциями из более ранних форматов;
- независимые LCD screens и FSM states;
- bitmap/canvas editor с объектами, импортом изображений и шрифтов;
- runtime simulator для сценариев переходов;
- C/binary export для текущей legacy-цели;
- трехъязычный интерфейс IDE: EN/RU/ZH;
- Application Command Bus и session revision model;
- command-based history для ключевых сценариев store migration;
- normalized compiler IR;
- deterministic codegen boundary с artifact digest и equivalence gate;
- backend SPI для codegen;
- FSM semantic round-trip core: FSM -> Mermaid/Python-like DSL -> parser -> semantic diff -> ChangeSet -> explicit Apply.

Также добавлены архитектурные документы и ADR по command bus, compiler boundaries, deterministic codegen и FSM interchange model.

### Важное ограничение статуса

Production MCP server, публичный REST/OpenAPI слой, plugin SDK, schema-v6 localization frame model и полноценная live-синхронизация FSM пока не реализованы. Их нужно вводить после стабилизации application API, чтобы MCP был внешним адаптером к Command Bus, а не отдельным источником мутаций.

## 3. Целевой продуктовый образ

Целевой продукт - offline-first IDE для embedded HMI, способная генерировать воспроизводимые артефакты прошивки и безопасно принимать изменения от AI-агента.

Главные конкурентные отличия:

- визуальное проектирование малых LCD/OLED интерфейсов с учетом ограничений flash/RAM;
- FSM как первичная доменная сущность, а не вспомогательная диаграмма;
- безопасный script round-trip без выполнения пользовательского кода;
- детерминированный compiler/codegen pipeline;
- локализация, не меняющая геометрию экранов;
- AI-agent workflow с dry-run, diagnostics, diff и human approval;
- будущий MCP/API слой, работающий поверх того же application core, что и GUI.

## 4. Agent AI-oriented архитектура

AI-агент не должен получать весь `.lcdproj`, произвольно редактировать JSON и возвращать новый файл. Это создает неуправляемые мутации, ломает историю и делает результат трудно проверяемым.

Правильная модель:

1. Agent запрашивает состояние через Query API.
2. Agent выбирает capability из Capability Registry.
3. Agent вызывает typed command в режиме dry-run.
4. Application core возвращает diagnostics, semantic diff, ChangeSet и expectedRevision.
5. Человек или политика approval подтверждает commit.
6. Команда записывается в history/audit trail.
7. Verification layer формирует evidence bundle.

### Роли специализированных агентов

- Requirements Agent: преобразует текстовые требования в проверяемые HMI/FSM acceptance criteria.
- FSM Architect Agent: предлагает состояния, события, transitions и guards.
- HMI Layout Agent: проектирует экраны в рамках заданной LCD-геометрии и layout constraints.
- Localization Agent: проверяет тексты, placeholders, терминологию и переполнение text frames.
- Verification Agent: запускает compile/simulate/preflight и объясняет diagnostics.
- Release Agent: собирает export artifacts, digests, reports и traceability summary.

Каждый агент должен быть ограничен capability registry, revision guard, dry-run и explicit apply.

## 5. API-first и MCP-управляемость

Целевая архитектура должна иметь один application core и несколько адаптеров:

```text
GUI / CLI / REST API / MCP / tests
          |
          v
Application Command Bus + Query API
          |
          v
Domain model + compiler IR + codegen facade + verification
```

GUI не должен оставаться единственным способом изменить проект. Но и MCP не должен обходить GUI и напрямую менять Zustand/React store. Все внешние интерфейсы должны использовать те же commands, validation и ChangeSet.

### Capability Registry

Capability Registry должен стать машинно-читаемым каталогом операций:

- stable capability id;
- JSON schema для input/output;
- permissions и risk level;
- support for dry-run/commit;
- expectedRevision;
- affected domain: screen, fsm, localization, codegen, project;
- diagnostics contract;
- undo/redo semantics;
- examples для документации, CLI, OpenAPI и MCP.

Из одной capability-декларации должны формироваться:

- GUI action;
- CLI command;
- OpenAPI operation;
- MCP tool;
- test fixture;
- документация.

### MCP primitives

MCP следует вводить как thin adapter после стабилизации application API.

Tools:

- `project.open`, `project.validate`, `project.save`;
- `screen.create`, `screen.updateObject`, `screen.renderPreview`;
- `fsm.export`, `fsm.previewImport`, `fsm.applyImport`;
- `localization.preflight`, `localization.updateMessage`;
- `codegen.preview`, `codegen.export`;
- `verification.runScenario`.

Resources:

- project summary;
- screen tree;
- FSM model and semantic hash;
- compiler diagnostics;
- codegen reports and digests;
- localization catalog;
- generated artifacts.

Prompts:

- generate HMI from requirements;
- review FSM for unreachable states;
- prepare localization preflight;
- explain compiler diagnostics;
- produce release checklist.

Для локального desktop-приложения первичным транспортом MCP лучше считать stdio. Remote Streamable HTTP стоит вводить позже, отдельно, с authentication, Origin checks, explicit workspace binding и разрешениями на запись.

## 6. Стабильность при смене языка интерфейса

Требование: смена языка интерфейса IDE или языка предпросмотра firmware не должна менять геометрию экранов, FSM-логику, идентификаторы, связи объектов, z-order, C-symbols и результат компиляции структуры проекта.

Нужно разделить четыре разных понятия языка:

- IDE locale - язык самой программы и меню;
- authoring locale - язык, на котором пользователь редактирует подписи;
- preview locale - язык предпросмотра устройства;
- export locale set - набор языков, включаемых в firmware build.

IDE locale должна храниться в пользовательских настройках, а не в проектной модели. Переключение IDE locale не должно создавать новую revision, audit entry или состояние unsaved changes.

### Текущее ограничение модели

Текущий `TextCanvasObject` хранит локализованный текст и координаты, но не задает полноценный фиксированный текстовый контейнер. Если ширина объекта вычисляется из строки активного языка, более длинный перевод может изменить bounding box, hit testing и вероятность пересечения объектов.

Для embedded HMI это риск: один и тот же экран на английском и русском может начать занимать разное пространство, хотя логика и C-export должны оставаться стабильными.

### Предлагаемая schema-v6: ресурсы сообщений и text frames

Нужно разделить текстовый ресурс и геометрический объект.

`MessageResource`:

- immutable `messageId`;
- translations by locale;
- `short`, `normal`, `long` variants;
- placeholders;
- terminology tags;
- max length hints;
- fallback locale.

`TextFrameObject`:

- stable object id;
- `x`, `y`, `width`, `height`;
- alignment;
- maxLines;
- fontRole;
- fitPolicy: clip, ellipsis, shrink, wrap;
- layoutPolicy: locked;
- messageId reference;
- optional variant preference.

В этой модели язык меняет только содержимое ресурса сообщения. Координаты, размеры контейнера, UUID, FSM bindings, zIndex, transition targets и C-symbols остаются неизменными.

### Localization Preflight

Перед export и release нужно запускать preflight для всех языков:

- переполнение text frame;
- отсутствующие glyphs;
- placeholder mismatch;
- терминологические нарушения;
- конфликт единиц измерения и числовых форматов;
- слишком длинные значения ошибок, дат, режимов и кнопок;
- flash/RAM budget;
- псевдолокализация;
- layout hash и FSM hash одинаковы для всех preview/export locales.

Если перевод не помещается, система должна выдавать diagnostic и предложить варианты: выбрать short variant, уменьшить fontRole, включить ellipsis/wrap или вручную увеличить frame. Автоматически двигать соседние объекты нельзя без отдельной команды layout refactor.

## 7. Детерминированный codegen boundary

Codegen должен оставаться функцией от нормализованной модели, target profile и версии backend. Для Agent/API/MCP это критично: агент может менять модель, но не должен получать скрытый недетерминированный результат.

Целевые свойства:

- stable ordering всех declarations и artifacts;
- canonical serialization входного IR;
- artifact digest для каждого export;
- equivalence tests legacy output;
- compiler diagnostics до записи файлов;
- explicit target profile;
- no direct renderer/store dependency in codegen.

Следующий этап после текущей реализации - расширять backend SPI через controller/display profiles, а не через ad hoc генераторы в UI.

## 8. FSM semantic round-trip

Phase 3A заложила правильное ядро: безопасный round-trip без live mutation.

Стабильная модель:

- export FSM в interchange model v1;
- canonical semantic fingerprint;
- Mermaid subset и Python-like DSL;
- безопасный parser без выполнения Python-кода;
- semantic diff;
- dry-run ChangeSet;
- explicit Apply через command bus;
- stale preview/revision protection.

Полную live-синхронизацию стоит включать только после того, как будут стабилизированы diagnostics UX, conflict resolution, undo/redo semantics и expectedRevision во всех связанных командах.

## 9. Plugin architecture

Платформе нужен расширяемый, но контролируемый plugin layer.

Кандидаты для plugin extension points:

- display profiles: resolution, orientation, color depth, packing;
- controller profiles: SSD1306, ST7565, UC1701, ST7920 и другие;
- HAL templates: STM32 HAL, AVR, ESP-IDF;
- codegen backends;
- importers/exporters;
- validation rule packs;
- reusable screen patterns;
- agent skill packs.

Плагины не должны напрямую писать в проектную модель. Они должны регистрировать capabilities, validators, backends или templates и выполняться через application core.

## 10. Рекомендуемая дорожная карта

### Stage 0 - завершенная база

- Store migration и command-based history.
- Normalized compiler IR.
- Deterministic codegen boundary.
- FSM semantic round-trip core.

### Stage 1 - language-stable layout model

- schema-v6 для MessageResource и TextFrameObject;
- миграция существующих TextCanvasObject;
- separation of IDE locale, authoring locale, preview locale и export locale set;
- localization preflight;
- layout/FSM hash invariants across locales.

### Stage 2 - stable application API

- Query API;
- Capability Registry;
- uniform dry-run/commit contract;
- command result envelope;
- evidence bundle format;
- stronger undo/redo and conflict handling.

### Stage 3 - CLI and OpenAPI

- CLI поверх application core;
- OpenAPI schema generation из capabilities;
- contract tests для GUI/CLI/API parity;
- headless validation и codegen.

### Stage 4 - MCP adapter

- local stdio MCP server;
- MCP tools/resources/prompts из Capability Registry;
- explicit workspace binding;
- read-only mode by default;
- approval gate для mutating commands.

### Stage 5 - Agent workflows

- FSM generation from requirements;
- screen synthesis with constraints;
- localization review;
- release verification;
- report generation with traceability and digests.

### Stage 6 - controller-aware compiler platform

- display/controller profile registry;
- multiple packing strategies;
- HAL templates;
- backend conformance tests;
- fixture suite for real devices.

## 11. Acceptance criteria

Language stability:

- переключение IDE locale не меняет project revision;
- preview locale не меняет object ids, coordinates, dimensions, FSM, bindings и C-symbols;
- localization changes are commands against message resources;
- all export locales pass preflight or produce actionable diagnostics.

Agent/API/MCP readiness:

- every mutating operation has dry-run;
- every command requires expectedRevision;
- all command results include diagnostics and affected entities;
- MCP adapter calls only application API;
- no external adapter mutates Zustand/React store directly.

Codegen:

- identical input model and target profile produce identical artifacts and digests;
- compiler/codegen does not depend on active UI language;
- generated artifacts include traceable model/codegen metadata.

FSM:

- script import never executes user code;
- semantic diff is shown before Apply;
- stale preview cannot be applied;
- round-trip preserves semantic fingerprint when no semantic change is made.

## 12. Главный архитектурный принцип

LCD-bitmap-IDE должен развиваться как command-driven engineering system. GUI, AI Agent, API и MCP - это разные входы в одну и ту же проверяемую модель. Инновационность продукта будет не в том, что AI может "редактировать файл", а в том, что агент сможет проектировать embedded HMI через безопасные инженерные операции с доказуемыми diff, diagnostics, replay, rollback и deterministic export.

## Phase 4A appendix, 2026-06-25

Screen Interchange Model V1 is now the stable LCD screen authoring package boundary. It exports project-level and single-screen packages with screen order, object order, geometry, localized text, font refs, bitmap refs, resource closure, traceability, canonical serialization and deterministic fingerprints.

This boundary is derived from schema-v5 projects. It is not persisted as a new schema field, does not change generated C/binary output, does not introduce a Screen DSL and does not provide MCP or AI mutation APIs. Future adapters should use this model for read/compare/package workflows and still route mutations through the application Command Bus.
