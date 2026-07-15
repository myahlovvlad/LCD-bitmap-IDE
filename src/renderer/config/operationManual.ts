/**
 * @module renderer/config/operationManual
 * @description Enterprise-grade, in-app operation manual content for LCD-bitmap IDE.
 *
 * The manual uses one shared structure across English, Russian and Simplified
 * Chinese. Every locale exposes the same ordered sections and the same block
 * types so the rendering, navigation and information-methodical style stay
 * identical. Typical engineering tasks follow a fixed didactic template:
 *
 *   Task (goal)  ->  Principle & roadmap of the solution  ->  Step-by-step.
 *
 * Diagrams are rendered as monospace ASCII schematics so the manual stays fully
 * offline (no external images or CDN) and crisp on the monochrome LCD theme.
 */

/** A single renderable block inside a manual section. */
export type ManualBlock =
  | { kind: 'lead'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'diagram'; caption?: string; art: string }
  | { kind: 'task'; task: string; principle: string; steps: string[] };

/** One top-level manual section with a stable id for the table of contents. */
export interface ManualSection {
  id: string;
  title: string;
  summary?: string;
  blocks: ManualBlock[];
}

/**
 * Language-neutral ASCII schematics shared by every locale. Labels are kept
 * short and symbolic (LCD, FSM, .h/.bin) so a single diagram reads correctly in
 * all three languages; localized captions are attached at the call site.
 */
const DIAGRAM = {
  concept: String.raw`
 +------------------ Project (.lcdproj) -------------------+
 |                                                         |
 |   +--- Screen ---+   +--- Screen ---+   +--- Screen --+ |
 |   |  128 x 64    |   |  128 x 64    |   |  128 x 64   | |
 |   |  text  line  |   |  rect  glyph |   |  bitmap     | |
 |   |  special     |   |  special     |   |  special    | |
 |   +------+-------+   +------+-------+   +------+------+ |
 |          |  bound to FSM state |               |        |
 |   +------+----------------- FSM ---------------+------+ |
 |   |  [*] -> S1 -> S2 -> S3 ...   transitions/events   | |
 |   +---------------------------------------------------+ |
 +----------------------------+----------------------------+
                              |  export
                     +--------+---------+
                     |   .h   |  .bin   |  1 bpp framebuffer
                     +------------------+`,
  layout: String.raw`
+----------------------------------------------------------------------------+
| Project: Open Save Export Undo Redo Manual Version History Language         |
+----------------------------------------------------------------------------+
| Workspaces: [ FSM ] [ LCD ] [ CONTROL PANEL ] [ PREVIEW ]                  |
+----------------------+--------------------------------+--------------------+
| Workspace entities   | Workspace canvas/tools         | Inspector/validation|
| states or screens    | graph, bitmap or SVG surface   | references/log      |
+----------------------+--------------------------------+--------------------+
| Status: display - states - screens - panel elements - validation            |
+----------------------------------------------------------------------------+`,
  packing: String.raw`
   128 x 64  =  8 vertical pages x 128 columns,  1 byte per column/page
   bit 0 = top row of the page  (LSB at top)

          col ->  0    1    2   ...  127
        page 0  [..] [..] [..]  ...  [..]   rows  0..7
        page 1  [..] [..] [..]  ...  [..]   rows  8..15
          ...
        page 7  [..] [..] [..]  ...  [..]   rows 56..63

   total = 128 columns x 8 pages = 1024 bytes`,
  screen: String.raw`
   +------------------------------+   <- 128 x 64 monochrome LCD
   | MAIN MENU                 ## |
   | ---------------------------- |
   | > Photometry                 |
   |   Quant. analysis            |
   |   Kinetics                   |
   |   Settings              [==] |
   +------------------------------+`,
  flow: String.raw`
   [*] --> BOOT --> MENU --> MEASURE --> RESULT
                     |  ^                   |
                     |  +---- back ---------+
                     +--> SETTINGS`
} as const;

/* ----------------------------------------------------------------------------
 * English
 * ------------------------------------------------------------------------- */
export const OPERATION_MANUAL_EN: ManualSection[] = [
  {
    id: 'overview',
    title: '1. Overview',
    summary: 'What LCD-bitmap IDE is and the concepts you work with.',
    blocks: [
      {
        kind: 'lead',
        text: 'LCD-bitmap IDE is an offline workbench for designing monochrome LCD screens, bitmap fonts and finite-state-machine (FSM) navigation flows, and for exporting firmware-ready C arrays or binary framebuffers.'
      },
      {
        kind: 'diagram',
        caption: 'Concept model: a project holds screens, screens bind to FSM states, everything exports to firmware payloads.',
        art: DIAGRAM.concept
      },
      {
        kind: 'table',
        headers: ['Concept', 'Meaning'],
        rows: [
          ['Project', 'The whole design, saved as a portable .lcdproj file.'],
          ['Screen', 'One 128x64 (or profile-sized) monochrome canvas with objects.'],
          ['Object', 'Text, line, rectangle, bitmap, special element or glyph on a screen.'],
          ['FSM state', 'A node in the navigation graph, bound to one screen.'],
          ['Transition', 'An event-labelled edge from one state to another.'],
          ['Framebuffer', '1-bit-per-pixel packed bytes sent to the device.']
        ]
      }
    ]
  },
  {
    id: 'interface',
    title: '2. Interface map',
    summary: 'Where each tool lives on screen.',
    blocks: [
      {
        kind: 'diagram',
        caption: 'Main window: navigation on the left, FSM graph in the centre, LCD editor on the right.',
        art: DIAGRAM.layout
      },
      {
        kind: 'table',
        headers: ['Area', 'Purpose'],
        rows: [
          ['Command center', 'Project name/version/history, project actions, search, editor modes, display and work mode.'],
          ['Control panel shutter', 'Local saves, metrics and custom display width/height.'],
          ['Screens list', 'Add, duplicate, rename, delete and reorder screens; preview thumbnails.'],
          ['FSM graph', 'Drag state tiles at any time; positions are autosaved. Auto arrange, edit transitions and fullscreen.'],
          ['LCD editor', 'Canvas tools, element properties, screen export, font loader, glyph editor.'],
          ['Panel controls', 'Collapse Screens, State list, FSM canvas or LCD editor; drag separators to resize.'],
          ['Status bar', 'Display size, state and transition counts, autosave time.']
        ]
      },
      {
        kind: 'table',
        headers: ['Canvas tool', 'Action'],
        rows: [
          ['Select', 'Pick and move objects; drag empty area to marquee-select.'],
          ['Text', 'Place a text object using Font 1 or Font 2.'],
          ['Line / Rectangle', 'Draw straight or rectangular primitives.'],
          ['Invert row', 'Invert a horizontal band of pixels.'],
          ['Special element', 'Checkbox, radio, progress bar, battery, signal bars, scrollbar.'],
          ['Glyph editor', 'Edit individual glyph pixels for a font variant.']
        ]
      }
    ]
  },
  {
    id: 'getting-started',
    title: '3. Getting started',
    summary: 'Launch the application and open a project.',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Packaged desktop app: launch LCD-bitmap IDE from the installed shortcut.',
          'From source (web): run "npm run dev" and open http://127.0.0.1:5173.',
          'From source (desktop): run "npm run electron:dev".',
          'Open an existing .lcdproj with "Open project", or click "Demo project" to explore.'
        ]
      },
      {
        kind: 'note',
        text: 'Do not open the root index.html with file://. It is a Vite entry point; use the dev server or the packaged application.'
      }
    ]
  },
  {
    id: 'tasks',
    title: '4. Typical tasks',
    summary: 'Each task follows: goal -> principle & roadmap -> step-by-step.',
    blocks: [
      {
        kind: 'task',
        task: 'Create a new screen and place a text label.',
        principle: 'A screen is a sized canvas; text objects reference a bitmap font. You add a screen, select it, then draw with the Text tool.',
        steps: [
          'In the Screens list, click "Add screen" and give it a name.',
          'Select the new screen to open its LCD canvas.',
          'Choose the Text tool, click on the canvas and type the label.',
          'Pick Font 1 or Font 2 and adjust X/Y in the properties panel.',
          'Confirm it fits inside the 128x64 bounds shown by the frame.'
        ]
      },
      {
        kind: 'diagram',
        caption: 'A finished menu screen rendered on the 128x64 LCD.',
        art: DIAGRAM.screen
      },
      {
        kind: 'task',
        task: 'Import a raster image as a bitmap layer.',
        principle: 'Photos are greyscale; the LCD is 1-bit. The Pixel Importer binarizes the image (threshold or Floyd-Steinberg dithering) in a Web Worker, then drops it on the canvas.',
        steps: [
          'Open the "Pixel importer" mode.',
          'Load a PNG, JPG, BMP or SVG file.',
          'Adjust the threshold, or enable Floyd-Steinberg dithering for photos.',
          'Review the live 1-bit preview.',
          'Apply to insert the result as a BitmapObject on the active screen.'
        ]
      },
      {
        kind: 'task',
        task: 'Design an FSM navigation flow (Visio-style canvas, and import from a script).',
        principle: 'Screens become states; user events become transitions. The same FSM model is editable in the graph (Visio-like), in Mermaid text and in a Python DSL. Each tile has connection points on all four sides, and tiles are user-resizable.',
        steps: [
          'Click "Edit FSM" to enter graph editing mode.',
          'Hover over a tile — green connection dots appear on all four sides (top, right, bottom, left).',
          'Drag from any connection dot to another tile (or to another dot) to create a directed transition; set its event label in the right panel.',
          'To resize a tile, click to select it (green border), then drag any of the 8 resize handles at the corners/edges.',
          'Or open "FSM scripts", choose Mermaid or the Python DSL, and click "Import file..." to load a script.',
          'Review the generated text, then click "Apply ... to FSM".',
          'Use "Auto arrange" to rebuild the compact layout, then refine positions manually.',
          'Use "Compact" for an overview and "Source map" to see LCD previews per node.'
        ]
      },
      {
        kind: 'diagram',
        caption: 'A minimal navigation flow expressed as states and transitions.',
        art: DIAGRAM.flow
      },
      {
        kind: 'task',
        task: 'Customize the workspace and arrange FSM tiles.',
        principle: 'The workspace is adaptive. Side panels can be hidden and resized, while FSM tile coordinates are part of the project and therefore participate in autosave and portable project export.',
        steps: [
          'Use the Panels row to show or hide Screens, State list, FSM canvas and LCD editor.',
          'Drag a vertical separator to set a comfortable panel width; the width is restored locally on the next launch.',
          'Drag any FSM tile directly on the canvas. Transition editing does not need to be enabled for positioning.',
          'Wait for the autosave status to update; the new relative X/Y position is stored in the project.',
          'Use "Auto arrange" to rebuild a compact layout, then continue adjusting tiles manually.'
        ]
      },
      {
        kind: 'task',
        task: 'Edit or import a bitmap font glyph.',
        principle: 'Each font variant is a glyph table. You can hand-edit glyph pixels, or import a standard .bdf / app .fnt file and merge it into (or replace) a variant.',
        steps: [
          'Open the Font Loader panel.',
          'Select the target variant (Font 1 or Font 2).',
          'Choose "Merge glyphs" or "Replace font".',
          'Click "Load .bdf/.fnt" and pick the file.',
          'Use the Glyph editor to fine-tune individual glyph pixels.'
        ]
      },
      {
        kind: 'task',
        task: 'Export a firmware C header and binary.',
        principle: 'Firmware needs the packed framebuffer. One screen packs to a 1-bit vertical-page byte array; export it as a C header or raw .bin, for one screen or all screens.',
        steps: [
          'Select the screen to export.',
          'In the export panel use "Download .h" for a C header or "Download .bin" for raw bytes.',
          'Use "All screens .h" / "All screens .bin" to export the whole project.',
          'Round-trip check: "Import C header" reads a static const uint8_t[...] array back as a layer.'
        ]
      },
      {
        kind: 'task',
        task: 'Save and share a portable project.',
        principle: 'The .lcdproj format is a validated, self-contained exchange file. Autosave protects work in progress; .lcdproj is for hand-off and version control.',
        steps: [
          'Click "Save .lcdproj" (or "Export universal") to write the portable file.',
          'Commit the .lcdproj to version control or send it to a colleague.',
          'They open it with "Open project"; the schema is validated on load.',
          'Autosave keeps the latest state locally between sessions.'
        ]
      }
    ]
  },
  {
    id: 'reference',
    title: '5. Data & export reference',
    summary: 'Formats, bit packing and keyboard shortcuts.',
    blocks: [
      {
        kind: 'diagram',
        caption: 'Firmware packing: 1 bpp, vertical pages, LSB at top. A 128x64 screen is 1024 bytes.',
        art: DIAGRAM.packing
      },
      {
        kind: 'table',
        headers: ['Format', 'Use', 'Notes'],
        rows: [
          ['.lcdproj', 'Portable project exchange', 'Zod-validated, <= 10 MB on import.'],
          ['JSON autosave', 'Internal session state', 'lcdVectorEditor.lastState.v4 (+ v3 migration).'],
          ['.h (C header)', 'Firmware integration', 'static const uint8_t name[1024].'],
          ['.bin', 'Firmware integration', 'Raw framebuffer bytes.'],
          ['.bdf / .fnt', 'Font import', 'Merge into or replace a font variant.']
        ]
      },
      {
        kind: 'table',
        headers: ['Shortcut', 'Action'],
        rows: [
          ['Ctrl + E', 'Edit mode'],
          ['Ctrl + P', 'Preview mode'],
          ['Ctrl + Z', 'Undo'],
          ['Ctrl + Y', 'Redo']
        ]
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: '6. Troubleshooting',
    summary: 'Common situations and how to resolve them.',
    blocks: [
      {
        kind: 'table',
        headers: ['Symptom', 'Likely cause', 'Resolution'],
        rows: [
          ['Canvas is blank', 'No screen selected', 'Pick a state/screen from the list.'],
          ['Text leaves the frame', 'Label too long or font too large', 'Shorten text, change font, or move the object.'],
          ['Import rejected', 'File over 10 MB or invalid schema', 'Check the file size and format.'],
          ['Script has no effect', 'Parser found 0 states', 'Fix the syntax, then click "Apply ... to FSM".'],
          ['Blank page via file://', 'Opened index.html directly', 'Use the dev server or the packaged app.']
        ]
      }
    ]
  }
];

/* ----------------------------------------------------------------------------
 * Russian
 * ------------------------------------------------------------------------- */
export const OPERATION_MANUAL_RU: ManualSection[] = [
  {
    id: 'overview',
    title: '1. Обзор',
    summary: 'Что такое LCD-bitmap IDE и с какими понятиями вы работаете.',
    blocks: [
      {
        kind: 'lead',
        text: 'LCD-bitmap IDE — это офлайн-среда для проектирования монохромных LCD-экранов, растровых шрифтов и навигационных схем конечного автомата (FSM), а также для экспорта готовых для прошивки C-массивов и бинарных framebuffer-файлов.'
      },
      {
        kind: 'diagram',
        caption: 'Концептуальная модель: проект содержит экраны, экраны привязаны к состояниям FSM, всё экспортируется в данные для прошивки.',
        art: DIAGRAM.concept
      },
      {
        kind: 'table',
        headers: ['Понятие', 'Значение'],
        rows: [
          ['Проект', 'Вся разработка, сохраняемая в переносимый файл .lcdproj.'],
          ['Экран', 'Один монохромный холст 128x64 (или по профилю) с объектами.'],
          ['Объект', 'Текст, линия, прямоугольник, bitmap, спецэлемент или глиф на экране.'],
          ['Состояние FSM', 'Узел навигационного графа, привязанный к одному экрану.'],
          ['Переход', 'Ребро с меткой события из одного состояния в другое.'],
          ['Framebuffer', 'Упакованные байты по 1 биту на пиксель для прибора.']
        ]
      }
    ]
  },
  {
    id: 'interface',
    title: '2. Карта интерфейса',
    summary: 'Где находится каждый инструмент.',
    blocks: [
      {
        kind: 'diagram',
        caption: 'Главное окно: навигация слева, граф FSM по центру, редактор LCD справа.',
        art: DIAGRAM.layout
      },
      {
        kind: 'table',
        headers: ['Область', 'Назначение'],
        rows: [
          ['Командный центр', 'Название, версия и история проекта, операции, поиск, режимы редактора, дисплей и режим работы.'],
          ['Шторка панели управления', 'Локальные сохранения, метрики и произвольные ширина/высота дисплея.'],
          ['Список экранов', 'Добавление, клонирование, переименование, удаление и порядок; миниатюры.'],
          ['Граф FSM', 'Свободное перетаскивание плиток состояний с автосохранением, автокомпоновка, переходы и полный экран.'],
          ['Редактор LCD', 'Инструменты холста, свойства объекта, экспорт, загрузчик шрифтов, глифы.'],
          ['Управление панелями', 'Сворачивание Экранов, списка состояний, FSM-холста и LCD-редактора; изменение ширины разделителями.'],
          ['Строка статуса', 'Размер дисплея, число состояний и переходов, время автосохранения.']
        ]
      },
      {
        kind: 'table',
        headers: ['Инструмент холста', 'Действие'],
        rows: [
          ['Выбор', 'Выбор и перемещение объектов; рамка по пустой области — множественный выбор.'],
          ['Текст', 'Размещение текстового объекта шрифтом Font 1 или Font 2.'],
          ['Линия / Прямоугольник', 'Рисование прямых и прямоугольных примитивов.'],
          ['Инверсия строки', 'Инверсия горизонтальной полосы пикселей.'],
          ['Спецэлемент', 'Чекбокс, радио, прогресс-бар, батарея, уровень сигнала, скроллбар.'],
          ['Редактор глифов', 'Правка пикселей отдельных глифов варианта шрифта.']
        ]
      }
    ]
  },
  {
    id: 'getting-started',
    title: '3. Быстрый старт',
    summary: 'Запуск приложения и открытие проекта.',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Готовое настольное приложение: запустите LCD-bitmap IDE с установленного ярлыка.',
          'Из исходников (web): выполните «npm run dev» и откройте http://127.0.0.1:5173.',
          'Из исходников (десктоп): выполните «npm run electron:dev».',
          'Откройте существующий .lcdproj кнопкой «Открыть проект» или нажмите «Демо-проект».'
        ]
      },
      {
        kind: 'note',
        text: 'Не открывайте корневой index.html через file://. Это точка входа Vite; используйте dev-сервер или собранное приложение.'
      }
    ]
  },
  {
    id: 'tasks',
    title: '4. Типовые задачи',
    summary: 'Каждая задача построена по схеме: постановка -> принцип и план -> пошаговое решение.',
    blocks: [
      {
        kind: 'task',
        task: 'Создать новый экран и разместить текст.',
        principle: 'Экран — это холст заданного размера; текстовый объект ссылается на растровый шрифт. Сначала добавьте экран, выберите его, затем рисуйте инструментом «Текст».',
        steps: [
          'В списке экранов нажмите «Добавить экран» и задайте имя.',
          'Выберите новый экран, чтобы открыть его LCD-холст.',
          'Возьмите инструмент «Текст», щёлкните по холсту и введите подпись.',
          'Выберите Font 1 или Font 2 и задайте X/Y в панели свойств.',
          'Убедитесь, что объект помещается в границы 128x64.'
        ]
      },
      {
        kind: 'diagram',
        caption: 'Готовый экран меню на дисплее 128x64.',
        art: DIAGRAM.screen
      },
      {
        kind: 'task',
        task: 'Импортировать растровое изображение как bitmap-слой.',
        principle: 'Фотографии — полутоновые, LCD — 1-битный. Импортер пикселей бинаризует изображение (порог или дизеринг Флойда—Стейнберга) в Web Worker и помещает на холст.',
        steps: [
          'Откройте режим «Импорт пикселей».',
          'Загрузите файл PNG, JPG, BMP или SVG.',
          'Настройте порог или включите дизеринг Флойда—Стейнберга для фото.',
          'Проверьте 1-битный предпросмотр.',
          'Примените, чтобы вставить результат как BitmapObject на активный экран.'
        ]
      },
      {
        kind: 'task',
        task: 'Спроектировать навигацию FSM (Visio-подобный холст, импорт из скрипта).',
        principle: 'Экраны становятся состояниями, события пользователя — переходами. Модель FSM правится в графе (по образцу Visio), в тексте Mermaid и в Python-DSL. На каждой плитке есть точки соединения на четырёх сторонах, а плитки доступны для ручного масштабирования.',
        steps: [
          'Нажмите «Редактировать FSM», чтобы войти в режим правки графа.',
          'Наведите курсор на плитку — зелёные точки соединения появятся на всех четырёх сторонах (верх, право, низ, лево).',
          'Перетащите от любой точки соединения к другой плитке или точке, чтобы создать направленный переход; задайте метку события в панели справа.',
          'Для изменения размера плитки кликните по ней (зелёная рамка выделения) и тяните один из 8 маркеров изменения размера.',
          'Или откройте «FSM-скрипты», выберите Mermaid или Python-DSL и нажмите «Импорт файла...».',
          'Проверьте сгенерированный текст и нажмите «Применить ... к FSM».',
          'Нажмите «Автокомпоновку» для сброса в компактную раскладку, затем при необходимости настройте вручную.',
          'Используйте «Компактно» для обзора и «Карту-источник» для предпросмотра LCD по узлам.'
        ]
      },
      {
        kind: 'diagram',
        caption: 'Минимальная навигационная схема: состояния и переходы.',
        art: DIAGRAM.flow
      },
      {
        kind: 'task',
        task: 'Настроить рабочее пространство и расположить плитки FSM.',
        principle: 'Рабочая область адаптивна. Боковые панели можно скрывать и изменять по ширине, а координаты плиток FSM входят в проект, поэтому сохраняются автосохранением и в переносимом файле.',
        steps: [
          'В строке «Панели» включайте или скрывайте Экраны, Список состояний, FSM-холст и LCD-редактор.',
          'Перетащите вертикальный разделитель и задайте удобную ширину; локально она восстановится при следующем запуске.',
          'Перетащите любую плитку состояния непосредственно на FSM-холсте. Для изменения позиции режим правки переходов включать не требуется.',
          'Дождитесь обновления статуса автосохранения: новые относительные координаты X/Y записываются в проект.',
          'Используйте «Автокомпоновку», чтобы заново построить компактную схему, после чего продолжите ручную настройку.'
        ]
      },
      {
        kind: 'task',
        task: 'Отредактировать или импортировать глиф растрового шрифта.',
        principle: 'Каждый вариант шрифта — это таблица глифов. Можно править пиксели вручную или импортировать стандартный .bdf / .fnt и объединить его с вариантом либо заменить его.',
        steps: [
          'Откройте панель загрузчика шрифтов.',
          'Выберите целевой вариант (Font 1 или Font 2).',
          'Выберите «Объединить глифы» или «Заменить шрифт».',
          'Нажмите «Загрузить .bdf/.fnt» и выберите файл.',
          'Доработайте пиксели отдельных глифов в редакторе глифов.'
        ]
      },
      {
        kind: 'task',
        task: 'Экспортировать C-заголовок и бинарник для прошивки.',
        principle: 'Прошивке нужен упакованный framebuffer. Один экран упаковывается в массив байтов 1 бит/пиксель по вертикальным страницам; экспортируйте его как C-заголовок или .bin — для одного экрана или для всех.',
        steps: [
          'Выберите экран для экспорта.',
          'В панели экспорта нажмите «Скачать .h» (C-заголовок) или «Скачать .bin» (сырые байты).',
          'Используйте «Все экраны .h» / «Все экраны .bin» для экспорта всего проекта.',
          'Проверка обратимости: «Импорт C header» читает массив static const uint8_t[...] обратно как слой.'
        ]
      },
      {
        kind: 'task',
        task: 'Сохранить и передать переносимый проект.',
        principle: 'Формат .lcdproj — самодостаточный проверяемый файл обмена. Автосохранение защищает текущую работу; .lcdproj — для передачи и контроля версий.',
        steps: [
          'Нажмите «Сохранить .lcdproj» (или «Экспорт универсальный»), чтобы записать переносимый файл.',
          'Зафиксируйте .lcdproj в системе контроля версий или отправьте коллеге.',
          'Он откроет его кнопкой «Открыть проект»; схема проверяется при загрузке.',
          'Автосохранение хранит последнее состояние локально между сессиями.'
        ]
      }
    ]
  },
  {
    id: 'reference',
    title: '5. Справочник данных и экспорта',
    summary: 'Форматы, упаковка битов и горячие клавиши.',
    blocks: [
      {
        kind: 'diagram',
        caption: 'Упаковка для прошивки: 1 бит/пиксель, вертикальные страницы, LSB сверху. Экран 128x64 — это 1024 байта.',
        art: DIAGRAM.packing
      },
      {
        kind: 'table',
        headers: ['Формат', 'Назначение', 'Примечания'],
        rows: [
          ['.lcdproj', 'Переносимый обмен проектом', 'Проверка Zod, не более 10 МБ при импорте.'],
          ['JSON-автосейв', 'Внутреннее состояние сессии', 'lcdVectorEditor.lastState.v4 (+ миграция v3).'],
          ['.h (C-заголовок)', 'Интеграция в прошивку', 'static const uint8_t name[1024].'],
          ['.bin', 'Интеграция в прошивку', 'Сырые байты framebuffer.'],
          ['.bdf / .fnt', 'Импорт шрифта', 'Объединение с вариантом или замена.']
        ]
      },
      {
        kind: 'table',
        headers: ['Клавиши', 'Действие'],
        rows: [
          ['Ctrl + E', 'Режим редактирования'],
          ['Ctrl + P', 'Режим просмотра'],
          ['Ctrl + Z', 'Отмена'],
          ['Ctrl + Y', 'Повтор']
        ]
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: '6. Устранение неполадок',
    summary: 'Типичные ситуации и их решение.',
    blocks: [
      {
        kind: 'table',
        headers: ['Симптом', 'Вероятная причина', 'Решение'],
        rows: [
          ['Холст пустой', 'Не выбран экран', 'Выберите состояние/экран в списке.'],
          ['Текст выходит за рамку', 'Слишком длинная подпись или крупный шрифт', 'Сократите текст, смените шрифт или сдвиньте объект.'],
          ['Импорт отклонён', 'Файл больше 10 МБ или неверная схема', 'Проверьте размер и формат файла.'],
          ['Скрипт не применяется', 'Парсер нашёл 0 состояний', 'Исправьте синтаксис и нажмите «Применить ... к FSM».'],
          ['Пустая страница через file://', 'Открыт index.html напрямую', 'Используйте dev-сервер или собранное приложение.']
        ]
      }
    ]
  }
];

/* ----------------------------------------------------------------------------
 * Simplified Chinese
 * ------------------------------------------------------------------------- */
export const OPERATION_MANUAL_ZH: ManualSection[] = [
  {
    id: 'overview',
    title: '1. 概述',
    summary: 'LCD-bitmap IDE 是什么，以及你将使用的概念。',
    blocks: [
      {
        kind: 'lead',
        text: 'LCD-bitmap IDE 是一个离线工作台，用于设计单色 LCD 屏幕、位图字体和有限状态机（FSM）导航流程，并导出可直接用于固件的 C 数组或二进制帧缓冲。'
      },
      {
        kind: 'diagram',
        caption: '概念模型：项目包含屏幕，屏幕绑定到 FSM 状态，全部导出为固件数据。',
        art: DIAGRAM.concept
      },
      {
        kind: 'table',
        headers: ['概念', '含义'],
        rows: [
          ['项目', '整个设计，保存为可移植的 .lcdproj 文件。'],
          ['屏幕', '一块 128x64（或按配置尺寸）的单色画布及其对象。'],
          ['对象', '屏幕上的文本、直线、矩形、位图、特殊元素或字形。'],
          ['FSM 状态', '导航图中的节点，绑定到一个屏幕。'],
          ['转换', '从一个状态到另一个状态、带事件标签的边。'],
          ['帧缓冲', '发送到设备的每像素 1 位打包字节。']
        ]
      }
    ]
  },
  {
    id: 'interface',
    title: '2. 界面布局',
    summary: '各工具所在的位置。',
    blocks: [
      {
        kind: 'diagram',
        caption: '主窗口：左侧导航，中间 FSM 图，右侧 LCD 编辑器。',
        art: DIAGRAM.layout
      },
      {
        kind: 'table',
        headers: ['区域', '用途'],
        rows: [
          ['命令中心', '项目名称、版本与历史、项目操作、搜索、编辑器模式、显示与工作模式。'],
          ['控制面板抽屉', '本地保存、指标以及自定义显示宽度/高度。'],
          ['屏幕列表', '添加、克隆、重命名、删除与排序；预览缩略图。'],
          ['FSM 图', '随时拖动状态卡片并自动保存位置；自动排列、转换编辑与全屏。'],
          ['LCD 编辑器', '画布工具、元素属性、导出、字体加载器、字形编辑。'],
          ['面板控制', '折叠屏幕、状态列表、FSM 画布或 LCD 编辑器；拖动分隔条调整宽度。'],
          ['状态栏', '显示尺寸、状态与转换数量、自动保存时间。']
        ]
      },
      {
        kind: 'table',
        headers: ['画布工具', '操作'],
        rows: [
          ['选择', '选取并移动对象；在空白处拖动可框选多个。'],
          ['文本', '用 Font 1 或 Font 2 放置文本对象。'],
          ['直线 / 矩形', '绘制直线或矩形图元。'],
          ['行反色', '反转一条水平像素带。'],
          ['特殊元素', '复选框、单选、进度条、电池、信号格、滚动条。'],
          ['字形编辑器', '编辑字体变体中单个字形的像素。']
        ]
      }
    ]
  },
  {
    id: 'getting-started',
    title: '3. 快速开始',
    summary: '启动应用并打开项目。',
    blocks: [
      {
        kind: 'steps',
        items: [
          '已打包桌面应用：从安装的快捷方式启动 LCD-bitmap IDE。',
          '从源码（web）：运行 “npm run dev”，打开 http://127.0.0.1:5173。',
          '从源码（桌面）：运行 “npm run electron:dev”。',
          '用 “打开项目” 打开现有 .lcdproj，或点击 “演示项目” 体验。'
        ]
      },
      {
        kind: 'note',
        text: '不要用 file:// 直接打开根目录 index.html。它是 Vite 入口；请使用开发服务器或已打包的应用。'
      }
    ]
  },
  {
    id: 'tasks',
    title: '4. 典型任务',
    summary: '每个任务遵循：目标 -> 原理与路线 -> 分步实施。',
    blocks: [
      {
        kind: 'task',
        task: '新建屏幕并放置文本标签。',
        principle: '屏幕是一块定尺画布；文本对象引用位图字体。先添加屏幕，选中它，再用文本工具绘制。',
        steps: [
          '在屏幕列表点击 “添加屏幕” 并命名。',
          '选中新屏幕以打开其 LCD 画布。',
          '选择文本工具，点击画布并输入标签。',
          '选择 Font 1 或 Font 2，并在属性面板调整 X/Y。',
          '确认其位于 128x64 边框之内。'
        ]
      },
      {
        kind: 'diagram',
        caption: '在 128x64 LCD 上渲染的完整菜单屏幕。',
        art: DIAGRAM.screen
      },
      {
        kind: 'task',
        task: '将栅格图像导入为位图层。',
        principle: '照片是灰度的，LCD 是 1 位的。像素导入器在 Web Worker 中对图像二值化（阈值或 Floyd–Steinberg 抖动），再放到画布上。',
        steps: [
          '打开 “像素导入” 模式。',
          '加载 PNG、JPG、BMP 或 SVG 文件。',
          '调整阈值，或为照片启用 Floyd–Steinberg 抖动。',
          '查看实时 1 位预览。',
          '应用，将结果作为 BitmapObject 插入到当前屏幕。'
        ]
      },
      {
        kind: 'task',
        task: '设计 FSM 导航流程（Visio 风格画布，并从脚本导入）。',
        principle: '屏幕成为状态，用户事件成为转换。FSM 模型可在图形（类 Visio）、Mermaid 文本和 Python DSL 中编辑。每个节点卡片四个方向均有连接锚点，卡片大小可由用户调整。',
        steps: [
          '点击 “编辑 FSM” 进入图形编辑模式。',
          '将鼠标悬停在卡片上 — 四个方向（上、右、下、左）会出现绿色连接锚点。',
          '从任意锚点拖拽到另一个卡片或锚点，创建有向转换；在右侧面板设置事件标签。',
          '如需调整卡片大小，点击选中卡片（绿色边框），然后拖拽 8 个缩放控制柄中的任意一个。',
          '或打开 “FSM 脚本”，选择 Mermaid 或 Python DSL，点击 “导入文件...”。',
          '检查生成的文本，然后点击 “应用 ... 到 FSM”。',
          '使用 “自动排列” 重建紧凑布局，之后可继续手动微调。',
          '用 “紧凑” 总览，用 “源图” 查看每个节点的 LCD 预览。'
        ]
      },
      {
        kind: 'diagram',
        caption: '以状态与转换表示的最小导航流程。',
        art: DIAGRAM.flow
      },
      {
        kind: 'task',
        task: '自定义工作区并排列 FSM 卡片。',
        principle: '工作区可自适应。侧面板可以隐藏和调整宽度，FSM 卡片坐标属于项目数据，因此会进入自动保存和可移植项目导出。',
        steps: [
          '使用“面板”行显示或隐藏屏幕、状态列表、FSM 画布和 LCD 编辑器。',
          '拖动垂直分隔条设置合适宽度；下次启动时会在本地恢复。',
          '直接在 FSM 画布上拖动任意状态卡片；仅调整位置时无需启用转换编辑。',
          '等待自动保存状态更新；新的相对 X/Y 坐标会写入项目。',
          '需要重新生成紧凑布局时使用“自动排列”，之后仍可继续手动调整。'
        ]
      },
      {
        kind: 'task',
        task: '编辑或导入位图字体字形。',
        principle: '每个字体变体是一张字形表。可手动编辑字形像素，或导入标准 .bdf / .fnt 文件并合并到变体或替换它。',
        steps: [
          '打开字体加载器面板。',
          '选择目标变体（Font 1 或 Font 2）。',
          '选择 “合并字形” 或 “替换字体”。',
          '点击 “加载 .bdf/.fnt” 并选择文件。',
          '在字形编辑器中微调单个字形像素。'
        ]
      },
      {
        kind: 'task',
        task: '导出固件 C 头文件与二进制。',
        principle: '固件需要打包后的帧缓冲。一个屏幕按垂直页打包为 1 位字节数组；可将单个或全部屏幕导出为 C 头文件或原始 .bin。',
        steps: [
          '选择要导出的屏幕。',
          '在导出面板点击 “下载 .h”（C 头文件）或 “下载 .bin”（原始字节）。',
          '用 “全部屏幕 .h” / “全部屏幕 .bin” 导出整个项目。',
          '往返校验：“导入 C 头文件” 可将 static const uint8_t[...] 数组读回为图层。'
        ]
      },
      {
        kind: 'task',
        task: '保存并共享可移植项目。',
        principle: '.lcdproj 是自包含、可校验的交换文件。自动保存保护进行中的工作；.lcdproj 用于交付与版本控制。',
        steps: [
          '点击 “保存 .lcdproj”（或 “通用导出”）写出可移植文件。',
          '将 .lcdproj 提交到版本控制或发送给同事。',
          '对方用 “打开项目” 打开；加载时会校验模式。',
          '自动保存在会话之间本地保留最新状态。'
        ]
      }
    ]
  },
  {
    id: 'reference',
    title: '5. 数据与导出参考',
    summary: '格式、位打包与快捷键。',
    blocks: [
      {
        kind: 'diagram',
        caption: '固件打包：1 位/像素，垂直页，LSB 在顶部。128x64 屏幕为 1024 字节。',
        art: DIAGRAM.packing
      },
      {
        kind: 'table',
        headers: ['格式', '用途', '说明'],
        rows: [
          ['.lcdproj', '可移植项目交换', 'Zod 校验，导入不超过 10 MB。'],
          ['JSON 自动保存', '内部会话状态', 'lcdVectorEditor.lastState.v4（含 v3 迁移）。'],
          ['.h（C 头文件）', '固件集成', 'static const uint8_t name[1024]。'],
          ['.bin', '固件集成', '原始帧缓冲字节。'],
          ['.bdf / .fnt', '字体导入', '合并到变体或替换。']
        ]
      },
      {
        kind: 'table',
        headers: ['快捷键', '操作'],
        rows: [
          ['Ctrl + E', '编辑模式'],
          ['Ctrl + P', '预览模式'],
          ['Ctrl + Z', '撤销'],
          ['Ctrl + Y', '重做']
        ]
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: '6. 故障排除',
    summary: '常见情况及解决办法。',
    blocks: [
      {
        kind: 'table',
        headers: ['现象', '可能原因', '解决'],
        rows: [
          ['画布空白', '未选择屏幕', '从列表选择一个状态/屏幕。'],
          ['文本超出边框', '标签太长或字体过大', '缩短文本、更换字体或移动对象。'],
          ['导入被拒绝', '文件超过 10 MB 或模式无效', '检查文件大小与格式。'],
          ['脚本无效果', '解析得到 0 个状态', '修正语法，再点击 “应用 ... 到 FSM”。'],
          ['file:// 打开空白页', '直接打开了 index.html', '使用开发服务器或已打包应用。']
        ]
      }
    ]
  }
];

const CURRENT_FUNCTIONALITY_EN: ManualSection = {
  id: 'current-methodology',
  title: '7. Current workflow methodology',
  summary: 'How to use each tab and how to document work with checkpoints and CAPA.',
  blocks: [
    {
      kind: 'table',
      headers: ['Workspace', 'Philosophy', 'Main controls'],
      rows: [
        ['FSM editor', 'The navigation contract: states, one-way/two-way routes, event triggers, conditions and backend process links.', 'States, route editor, transition properties, condition snippets, scripts, auto arrange.'],
        ['LCD editor', 'The pixel truth: every screen is a firmware-ready 1 bpp framebuffer with text, glyphs, bitmaps and special elements.', 'Canvas tools, image import, bitmap glyph editor, special glyphs, templates, export/import.'],
        ['Control panel', 'The physical interaction model: buttons and display surfaces are bound to FSM events and screens.', 'Panel elements, geometry, event binding, layout tools.'],
        ['Preview', 'The runtime rehearsal: validate transitions before firmware export.', 'Runtime buttons, step mode, LCD preview, event log.']
      ]
    },
    {
      kind: 'task',
      task: 'Document a screen or FSM change with engineering checkpoints.',
      principle: 'Each change should be traceable: task, entity, purpose, step-by-step implementation, checkpoints, CAPA and captured screen state.',
      steps: [
        'Task: write the concrete user-visible change, for example “add a two-way route from MENU to SETTINGS”.',
        'Entity: record the affected screen, FSM state, transition, glyph or bitmap layer id.',
        'Purpose: describe why the change is needed and which user action it supports.',
        'Step-by-step: perform the change in the relevant workspace and validate after each major step.',
        'Checkpoint: capture the state after route creation, LCD rendering, preview run and export validation.',
        'CAPA: if validation fails, record the cause, corrective action and preventive action.',
        'Screenshot state: export or capture the relevant app state before/after the change.'
      ]
    }
  ]
};

const CURRENT_FUNCTIONALITY_RU: ManualSection = {
  id: 'current-methodology',
  title: '7. Методика работы с текущим функционалом',
  summary: 'Философия вкладок и оформление действий через контрольные точки и CAPA.',
  blocks: [
    {
      kind: 'table',
      headers: ['Вкладка', 'Философия', 'Основные элементы управления'],
      rows: [
        ['FSM-редактор', 'Навигационный контракт: состояния, односторонние/двусторонние маршруты, события, условия и связи с backend-процессами.', 'States, редактор маршрутов, свойства перехода, шаблоны условий, scripts, автокомпоновка.'],
        ['LCD-редактор', 'Пиксельная истина: каждый экран является firmware-ready framebuffer 1 bpp с текстом, глифами, bitmap и спецэлементами.', 'Инструменты холста, импорт изображения, редактор bitmap-глифа, спецглифы, шаблоны, экспорт/импорт.'],
        ['Панель управления', 'Модель физического взаимодействия: кнопки и дисплейные поверхности связываются с FSM-событиями и экранами.', 'Элементы панели, геометрия, привязка событий, инструменты компоновки.'],
        ['Просмотр', 'Runtime-репетиция: проверка переходов до экспорта в прошивку.', 'Runtime-кнопки, пошаговый режим, LCD-preview, журнал событий.']
      ]
    },
    {
      kind: 'task',
      task: 'Описать изменение экрана или FSM через инженерные контрольные точки.',
      principle: 'Каждое изменение должно быть прослеживаемым: задача, сущность, назначение, пошаговая реализация, контрольные точки, CAPA и снимок состояния экрана.',
      steps: [
        'Задача: сформулируйте видимое пользователю изменение, например «добавить двусторонний маршрут MENU <-> SETTINGS».',
        'Сущность: зафиксируйте id затронутого экрана, FSM-состояния, перехода, глифа или bitmap-слоя.',
        'Назначение: опишите, зачем нужно изменение и какое действие пользователя оно поддерживает.',
        'Пошаговая реализация: выполните изменение в нужной вкладке и проверяйте результат после каждого крупного шага.',
        'Контрольная точка: зафиксируйте состояние после создания маршрута, LCD-рендера, runtime-просмотра и экспортной проверки.',
        'CAPA: если проверка не прошла, запишите причину, корректирующее действие и предупреждающее действие.',
        'Скриншот состояния: экспортируйте или снимите состояние приложения до/после изменения.'
      ]
    }
  ]
};

const CURRENT_FUNCTIONALITY_ZH: ManualSection = {
  id: 'current-methodology',
  title: '7. 当前功能工作方法',
  summary: '各工作区理念，以及用检查点和 CAPA 记录操作。',
  blocks: [
    {
      kind: 'table',
      headers: ['工作区', '理念', '主要控件'],
      rows: [
        ['FSM 编辑器', '导航契约：状态、单向/双向路线、事件触发、条件和后端进程链接。', '状态、路线编辑器、转换属性、条件模板、脚本、自动排列。'],
        ['LCD 编辑器', '像素事实源：每个屏幕都是可导出到固件的 1 bpp 帧缓冲，包含文本、字形、位图和特殊元素。', '画布工具、图像导入、位图字形编辑器、特殊字形、模板、导入/导出。'],
        ['控制面板', '物理交互模型：按钮和显示区域绑定到 FSM 事件与屏幕。', '面板元素、几何、事件绑定、布局工具。'],
        ['预览', '运行时演练：在固件导出前验证转换。', '运行时按钮、单步模式、LCD 预览、事件日志。']
      ]
    },
    {
      kind: 'task',
      task: '用工程检查点记录屏幕或 FSM 变更。',
      principle: '每项变更都应可追溯：任务、实体、目的、分步实施、检查点、CAPA 和屏幕状态截图。',
      steps: [
        '任务：写明用户可见的变更，例如“添加 MENU 与 SETTINGS 的双向路线”。',
        '实体：记录受影响的屏幕、FSM 状态、转换、字形或位图层 id。',
        '目的：说明为何需要该变更以及支持哪个用户动作。',
        '分步实施：在对应工作区完成变更，并在每个主要步骤后验证。',
        '检查点：记录路线创建、LCD 渲染、运行时预览和导出校验后的状态。',
        'CAPA：若验证失败，记录原因、纠正措施和预防措施。',
        '截图状态：导出或捕获变更前/后的应用状态。'
      ]
    }
  ]
};

// ─── HMI Tags ─────────────────────────────────────────────────────────────────

const HMI_TAGS_EN: ManualSection = {
  id: 'hmi-tags',
  title: '8. HMI Tags',
  summary: 'How to define, type and bind data-source tags that drive live LCD screen values.',
  blocks: [
    {
      kind: 'lead',
      text: 'Tags are the data backbone of the HMI: every numeric, boolean, text or enum value shown on the LCD must be declared as a tag before it can be bound to a screen element.'
    },
    {
      kind: 'diagram',
      caption: 'Tag → Binding → Screen element',
      art: `
  ┌──────────┐   bind   ┌─────────────────┐   render   ┌─────────────┐
  │  HMI Tag │ ────────▶│ Screen element  │ ──────────▶│  LCD pixel  │
  │  id/type │          │ (text, bitmap…) │            │  framebuf   │
  └──────────┘          └─────────────────┘            └─────────────┘
       │
       │  data source
       ▼
  Modbus / OPC-UA / internal register`
    },
    {
      kind: 'table',
      headers: ['Tag type', 'Use case', 'Example value'],
      rows: [
        ['number', 'Numeric measurement (temperature, flow, pressure)', '23.5'],
        ['boolean', 'On/Off flag, alarm state', 'true / false'],
        ['string', 'Label, unit, status message', '"READY"'],
        ['enum', 'Discrete state (mode selector)', '"AUTO" | "MANUAL" | "OFF"']
      ]
    },
    {
      kind: 'task',
      task: 'Create a new HMI tag for a temperature sensor reading.',
      principle: 'Define the tag identity (id, name, type, unit) once; bind it everywhere it is displayed — this keeps the data source as a single point of truth.',
      steps: [
        'Open the Tags workspace (Ctrl+click the Tags nav button).',
        'Click the + button in the Tags sidebar.',
        'Enter a unique id (e.g. "temp_ambient"), human-readable name and select type "number".',
        'Set unit (e.g. "°C"), min/max range for validation, and description.',
        'Choose a data source: Modbus register, OPC-UA node-id, or internal (for simulation).',
        'Save the tag. It appears in the entity list and is now available for binding on any LCD screen.'
      ]
    },
    {
      kind: 'task',
      task: 'Bind an existing tag to an LCD text element.',
      principle: 'Binding is set in the LCD workspace Inspector — the tag id is referenced, not duplicated.',
      steps: [
        'Open the LCD workspace and select the target screen.',
        'Select a Text element on the canvas.',
        'In the Inspector on the right, find the "HMI binding" section.',
        'Type or pick the tag id from the dropdown.',
        'Set the display format (e.g. "{value} °C") and alignment.',
        'Switch to Preview to verify the live-update placeholder renders correctly.'
      ]
    }
  ]
};

const HMI_TAGS_RU: ManualSection = {
  id: 'hmi-tags',
  title: '8. HMI-теги',
  summary: 'Как определять, типизировать и привязывать теги источников данных для значений LCD-экрана.',
  blocks: [
    {
      kind: 'lead',
      text: 'Теги — информационный каркас HMI: каждое числовое, булево, текстовое или перечислимое значение на LCD-экране должно быть объявлено как тег, прежде чем его можно привязать к элементу экрана.'
    },
    {
      kind: 'diagram',
      caption: 'Тег → Привязка → Элемент экрана',
      art: `
  ┌──────────┐  привязка ┌─────────────────┐  рендер  ┌─────────────┐
  │  HMI-тег │ ─────────▶│ Элемент экрана  │ ────────▶│  LCD пиксел │
  │  id/type │           │ (текст, bitmap…) │          │  framebuf   │
  └──────────┘           └─────────────────┘          └─────────────┘
       │
       │  источник данных
       ▼
  Modbus / OPC-UA / internal регистр`
    },
    {
      kind: 'table',
      headers: ['Тип тега', 'Применение', 'Пример значения'],
      rows: [
        ['number', 'Числовое измерение (температура, поток, давление)', '23.5'],
        ['boolean', 'Флаг вкл/выкл, состояние аварии', 'true / false'],
        ['string', 'Метка, единица, статусное сообщение', '"ГОТОВО"'],
        ['enum', 'Дискретное состояние (селектор режима)', '"АВТО" | "РУЧНОЙ" | "ОТКЛ"']
      ]
    },
    {
      kind: 'task',
      task: 'Создать новый HMI-тег для показания датчика температуры.',
      principle: 'Определите тег один раз (id, имя, тип, единица); привяжите везде, где отображается — это делает источник данных единственной точкой истины.',
      steps: [
        'Откройте рабочее пространство «Теги».',
        'Нажмите кнопку + в боковой панели тегов.',
        'Введите уникальный id (например, "temp_ambient"), удобочитаемое имя, выберите тип "number".',
        'Укажите единицу (например, "°C"), диапазон min/max для валидации, описание.',
        'Выберите источник данных: регистр Modbus, узел OPC-UA или internal (для симуляции).',
        'Сохраните тег. Он появится в списке и станет доступен для привязки на любом LCD-экране.'
      ]
    },
    {
      kind: 'task',
      task: 'Привязать существующий тег к текстовому элементу LCD.',
      principle: 'Привязка задаётся в инспекторе рабочего пространства LCD — ссылается id тега, а не дублируется значение.',
      steps: [
        'Откройте рабочее пространство LCD и выберите нужный экран.',
        'Выберите текстовый элемент на холсте.',
        'В инспекторе справа найдите раздел «HMI привязка».',
        'Введите или выберите id тега из выпадающего списка.',
        'Задайте формат отображения (например, "{value} °C") и выравнивание.',
        'Перейдите в Preview — убедитесь, что плейсхолдер обновления отображается корректно.'
      ]
    }
  ]
};

const HMI_TAGS_ZH: ManualSection = {
  id: 'hmi-tags',
  title: '8. HMI 标签',
  summary: '如何定义、类型化并绑定驱动 LCD 屏幕实时值的数据源标签。',
  blocks: [
    {
      kind: 'lead',
      text: '标签是 HMI 的数据骨干：LCD 上显示的每个数值、布尔值、文本或枚举值都必须先声明为标签，才能绑定到屏幕元素。'
    },
    {
      kind: 'diagram',
      caption: '标签 → 绑定 → 屏幕元素',
      art: `
  ┌──────────┐   绑定   ┌─────────────────┐   渲染   ┌─────────────┐
  │  HMI标签 │ ────────▶│   屏幕元素       │ ────────▶│  LCD像素    │
  │  id/type │          │ (文本, bitmap…)  │          │  framebuf   │
  └──────────┘          └─────────────────┘          └─────────────┘
       │
       │  数据源
       ▼
  Modbus / OPC-UA / 内部寄存器`
    },
    {
      kind: 'table',
      headers: ['标签类型', '使用场景', '示例值'],
      rows: [
        ['number', '数值测量（温度、流量、压力）', '23.5'],
        ['boolean', '开/关标志、报警状态', 'true / false'],
        ['string', '标签、单位、状态消息', '"就绪"'],
        ['enum', '离散状态（模式选择器）', '"自动" | "手动" | "关闭"']
      ]
    },
    {
      kind: 'task',
      task: '为温度传感器读数创建新的 HMI 标签。',
      principle: '一次定义标签（id、名称、类型、单位）；在所有显示处绑定——这使数据源成为单一事实来源。',
      steps: [
        '打开"标签"工作区。',
        '在标签侧栏点击 + 按钮。',
        '输入唯一 id（例如 "temp_ambient"）、可读名称，并选择类型 "number"。',
        '设置单位（例如 "°C"）、验证用的 min/max 范围和描述。',
        '选择数据源：Modbus 寄存器、OPC-UA 节点 id 或 internal（用于仿真）。',
        '保存标签。它将出现在实体列表中，可在任意 LCD 屏幕上进行绑定。'
      ]
    },
    {
      kind: 'task',
      task: '将现有标签绑定到 LCD 文本元素。',
      principle: '绑定在 LCD 工作区检查器中设置——引用标签 id，不复制值。',
      steps: [
        '打开 LCD 工作区并选择目标屏幕。',
        '在画布上选择文本元素。',
        '在右侧检查器中找到"HMI 绑定"部分。',
        '输入或从下拉列表中选择标签 id。',
        '设置显示格式（例如 "{value} °C"）和对齐方式。',
        '切换到预览——确认实时更新占位符正确渲染。'
      ]
    }
  ]
};

// ─── HMI Procedures ───────────────────────────────────────────────────────────

const HMI_PROCEDURES_EN: ManualSection = {
  id: 'hmi-procedures',
  title: '9. HMI Procedures',
  summary: 'Designing measurement and operational procedures from reusable CLI command steps.',
  blocks: [
    {
      kind: 'lead',
      text: 'A procedure is an ordered sequence of CLI commands (instrument operations) that transforms a raw operator intent — "measure photometry channel 2" — into a reproducible, validated workflow with guard conditions and result handling.'
    },
    {
      kind: 'diagram',
      caption: 'Procedure lifecycle',
      art: `
  Operator intent
        │
        ▼
  ┌─────────────┐    guard    ┌──────────┐   CLI steps   ┌──────────────┐
  │  Procedure  │ ──────────▶│  Guard   │ ─────────────▶│  Instrument  │
  │  definition │            │  check   │               │  command seq │
  └─────────────┘            └──────────┘               └──────────────┘
                                  │ fail                       │ ok
                                  ▼                            ▼
                            abort + toast              result → tag binding`
    },
    {
      kind: 'table',
      headers: ['Step type', 'Purpose', 'Example'],
      rows: [
        ['cli', 'Send a command to the instrument', 'SET_CHANNEL 2'],
        ['delay', 'Wait for instrument stabilisation', '500 ms'],
        ['read', 'Read a measurement register into a tag', 'READ_ADC → tag:ch2_value'],
        ['guard', 'Abort the procedure if a condition fails', 'tag:device_ready == true']
      ]
    },
    {
      kind: 'task',
      task: 'Create a photometry measurement procedure.',
      principle: 'Decompose the measurement goal into the smallest independent CLI steps, add guard conditions at the beginning to prevent wrong-state execution, and bind the result to a tag for display.',
      steps: [
        'Open the Procedures workspace.',
        'Click + to create a new procedure. Give it an id and a human-readable name.',
        'Select the target instrument profile, or keep the universal LCD profile for a generic embedded device.',
        'Add a guard step: condition "tag:device_ready == true", action "abort".',
        'Add CLI steps from the command catalog: SET_CHANNEL, INTEGRATE, READ_ADC.',
        'For the READ_ADC step, set the result binding: output tag "ch2_value".',
        'Add a delay step (500 ms) between INTEGRATE and READ_ADC to allow settling.',
        'Save. Test via the Run button — the procedure log appears in the bottom panel.',
        'On success, bind the "ch2_value" tag to the LCD screen result element.'
      ]
    }
  ]
};

const HMI_PROCEDURES_RU: ManualSection = {
  id: 'hmi-procedures',
  title: '9. HMI-процедуры',
  summary: 'Проектирование процедур измерения и работы из переиспользуемых шагов CLI-команд.',
  blocks: [
    {
      kind: 'lead',
      text: 'Процедура — упорядоченная последовательность CLI-команд (операций с прибором), которая превращает намерение оператора — «измерить фотометрию канала 2» — в воспроизводимый, валидированный рабочий процесс с охранными условиями и обработкой результата.'
    },
    {
      kind: 'diagram',
      caption: 'Жизненный цикл процедуры',
      art: `
  Намерение оператора
        │
        ▼
  ┌─────────────┐   охрана   ┌──────────┐  CLI-шаги  ┌──────────────┐
  │  Процедура  │ ──────────▶│  Охранник│ ──────────▶│   Команды    │
  │  definition │            │  check   │            │   прибора    │
  └─────────────┘            └──────────┘            └──────────────┘
                                  │ fail                    │ ok
                                  ▼                         ▼
                           abort + toast        результат → привязка тега`
    },
    {
      kind: 'table',
      headers: ['Тип шага', 'Назначение', 'Пример'],
      rows: [
        ['cli', 'Отправить команду прибору', 'SET_CHANNEL 2'],
        ['delay', 'Ожидание стабилизации прибора', '500 мс'],
        ['read', 'Считать регистр измерения в тег', 'READ_ADC → tag:ch2_value'],
        ['guard', 'Прервать процедуру при несоблюдении условия', 'tag:device_ready == true']
      ]
    },
    {
      kind: 'task',
      task: 'Создать процедуру фотометрического измерения.',
      principle: 'Декомпозируйте цель измерения на наименьшие независимые CLI-шаги, добавьте охранные условия в начало для предотвращения выполнения в неправильном состоянии и привяжите результат к тегу для отображения.',
      steps: [
        'Откройте рабочее пространство «Процедуры».',
        'Нажмите +, создайте новую процедуру, задайте id и удобочитаемое имя.',
        'Выберите профиль целевого прибора или оставьте универсальный LCD-профиль для типового embedded-устройства.',
        'Добавьте шаг-охранник: условие "tag:device_ready == true", действие "abort".',
        'Добавьте CLI-шаги из каталога команд: SET_CHANNEL, INTEGRATE, READ_ADC.',
        'Для шага READ_ADC задайте привязку результата: выходной тег "ch2_value".',
        'Добавьте шаг delay (500 мс) между INTEGRATE и READ_ADC для стабилизации.',
        'Сохраните. Протестируйте кнопкой Run — лог выполнения появится на нижней панели.',
        'При успехе привяжите тег "ch2_value" к элементу результата на LCD-экране.'
      ]
    }
  ]
};

const HMI_PROCEDURES_ZH: ManualSection = {
  id: 'hmi-procedures',
  title: '9. HMI 流程',
  summary: '使用可复用 CLI 命令步骤设计测量和操作流程。',
  blocks: [
    {
      kind: 'lead',
      text: '流程是一组有序的 CLI 命令（仪器操作），将操作员意图——"测量光度计通道 2"——转化为可重复、经验证的工作流，包含守护条件和结果处理。'
    },
    {
      kind: 'diagram',
      caption: '流程生命周期',
      art: `
  操作员意图
        │
        ▼
  ┌─────────────┐   守护   ┌──────────┐  CLI步骤  ┌──────────────┐
  │    流程     │ ────────▶│  守护检查 │ ─────────▶│   仪器命令   │
  │   定义      │          │          │           │    序列      │
  └─────────────┘          └──────────┘           └──────────────┘
                                │ 失败                   │ 成功
                                ▼                        ▼
                          中止 + 提示         结果 → 标签绑定`
    },
    {
      kind: 'table',
      headers: ['步骤类型', '用途', '示例'],
      rows: [
        ['cli', '向仪器发送命令', 'SET_CHANNEL 2'],
        ['delay', '等待仪器稳定', '500 毫秒'],
        ['read', '将测量寄存器读入标签', 'READ_ADC → tag:ch2_value'],
        ['guard', '条件不满足时中止流程', 'tag:device_ready == true']
      ]
    },
    {
      kind: 'task',
      task: '创建光度测量流程。',
      principle: '将测量目标分解为最小的独立 CLI 步骤，在开始处添加守护条件以防止在错误状态下执行，并将结果绑定到标签以供显示。',
      steps: [
        '打开"流程"工作区。',
        '点击 + 创建新流程，设置 id 和可读名称。',
        '选择目标仪器配置文件，或为通用嵌入式设备保留 universal LCD 配置文件。',
        '添加守护步骤：条件 "tag:device_ready == true"，操作 "abort"。',
        '从命令目录添加 CLI 步骤：SET_CHANNEL、INTEGRATE、READ_ADC。',
        '对 READ_ADC 步骤设置结果绑定：输出标签 "ch2_value"。',
        '在 INTEGRATE 和 READ_ADC 之间添加 delay 步骤（500 ms）以等待稳定。',
        '保存。通过 Run 按钮测试——执行日志出现在底部面板。',
        '成功后，将 "ch2_value" 标签绑定到 LCD 屏幕的结果元素。'
      ]
    }
  ]
};

// ─── Master Wizard ─────────────────────────────────────────────────────────────

const MASTER_WIZARD_EN: ManualSection = {
  id: 'master-wizard',
  title: '10. Master Wizard',
  summary: 'Task-result oriented onboarding: guided flows for project setup, new procedures and tag binding.',
  blocks: [
    {
      kind: 'lead',
      text: 'The Master Wizard guides you through the four most common project tasks in a step-by-step modal: Quick Start, New Procedure, Tag Binding and Import from FSM catalog. Launch it from the header toolbar (Wand icon).'
    },
    {
      kind: 'table',
      headers: ['Wizard flow', 'Who uses it', 'Outcome'],
      rows: [
        ['Quick Start', 'First-time project setup', 'Instrument model selected, FSM imported, tags checked, ready for Preview'],
        ['New Procedure', 'Technologist adding a measurement', 'Procedure saved with guard, CLI steps and result tag binding'],
        ['Tag Binding', 'Engineer wiring a display element', 'LCD element bound to a tag with format string configured'],
        ['FSM Import', 'Engineer updating from hardware catalog', 'FSM states merged/replaced, transitions preserved']
      ]
    },
    {
      kind: 'task',
      task: 'Run the Quick Start wizard for a new project.',
      principle: 'The wizard enforces the correct setup order so you cannot skip steps that would leave the project in an inconsistent state.',
      steps: [
        'Click the Wand (✦) button in the project header, or press Ctrl+W.',
        'Select "Quick Start" from the wizard home screen.',
        'Step 1 — Instrument: pick your device model from the dropdown.',
        'Step 2 — FSM: choose to import from catalog or keep the current FSM.',
        'Step 3 — Tags: review auto-generated tags from the FSM model; add/remove as needed.',
        'Step 4 — Preview: the wizard navigates to Preview and runs a dry-run validation.',
        'Click Finish. The wizard closes and you are in the Preview workspace, ready to test.'
      ]
    }
  ]
};

const MASTER_WIZARD_RU: ManualSection = {
  id: 'master-wizard',
  title: '10. Мастер-помощник (Wizard)',
  summary: 'Задача-ориентированный онбординг: пошаговые сценарии для настройки проекта, новых процедур и привязки тегов.',
  blocks: [
    {
      kind: 'lead',
      text: 'Мастер-помощник проводит через четыре наиболее распространённых задачи проекта в пошаговом модальном окне: Быстрый старт, Новая процедура, Привязка тега и Импорт из каталога FSM. Запустите из панели заголовка (значок волшебной палочки).'
    },
    {
      kind: 'table',
      headers: ['Сценарий', 'Кто использует', 'Результат'],
      rows: [
        ['Быстрый старт', 'Первоначальная настройка проекта', 'Модель прибора выбрана, FSM импортирован, теги проверены, готово к Preview'],
        ['Новая процедура', 'Технолог добавляет измерение', 'Процедура сохранена с охранником, CLI-шагами и привязкой тега результата'],
        ['Привязка тега', 'Инженер подключает элемент экрана', 'Элемент LCD привязан к тегу с настроенной строкой формата'],
        ['Импорт FSM', 'Инженер обновляет из каталога оборудования', 'Состояния FSM объединены/заменены, переходы сохранены']
      ]
    },
    {
      kind: 'task',
      task: 'Запустить Быстрый старт для нового проекта.',
      principle: 'Wizard обеспечивает правильный порядок настройки — пропустить шаги, которые оставили бы проект в несогласованном состоянии, невозможно.',
      steps: [
        'Нажмите кнопку Wand (✦) в заголовке проекта или Ctrl+W.',
        'Выберите «Быстрый старт» на главном экране мастера.',
        'Шаг 1 — Прибор: выберите модель устройства из списка.',
        'Шаг 2 — FSM: выберите импорт из каталога или оставьте текущий FSM.',
        'Шаг 3 — Теги: просмотрите автоматически сгенерированные теги из модели FSM; добавьте/удалите по необходимости.',
        'Шаг 4 — Предпросмотр: мастер переходит в Preview и выполняет пробную валидацию.',
        'Нажмите «Готово». Мастер закрывается, и вы переходите в рабочее пространство Preview для тестирования.'
      ]
    }
  ]
};

const MASTER_WIZARD_ZH: ManualSection = {
  id: 'master-wizard',
  title: '10. 主向导',
  summary: '面向任务结果的引导：项目设置、新流程和标签绑定的分步引导流程。',
  blocks: [
    {
      kind: 'lead',
      text: '主向导在分步模态窗口中引导您完成四项最常见的项目任务：快速开始、新流程、标签绑定和从 FSM 目录导入。从标题工具栏（魔杖图标）启动。'
    },
    {
      kind: 'table',
      headers: ['向导流程', '使用者', '结果'],
      rows: [
        ['快速开始', '首次项目设置', '选定仪器型号，导入 FSM，检查标签，准备预览'],
        ['新流程', '添加测量的技术员', '保存含守护条件、CLI 步骤和结果标签绑定的流程'],
        ['标签绑定', '连接显示元素的工程师', 'LCD 元素绑定到标签并配置格式字符串'],
        ['FSM 导入', '从硬件目录更新的工程师', 'FSM 状态合并/替换，转换保留']
      ]
    },
    {
      kind: 'task',
      task: '为新项目运行快速开始向导。',
      principle: '向导强制执行正确的设置顺序，无法跳过会使项目处于不一致状态的步骤。',
      steps: [
        '点击项目标题中的魔杖（✦）按钮，或按 Ctrl+W。',
        '从向导主屏幕选择"快速开始"。',
        '步骤 1 — 仪器：从下拉菜单选择设备型号。',
        '步骤 2 — FSM：选择从目录导入或保留当前 FSM。',
        '步骤 3 — 标签：查看从 FSM 模型自动生成的标签；按需添加/删除。',
        '步骤 4 — 预览：向导导航到预览并运行试运行验证。',
        '点击完成。向导关闭，您进入预览工作区，准备测试。'
      ]
    }
  ]
};

/* ============================================================================
 * NEW FEATURES — v0.2.x (ELK Layout, Text Registry, Tag Bindings,
 *                         Guided Tour, Settings, Screen DSL i18n)
 * ========================================================================= */

const ELK_SWIMLANES_EN: ManualSection = {
  id: 'elk-layout',
  title: '12. ELK Layout & Swimlanes',
  summary: 'Professional orthogonal layout for FSM diagrams with subsystem swimlanes.',
  blocks: [
    { kind: 'lead', text: 'The "ELK Layout" button runs the Eclipse Layout Kernel (LAYERED algorithm) to arrange the FSM graph automatically: edges become right-angle orthogonal lines with crossing minimisation, and coloured swimlane bands group states by subsystem.' },
    {
      kind: 'task',
      task: 'Apply ELK layout to a large FSM',
      principle: 'ELK computes node positions and routes edges as orthogonal polylines. The result is deterministic and crossing-minimal. Swimlane bands are then derived from the resulting bounding boxes of each subsystem group.',
      steps: [
        'Open the FSM editor workspace.',
        'Click "ELK Layout" in the toolbar (next to "Auto arrange").',
        'Wait for the async layout to complete — nodes reposition automatically.',
        'Coloured swimlane bands appear labelled with subsystem names (e.g. "1 · Diagnostic", "3 · Photometry").',
        'Toggle swimlane visibility with the "Swimlanes ✓" button.',
        'Drag individual nodes to refine positions — the layout is saved to the project.'
      ]
    },
    {
      kind: 'table',
      headers: ['Subsystem', 'Section numbers', 'Colour'],
      rows: [
        ['diagnostic',   '1-x-x',  'red-tinted'],
        ['main-menu',    '2-x-x',  'indigo-tinted'],
        ['photometry',   '3-x-x',  'green-tinted'],
        ['quantitative', '4-x-x',  'teal-tinted'],
        ['kinetics',     '5-x-x',  'amber-tinted'],
        ['multiwave',    '6-x-x',  'purple-tinted'],
        ['settings',     '7-x-x',  'grey-tinted'],
        ['files',        '8-x-x',  'orange-tinted'],
        ['shared',       'SHARED-*', 'light-grey'],
      ]
    },
    { kind: 'note', text: 'ELK requires elkjs (installed as a project dependency). The layout runs entirely in the browser — no internet connection is required. For very large graphs (>300 nodes) layout may take 2–5 seconds.' }
  ]
};

const TEXT_REGISTRY_EN: ManualSection = {
  id: 'text-registry',
  title: '13. Text Registry',
  summary: 'Centralised dictionary of all screen text labels across all languages.',
  blocks: [
    { kind: 'lead', text: 'The Text Registry tab aggregates every TextCanvasObject from every screen into a single editable table with columns for RU, EN and ZH. Changes made here propagate immediately back to the screen canvas. The complete dictionary can be exported to CSV for translators or for handing off to sub-contractors.' },
    {
      kind: 'task',
      task: 'Review and complete missing translations',
      principle: 'Text Registry reads the entire project on mount, extracts every text object, and groups entries by screen and subsystem. Inline editing calls updateCanvasObject internally — Undo/Redo works normally.',
      steps: [
        'Click the "Text Registry" workspace tab.',
        'Use the subsystem filter dropdown to focus on one section at a time.',
        'Rows with yellow background have missing EN or ZH translations ("partial" status).',
        'Click any cell in the RU/EN/ZH column to edit it inline. Press Enter or click away to save.',
        'Once all rows show the green ✓ status, click "CSV" to download a BOM-encoded CSV (opens correctly in Excel).',
        'Import translations back: open the CSV in Excel, edit the EN/ZH columns, save — then use a scripted update (see API docs).'
      ]
    },
    {
      kind: 'table',
      headers: ['Column', 'Meaning'],
      rows: [
        ['Screen',     'Screen name and ID of the LCD screen containing the text object.'],
        ['Subsystem',  'FSM subsystem the screen belongs to (diagnostic, photometry, …).'],
        ['RU',         'Russian text as it appears on the LCD.'],
        ['EN',         'English translation.'],
        ['ZH',         'Simplified Chinese translation.'],
        ['Status',     '✓ = all languages filled;  partial = some missing;  empty = all blank.'],
      ]
    }
  ]
};

const TAG_BINDINGS_EN: ManualSection = {
  id: 'tag-bindings',
  title: '14. Tag Bindings',
  summary: 'Connect live measurement values to LCD text objects and control panel buttons.',
  blocks: [
    { kind: 'lead', text: 'Tag bindings link HMI elements to live tag values at runtime. A text object bound to "@absorbance" will display the current absorbance reading instead of its static text. A button bound to "@lamp_d2_fail" will hide itself when the D2 lamp fails.' },
    {
      kind: 'task',
      task: 'Bind a measurement value to an LCD text object',
      principle: 'The binding is stored in CanvasObject.bindings.text as a ValueExpression {kind:"tag", tagId}. At runtime the OrchestratedRuntimeEngine resolves the current tag value from the tag snapshot and substitutes it into the rendered framebuffer.',
      steps: [
        'Define the tag first: go to Tag Registry, click +, set id="absorbance", dataType="float", unit="AU".',
        'Open the LCD editor, select a text object on the screen.',
        'Scroll to "Tag bindings" in the right inspector panel.',
        'In the "Text value" field type @absorbance.',
        'The static text will be replaced by the live tag value during Runtime simulation.',
        'Use @tagId for tag references, or a literal string for static overrides.'
      ]
    },
    {
      kind: 'task',
      task: 'Bind button visibility to an alarm condition',
      principle: 'Control panel buttons have HmiBindings.visibility. When the expression resolves to falsy (0, false, "") the button is hidden in the runtime view.',
      steps: [
        'Open the Control Panel workspace.',
        'Select a button element.',
        'In the right inspector, find "Tag bindings → Visibility".',
        'Type @lamp_d2_fail (or any boolean tag).',
        'In the Runtime workspace the button will only be visible when lamp_d2_fail = false.',
      ]
    },
    { kind: 'note', text: 'ValueExpression syntax: @tagId → live tag value; a plain string → literal constant.' }
  ]
};

const GUIDED_TOUR_EN: ManualSection = {
  id: 'guided-tour',
  title: '15. Guided Tour (Interactive Tutorial)',
  summary: 'Step-by-step hands-on walkthrough with live store-state verification.',
  blocks: [
    { kind: 'lead', text: 'The Guided Tour (click "Learn" in the top header) is an interactive mode where the IDE verifies each action you perform before allowing you to advance. A spotlight highlights the element you should interact with, and the step auto-advances as soon as the expected store state is reached.' },
    {
      kind: 'table',
      headers: ['Step', 'Instruction', 'Verified by'],
      rows: [
        ['1', 'Welcome — concept overview', 'informational'],
        ['2', 'Open the FSM editor tab', 'informational'],
        ['3', 'Create a new FSM state', 'project.fsm.stateOrder.length > 0'],
        ['4', 'Mark the state as initial', 'any state with .initial === true'],
        ['5', 'Open the LCD editor', 'informational'],
        ['6', 'Draw a text object on the screen', 'screen.objects.length > 0'],
        ['7', 'Open the Runtime workspace', 'informational'],
        ['8', 'Congratulations!', 'informational'],
      ]
    },
    { kind: 'note', text: 'The tour can be repeated at any time. Each step has a "Skip" button for experienced users. The "Check & Next" button only activates after the verification predicate passes — the IDE polls the store every 500ms.' }
  ]
};

const SETTINGS_PANEL_EN: ManualSection = {
  id: 'settings',
  title: '16. Settings',
  summary: 'Language, project metadata, display defaults and API/MCP server status.',
  blocks: [
    { kind: 'lead', text: 'The Settings workspace (last tab in the navigation) centralises project-level configuration and server status.' },
    {
      kind: 'table',
      headers: ['Section', 'What you can change'],
      rows: [
        ['Interface language', 'Switch between RU / EN / ZH — affects all UI labels immediately.'],
        ['Project metadata', 'Name, version, author, firmware version, device model ID.'],
        ['Display defaults', 'LCD width and height applied to newly created screens.'],
        ['API & MCP servers', 'Read-only status when running in Electron desktop mode (ports 8766/8767).'],
      ]
    },
    { kind: 'note', text: 'API and MCP servers are only available in the Electron desktop build (npm run electron:dev). They are not available in the web-browser dev build.' }
  ]
};

/* ── Russian equivalents ─────────────────────────────────────────────── */

const ELK_SWIMLANES_RU: ManualSection = {
  id: 'elk-layout',
  title: '12. ELK Layout и дорожки подсистем',
  summary: 'Профессиональная ортогональная раскладка FSM-диаграммы с визуальными дорожками.',
  blocks: [
    { kind: 'lead', text: 'Кнопка "ELK Layout" запускает алгоритм LAYERED движка Eclipse Layout Kernel: рёбра становятся ортогональными (только прямые углы) с минимизацией пересечений, а цветные дорожки-swimlanes группируют состояния по подсистемам.' },
    {
      kind: 'task',
      task: 'Применить ELK Layout к большому FSM',
      principle: 'ELK вычисляет позиции узлов и прокладывает рёбра как ортогональные ломаные линии. Результат детерминирован и оптимален по пересечениям. Дорожки подсистем строятся автоматически из ограничивающих прямоугольников групп.',
      steps: [
        'Откройте вкладку FSM-редактор.',
        'Нажмите "ELK Layout" в тулбаре (рядом с "Auto arrange").',
        'Дождитесь завершения асинхронной раскладки — узлы перемещаются автоматически.',
        'Появятся цветные полосы-дорожки с подписями подсистем (например, "1 · Диагностика", "3 · Фотометрия").',
        'Для скрытия/показа дорожек нажмите "Swimlanes ✓".',
        'Перетаскивайте узлы для ручной корректировки — позиции сохраняются в проекте.'
      ]
    },
    {
      kind: 'table',
      headers: ['Подсистема', 'Номера разделов', 'Цвет'],
      rows: [
        ['diagnostic',   '1-x-x',  'красный'],
        ['main-menu',    '2-x-x',  'индиго'],
        ['photometry',   '3-x-x',  'зелёный'],
        ['quantitative', '4-x-x',  'бирюзовый'],
        ['kinetics',     '5-x-x',  'янтарный'],
        ['multiwave',    '6-x-x',  'фиолетовый'],
        ['settings',     '7-x-x',  'серый'],
        ['files',        '8-x-x',  'оранжевый'],
        ['shared',       'SHARED-*', 'светло-серый'],
      ]
    },
    { kind: 'note', text: 'ELK требует библиотеку elkjs (установлена как зависимость проекта). Раскладка выполняется полностью в браузере, без интернет-соединения. Для графов >300 узлов — 2–5 секунд.' }
  ]
};

const TEXT_REGISTRY_RU: ManualSection = {
  id: 'text-registry',
  title: '13. Реестр текстов',
  summary: 'Централизованный словарь всех текстовых надписей на экранах.',
  blocks: [
    { kind: 'lead', text: 'Вкладка "Реестр текстов" собирает все текстовые объекты со всех экранов в единую таблицу с колонками RU / EN / ZH. Изменения применяются мгновенно. Весь словарь экспортируется в CSV для передачи переводчикам и китайским инженерам.' },
    {
      kind: 'task',
      task: 'Заполнить недостающие переводы',
      principle: 'Реестр читает весь проект при открытии, извлекает каждый TextCanvasObject и группирует их по экрану и подсистеме. Инлайн-редактирование вызывает updateCanvasObject внутри — Undo/Redo работает стандартно.',
      steps: [
        'Нажмите вкладку "Реестр текстов".',
        'Используйте фильтр по подсистеме для фокусировки на одном разделе.',
        'Строки с жёлтым фоном имеют статус "partial" — нет EN или ZH.',
        'Нажмите на ячейку RU/EN/ZH для редактирования. Enter или клик вне поля — сохранение.',
        'После заполнения всех строк нажмите "CSV" — скачается файл с BOM (корректно открывается в Excel).',
        'Верните переведённый CSV через скрипт миграции или импорт.'
      ]
    },
    {
      kind: 'table',
      headers: ['Колонка', 'Значение'],
      rows: [
        ['Экран',       'Имя и ID LCD-экрана, содержащего текстовый объект.'],
        ['Подсистема',  'FSM-подсистема экрана (diagnostic, photometry, …).'],
        ['RU',          'Текст на русском языке, отображаемый на LCD.'],
        ['EN',          'Перевод на английский.'],
        ['ZH',          'Перевод на упрощённый китайский.'],
        ['Статус',      '✓ = все языки заполнены;  partial = часть отсутствует;  empty = пусто.'],
      ]
    }
  ]
};

const TAG_BINDINGS_RU: ManualSection = {
  id: 'tag-bindings',
  title: '14. Привязки тегов',
  summary: 'Подключение живых значений измерений к объектам LCD и кнопкам панели.',
  blocks: [
    { kind: 'lead', text: 'Привязки тегов соединяют элементы HMI с живыми значениями тегов во время выполнения. Текстовый объект с привязкой "@absorbance" будет отображать текущее значение оптической плотности вместо статичного текста.' },
    {
      kind: 'task',
      task: 'Привязать значение измерения к текстовому объекту LCD',
      principle: 'Привязка хранится в CanvasObject.bindings.text как ValueExpression {kind:"tag", tagId}. Во время симуляции движок подставляет текущее значение тега вместо статичного текста.',
      steps: [
        'Создайте тег: Реестр тегов → + → id="absorbance", dataType="float", unit="AU".',
        'Откройте LCD-редактор, выделите текстовый объект.',
        'Найдите раздел "Привязки тегов" в правом инспекторе.',
        'В поле "Текстовое значение" введите @absorbance.',
        'В вкладке "Выполнение" текст будет заменён живым значением тега.'
      ]
    },
    {
      kind: 'task',
      task: 'Привязать видимость кнопки к условию аварии',
      principle: 'Кнопки панели управления имеют поле HmiBindings.visibility. Когда выражение равно ложному значению (0, false, пустая строка) — кнопка скрывается в режиме выполнения.',
      steps: [
        'Откройте вкладку "Панель управления".',
        'Выберите элемент кнопки.',
        'В правом инспекторе найдите "Привязки тегов → Видимость".',
        'Введите @lamp_d2_fail (или любой булевый тег).',
        'В режиме "Выполнение" кнопка видна только когда lamp_d2_fail = false.',
      ]
    },
    { kind: 'note', text: 'Синтаксис ValueExpression: @tagId → живое значение тега; любая другая строка → литеральная константа.' }
  ]
};

const GUIDED_TOUR_RU: ManualSection = {
  id: 'guided-tour',
  title: '15. Интерактивное обучение',
  summary: 'Пошаговое руководство с проверкой действий в реальном времени.',
  blocks: [
    { kind: 'lead', text: 'Интерактивный тур (кнопка "Обучение" в шапке) — это режим, в котором IDE проверяет каждое выполненное действие перед переходом к следующему шагу. Подсветка указывает на нужный элемент интерфейса, а шаг переходит автоматически, как только хранилище (Zustand store) принимает нужное состояние.' },
    {
      kind: 'table',
      headers: ['Шаг', 'Инструкция', 'Критерий проверки'],
      rows: [
        ['1', 'Приветствие и концепция', 'информационный'],
        ['2', 'Открыть FSM-редактор', 'информационный'],
        ['3', 'Создать состояние FSM', 'stateOrder.length > 0'],
        ['4', 'Пометить как начальное', 'state.initial === true'],
        ['5', 'Открыть LCD-редактор', 'информационный'],
        ['6', 'Нарисовать текстовый объект', 'screen.objects.length > 0'],
        ['7', 'Открыть Выполнение', 'информационный'],
        ['8', 'Поздравляем!', 'информационный'],
      ]
    },
    { kind: 'note', text: 'Тур можно повторять в любое время. На каждом шаге есть кнопка "Пропустить" для опытных пользователей. Кнопка "Проверить и далее" активируется только после выполнения предиката — IDE опрашивает хранилище каждые 500 мс.' }
  ]
};

const SETTINGS_PANEL_RU: ManualSection = {
  id: 'settings',
  title: '16. Настройки',
  summary: 'Язык, метаданные проекта, параметры дисплея и статус API/MCP-серверов.',
  blocks: [
    { kind: 'lead', text: 'Вкладка "Настройки" (последняя в навигации) централизует конфигурацию проекта и статус серверов.' },
    {
      kind: 'table',
      headers: ['Раздел', 'Что можно изменить'],
      rows: [
        ['Язык интерфейса', 'Переключение RU / EN / ZH — все метки изменяются мгновенно.'],
        ['Метаданные проекта', 'Имя, версия, автор, версия прошивки, ID модели устройства.'],
        ['Параметры дисплея', 'Ширина и высота LCD по умолчанию для новых экранов.'],
        ['API и MCP-серверы', 'Статус в режиме Electron desktop (порты 8766 / 8767).'],
      ]
    },
    { kind: 'note', text: 'API и MCP-серверы доступны только в Electron desktop-сборке (npm run electron:dev). В веб-браузерной версии они недоступны.' }
  ]
};

const API_MCP_CONNECTORS_EN: ManualSection = {
  id: 'api-mcp-connectors',
  title: '17. API and MCP automation',
  summary: 'Operate the desktop app from REST clients, MCP-capable agents and local automation tools.',
  blocks: [
    { kind: 'lead', text: 'When the Electron desktop app is running it exposes a local REST API on 127.0.0.1:8766 and an MCP endpoint on 127.0.0.1:8767/mcp. Both operate on the project currently open in the UI.' },
    {
      kind: 'table',
      headers: ['Client', 'Recommended route'],
      rows: [
        ['Claude Code / Codex / OpenCode', 'Use an MCP HTTP connector when available; otherwise call the REST API with curl or a small script.'],
        ['LM Studio / Ollama agents', 'Use a tool-calling wrapper that sends JSON requests to the REST API.'],
        ['Shell scripts and CI smoke checks', 'Use REST endpoints for health, project metadata, screen export and runtime events.']
      ]
    },
    {
      kind: 'task',
      task: 'Drive the UI from an agent.',
      principle: 'Keep the desktop window open, let the agent read state first, then mutate through documented endpoints and validate after each batch.',
      steps: [
        'Start the desktop app with npm run electron:dev or launch the packaged app.',
        'Open a project or the bundled demo project.',
        'Check GET http://127.0.0.1:8766/api/health.',
        'Read /api/workspaces/capabilities and /api/project before changing anything.',
        'Apply small changes through REST or MCP, then call /api/validate and inspect the UI.'
      ]
    },
    { kind: 'note', text: 'See docs/API_MCP_CONNECTORS.md for connector setup examples, curl recipes and agent prompts.' }
  ]
};

const API_MCP_CONNECTORS_RU: ManualSection = {
  id: 'api-mcp-connectors',
  title: '17. API и MCP-автоматизация',
  summary: 'Управление desktop-приложением из REST-клиентов, MCP-агентов и локальных automation tools.',
  blocks: [
    { kind: 'lead', text: 'Когда запущена Electron-версия приложения, она поднимает локальный REST API на 127.0.0.1:8766 и MCP endpoint на 127.0.0.1:8767/mcp. Оба интерфейса работают с проектом, который открыт в UI.' },
    {
      kind: 'table',
      headers: ['Клиент', 'Рекомендуемый путь'],
      rows: [
        ['Claude Code / Codex / OpenCode', 'Используйте MCP HTTP connector, если он доступен; иначе вызывайте REST API через curl или небольшой скрипт.'],
        ['LM Studio / Ollama agents', 'Используйте tool-calling wrapper, который отправляет JSON-запросы в REST API.'],
        ['Shell-скрипты и CI smoke checks', 'Используйте REST endpoints для health, metadata, screen export и runtime events.']
      ]
    },
    {
      kind: 'task',
      task: 'Управлять интерфейсом из agent-среды.',
      principle: 'Держите desktop-окно открытым, сначала считывайте состояние, затем меняйте проект через документированные endpoints и валидируйте каждую пачку изменений.',
      steps: [
        'Запустите desktop-приложение через npm run electron:dev или packaged app.',
        'Откройте проект или встроенный demo-проект.',
        'Проверьте GET http://127.0.0.1:8766/api/health.',
        'Прочитайте /api/workspaces/capabilities и /api/project перед изменениями.',
        'Применяйте небольшие изменения через REST или MCP, затем вызывайте /api/validate и проверяйте UI.'
      ]
    },
    { kind: 'note', text: 'Подробные настройки connector-клиентов, curl-рецепты и agent prompts находятся в docs/API_MCP_CONNECTORS.md.' }
  ]
};

const API_MCP_CONNECTORS_ZH: ManualSection = {
  id: 'api-mcp-connectors',
  title: '17. API 和 MCP 自动化',
  summary: '从 REST 客户端、MCP 代理和本地自动化工具操作桌面应用。',
  blocks: [
    { kind: 'lead', text: 'Electron 桌面应用运行时会在 127.0.0.1:8766 暴露本地 REST API，并在 127.0.0.1:8767/mcp 暴露 MCP endpoint。二者都操作当前 UI 中打开的项目。' },
    {
      kind: 'table',
      headers: ['客户端', '建议路径'],
      rows: [
        ['Claude Code / Codex / OpenCode', '优先使用 MCP HTTP connector；否则通过 curl 或脚本调用 REST API。'],
        ['LM Studio / Ollama agents', '使用 tool-calling wrapper 将 JSON 请求发送到 REST API。'],
        ['Shell scripts and CI smoke checks', '使用 REST endpoints 检查 health、metadata、screen export 和 runtime events。']
      ]
    },
    {
      kind: 'task',
      task: '从 agent 环境驱动 UI。',
      principle: '保持桌面窗口打开，先读取状态，再通过文档化 endpoint 修改项目，并在每批修改后验证。',
      steps: [
        '运行 npm run electron:dev 或启动 packaged app。',
        '打开项目或内置 demo 项目。',
        '检查 GET http://127.0.0.1:8766/api/health。',
        '修改前读取 /api/workspaces/capabilities 和 /api/project。',
        '通过 REST 或 MCP 应用小批量修改，然后调用 /api/validate 并检查 UI。'
      ]
    },
    { kind: 'note', text: '连接器设置、curl 示例和 agent prompts 见 docs/API_MCP_CONNECTORS.md。' }
  ]
};

export const OPERATION_MANUAL_BY_LANGUAGE = {
  en: [...OPERATION_MANUAL_EN, CURRENT_FUNCTIONALITY_EN, HMI_TAGS_EN, HMI_PROCEDURES_EN, MASTER_WIZARD_EN,
       ELK_SWIMLANES_EN, TEXT_REGISTRY_EN, TAG_BINDINGS_EN, GUIDED_TOUR_EN, SETTINGS_PANEL_EN, API_MCP_CONNECTORS_EN],
  ru: [...OPERATION_MANUAL_RU, CURRENT_FUNCTIONALITY_RU, HMI_TAGS_RU, HMI_PROCEDURES_RU, MASTER_WIZARD_RU,
       ELK_SWIMLANES_RU, TEXT_REGISTRY_RU, TAG_BINDINGS_RU, GUIDED_TOUR_RU, SETTINGS_PANEL_RU, API_MCP_CONNECTORS_RU],
  zh: [...OPERATION_MANUAL_ZH, CURRENT_FUNCTIONALITY_ZH, HMI_TAGS_ZH, HMI_PROCEDURES_ZH, MASTER_WIZARD_ZH,
       ELK_SWIMLANES_EN, TEXT_REGISTRY_EN, TAG_BINDINGS_EN, GUIDED_TOUR_EN, SETTINGS_PANEL_EN, API_MCP_CONNECTORS_ZH]
} as const;

export const OPERATION_MANUAL = OPERATION_MANUAL_EN;
