/**
 * Generates the screenshot-illustrated Operation User Manual in English,
 * Russian and Simplified Chinese as self-contained HTML plus a printed PDF
 * per language, reusing the shared screenshot assets under
 * docs/user-manuals/assets/operation-manual/.
 *
 * Run: node scripts/generate-operation-manual.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = resolve('docs/user-manuals');
const assetsDirName = 'assets/operation-manual';

const LANGS = ['en', 'ru', 'zh'];

const META = {
  en: {
    htmlLang: 'en',
    docTitle: 'LCD-bitmap IDE Operation Manual',
    kicker: 'Operation manual',
    title: 'LCD-bitmap IDE',
    subtitle: 'A desktop workbench for monochrome embedded LCD interfaces: screens, the navigation state machine, the physical control panel, runtime tags and firmware-ready export — kept in a single project file.',
    meta: [['Software version', '0.1.18'], ['Project format', '.lcdproj, schema 6'], ['Platforms', 'Windows · Linux · macOS'], ['Builds', 'Electron · Tauri']],
    tocLabel: 'Contents',
    footer: 'LCD-bitmap IDE · version 0.1.18 · Electron and Tauri builds share one automation contract and one project model. Detailed technical documents live in the repository’s docs/ directory.'
  },
  ru: {
    htmlLang: 'ru',
    docTitle: 'Руководство по эксплуатации LCD-bitmap IDE',
    kicker: 'Руководство по эксплуатации',
    title: 'LCD-bitmap IDE',
    subtitle: 'Настольная среда для проектирования монохромных LCD-интерфейсов встраиваемых устройств: экраны, конечный автомат навигации, физическая панель, runtime-теги и firmware-ready экспорт — в одном файле проекта.',
    meta: [['Версия ПО', '0.1.18'], ['Формат проекта', '.lcdproj, schema 6'], ['Платформы', 'Windows · Linux · macOS'], ['Сборки', 'Electron · Tauri']],
    tocLabel: 'Содержание',
    footer: 'LCD-bitmap IDE · версия 0.1.18 · Electron и Tauri сборки собираются из одного контракта автоматизации и одной модели проекта. Подробные технические документы — в каталоге docs/ репозитория.'
  },
  zh: {
    htmlLang: 'zh-CN',
    docTitle: 'LCD-bitmap IDE 操作手册',
    kicker: '操作手册',
    title: 'LCD-bitmap IDE',
    subtitle: '面向嵌入式设备的单色 LCD 界面桌面设计工具：屏幕、导航状态机、物理控制面板、运行时标签与可直接用于固件的导出——全部保存在一个项目文件中。',
    meta: [['软件版本', '0.1.18'], ['项目格式', '.lcdproj, schema 6'], ['支持平台', 'Windows · Linux · macOS'], ['桌面构建', 'Electron · Tauri']],
    tocLabel: '目录',
    footer: 'LCD-bitmap IDE · 版本 0.1.18 · Electron 与 Tauri 构建共用同一套自动化协议和同一个项目模型。详细技术文档位于仓库的 docs/ 目录。'
  }
};

// Each chapter: { id, num, title:{en,ru,zh}, blocks:{en:[...],ru:[...],zh:[...]} }
// Block kinds: p (paragraph), lede, points:[...], steps:[...], shot:{src,alt,cap},
// callout:{text,warn?}, sub (subheading), table:{head:[],rows:[[]]}
const CH = [
  {
    id: 'start',
    title: { en: 'First Launch', ru: 'Первый запуск', zh: '首次启动' },
    blocks: {
      en: [
        { k: 'lede', t: 'The application needs no external services and makes no network calls: an entire project is one <code>.lcdproj</code> file.' },
        { k: 'steps', items: [
          'Install the build for your OS from <a href="https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest">GitHub Releases</a>, or run the source with <code>npm run electron:dev</code>.',
          'On the start screen, pick an interface language, then one of four entry points: open an existing <code>.lcdproj</code>, create a new project, restore an autosave, or open the bundled demo project.',
          'For a first look, choose <b>Demo</b> — it already contains linked states, screens and transitions you can learn from safely.'
        ] },
        { k: 'shot', src: '01-startup.png', alt: 'Start screen of LCD-bitmap IDE with a language picker and four entry points', cap: '<b>Start screen.</b> Interface language (EN / RU / ZH) and entry points: open a project, create a new one, restore an autosave, or open the demo.' },
        { k: 'callout', t: 'The project autosaves to <code>localStorage</code> every few seconds. That is a crash safety net, not a substitute for an explicit <b>Save project</b> — save the file to disk yourself before closing the session.' }
      ],
      ru: [
        { k: 'lede', t: 'Приложение не требует установки зависимостей и не обращается в сеть: весь проект — это один файл <code>.lcdproj</code>.' },
        { k: 'steps', items: [
          'Установите сборку под вашу ОС со страницы <a href="https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest">GitHub Releases</a>, либо запустите исходники командой <code>npm run electron:dev</code>.',
          'На стартовом экране выберите язык интерфейса и один из четырёх путей: открыть существующий <code>.lcdproj</code>, создать новый проект, восстановить автосохранение или открыть встроенный демо-проект.',
          'Для первого знакомства выбирайте <b>Demo</b> — он уже содержит связанные состояния, экраны и переходы, на которых можно учиться, ничем не рискуя.'
        ] },
        { k: 'shot', src: '01-startup.png', alt: 'Стартовый экран LCD-bitmap IDE с выбором языка и четырьмя вариантами начала работы', cap: '<b>Стартовый экран.</b> Выбор языка интерфейса (EN / RU / ZH) и точки входа: открыть проект, создать новый, восстановить автосохранение или открыть демо.' },
        { k: 'callout', t: 'Проект автосохраняется в <code>localStorage</code> каждые несколько секунд. Это подстраховка на случай сбоя, а не замена явному <b>Save project</b> — сохраняйте файл на диск вручную перед закрытием сессии.' }
      ],
      zh: [
        { k: 'lede', t: '本应用无需联网、无需安装依赖：整个项目就是一个 <code>.lcdproj</code> 文件。' },
        { k: 'steps', items: [
          '从 <a href="https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest">GitHub Releases</a> 下载适合你系统的安装包，或运行源码：<code>npm run electron:dev</code>。',
          '在启动界面选择界面语言，然后选择四种入口之一：打开已有的 <code>.lcdproj</code>、新建项目、恢复自动保存，或打开内置演示项目。',
          '首次使用建议选择 <b>Demo</b>——其中已包含相互关联的状态、屏幕和转换，可以安全地边看边学。'
        ] },
        { k: 'shot', src: '01-startup.png', alt: '带有语言选择和四个入口按钮的 LCD-bitmap IDE 启动界面', cap: '<b>启动界面。</b>界面语言选择（EN / RU / ZH）与四个入口：打开项目、新建项目、恢复自动保存或打开演示项目。' },
        { k: 'callout', t: '项目每隔几秒会自动保存到 <code>localStorage</code>。这只是崩溃保护，并不能替代显式的 <b>Save project</b>——关闭会话前请务必手动将文件保存到磁盘。' }
      ]
    }
  },
  {
    id: 'interface',
    title: { en: 'Interface Overview', ru: 'Устройство интерфейса', zh: '界面结构' },
    blocks: {
      en: [
        { k: 'p', t: 'On the left is a compact navigator of workspaces grouped by purpose: <b>Interface</b> (screens and the panel), <b>Logic</b> (FSM and alarms), <b>Hardware</b> (tags and procedures), <b>Verify &amp; deliver</b> (simulation and firmware handoff). Every workspace has its own independently collapsible side panes.' },
        { k: 'points', items: [
          'The <span class="chip">Collapse navigator</span> control (or <kbd>Ctrl+B</kbd>) collapses only the global navigator into a narrow icon rail — the current workspace’s own side panels stay put.',
          'The status bar at the bottom always shows display size, FSM state/transition counts, screen and panel-element counts, plus validation status and unsaved-change state.',
          'The theme switch (Settings → Theme) supports light, dark and system-follow modes.'
        ] }
      ],
      ru: [
        { k: 'p', t: 'Слева — компактный навигатор рабочих областей, сгруппированных по смыслу: <b>Interface</b> (экраны и панель), <b>Logic</b> (FSM и аварии), <b>Hardware</b> (теги и процедуры), <b>Verify &amp; deliver</b> (симуляция и передача прошивке). Каждая рабочая область имеет собственные независимо сворачиваемые боковые панели.' },
        { k: 'points', items: [
          'Кнопка <span class="chip">Collapse navigator</span> (или <kbd>Ctrl+B</kbd>) сворачивает только глобальный навигатор в узкую иконочную полосу — боковые панели конкретной рабочей области при этом остаются на месте.',
          'Строка состояния внизу всегда показывает размер дисплея, число состояний/переходов FSM, число экранов и элементов панели, а также статус валидации и наличие несохранённых изменений.',
          'Переключатель темы (Settings → Theme) поддерживает светлую, тёмную и системную схему.'
        ] }
      ],
      zh: [
        { k: 'p', t: '左侧是按用途分组的紧凑工作区导航栏：<b>Interface</b>（屏幕与面板）、<b>Logic</b>（FSM 与报警）、<b>Hardware</b>（标签与流程）、<b>Verify &amp; deliver</b>（仿真与固件交付）。每个工作区都拥有各自可独立折叠的侧边栏。' },
        { k: 'points', items: [
          '<span class="chip">Collapse navigator</span>（或按 <kbd>Ctrl+B</kbd>）只会把全局导航栏折叠成一条窄图标栏——当前工作区自身的侧边栏不受影响。',
          '底部状态栏始终显示显示屏尺寸、FSM 状态/转换数量、屏幕与面板元素数量，以及校验状态和未保存更改的提示。',
          '主题切换（Settings → Theme）支持浅色、深色和跟随系统三种模式。'
        ] }
      ]
    }
  },
  {
    id: 'fsm',
    title: { en: 'FSM Editor', ru: 'Редактор FSM', zh: 'FSM 编辑器' },
    blocks: {
      en: [
        { k: 'lede', t: 'The finite-state machine is the device’s navigation map: a state corresponds to one LCD screen, a transition to a reaction to a button, timer or condition.' },
        { k: 'shot', src: '02-demo-loaded-fsm.png', alt: 'FSM state graph of the demo project with five linked states', cap: '<b>FSM graph in read-only mode.</b> Left: the state catalog. Center: the transition graph. Right: the inspector for the selected item. Connections stay visible regardless of edit mode.' },
        { k: 'sub', t: 'Edit mode' },
        { k: 'p', t: 'The graph opens <i>read-only</i> by default — a deliberate guard against accidentally changing live logic. Graph-mutating controls (adding a state, deleting, dragging) only become active once you explicitly turn on <span class="chip">Edit graph</span>.' },
        { k: 'shot', src: '04-fsm-edit-mode.png', alt: 'FSM editor with edit mode on, showing the blue canvas outline', cap: '<b>Edit mode on</b> — the canvas outline turns blue; creating states and dragging nodes becomes available.' },
        { k: 'sub', t: 'Creating a state and a transition' },
        { k: 'steps', items: [
          'Turn on <span class="chip">Edit graph</span>, then click the <b>+</b> above the state list, or right-click empty canvas → <b>Add state</b>.',
          'Name the state and, if needed, mark it <b>Initial</b> (entry point) or <b>Terminal</b> (end point).',
          'To connect states, either drag between the connection handles on the nodes, or use the <b>Transition routes</b> section in the right-hand inspector — pick the target state and event without touching the canvas directly.',
          'Link the state to an LCD screen via <b>Linked LCD screen → Edit layout</b> to jump straight into its pixel design.'
        ] },
        { k: 'sub', t: 'Overview and filters' },
        { k: 'p', t: 'For a large graph, turn on <span class="chip">Overview</span> — it shows one entry point per subsystem instead of the full graph. Whenever Overview, a subsystem focus or a layer filter hides part of the transitions, the toolbar shows a <b>“shown / total”</b> counter and the reason — a one-click filter reset sits right next to it.' },
        { k: 'shot', src: '05-fsm-overview.png', alt: 'FSM editor in overview mode with enlarged state cards grouped by subsystem', cap: '<b>Overview mode</b> groups states by subsystem and entry point — useful for navigating large projects.' }
      ],
      ru: [
        { k: 'lede', t: 'Конечный автомат — это карта навигации устройства: состояние соответствует одному LCD-экрану, переход — реакции на кнопку, таймер или условие.' },
        { k: 'shot', src: '02-demo-loaded-fsm.png', alt: 'Граф состояний FSM демо-проекта с пятью связанными состояниями', cap: '<b>Граф FSM в режиме чтения.</b> Слева — каталог состояний, по центру — граф переходов, справа — инспектор выбранного элемента. Связи видны независимо от режима редактирования.' },
        { k: 'sub', t: 'Режим редактирования' },
        { k: 'p', t: 'Граф по умолчанию открывается <i>только для чтения</i> — это намеренная защита от случайного изменения рабочей логики. Кнопки, изменяющие граф (добавление состояния, удаление, перетаскивание), становятся активны только после явного включения <span class="chip">Edit graph</span>.' },
        { k: 'shot', src: '04-fsm-edit-mode.png', alt: 'FSM-редактор с включённым режимом редактирования, видна синяя рамка холста', cap: '<b>Режим редактирования включён</b> — рамка холста подсвечена синим, доступны создание состояний и перетаскивание узлов.' },
        { k: 'sub', t: 'Создание состояния и перехода' },
        { k: 'steps', items: [
          'Включите <span class="chip">Edit graph</span>, затем нажмите <b>+</b> над списком состояний либо кликните правой кнопкой по пустому месту холста → <b>Add state</b>.',
          'Назовите состояние и при необходимости отметьте его как <b>Initial</b> (точка входа) или <b>Terminal</b> (конечное).',
          'Для перехода между состояниями либо перетащите связь между точками соединения на узлах, либо используйте раздел <b>Transition routes</b> в инспекторе справа — выберите целевое состояние и событие, не работая с холстом напрямую.',
          'Свяжите состояние с LCD-экраном через <b>Linked LCD screen → Edit layout</b>, чтобы сразу перейти к его пиксельному дизайну.'
        ] },
        { k: 'sub', t: 'Обзор и фильтры' },
        { k: 'p', t: 'При большом графе включите <span class="chip">Overview</span> — он показывает по одному входу на каждую подсистему вместо полного графа. Если из-за обзора, фокуса на подсистеме или фильтра слоёв часть переходов скрыта, панель инструментов показывает счётчик <b>«показано / всего»</b> и причину — рядом всегда доступна кнопка сброса фильтров в один клик.' },
        { k: 'shot', src: '05-fsm-overview.png', alt: 'FSM-редактор в обзорном режиме с укрупнёнными карточками состояний по подсистемам', cap: '<b>Обзорный режим</b> группирует состояния по подсистемам и точкам входа — удобен для навигации по большим проектам.' }
      ],
      zh: [
        { k: 'lede', t: '状态机是设备的导航地图：一个状态对应一个 LCD 屏幕，一次转换对应对按键、定时器或条件的响应。' },
        { k: 'shot', src: '02-demo-loaded-fsm.png', alt: '演示项目的 FSM 状态图，包含五个相互关联的状态', cap: '<b>只读模式下的 FSM 图。</b>左侧为状态目录，中间为转换图，右侧为所选元素的检查器。无论是否处于编辑模式，连接线始终可见。' },
        { k: 'sub', t: '编辑模式' },
        { k: 'p', t: '状态图默认以<i>只读</i>方式打开——这是为防止误改运行中逻辑而做出的有意设计。会修改图结构的控件（添加状态、删除、拖动）只有在显式开启 <span class="chip">Edit graph</span> 后才可用。' },
        { k: 'shot', src: '04-fsm-edit-mode.png', alt: '开启编辑模式的 FSM 编辑器，画布边框显示为蓝色', cap: '<b>编辑模式已开启</b>——画布边框变为蓝色，此时可以创建状态并拖动节点。' },
        { k: 'sub', t: '创建状态与转换' },
        { k: 'steps', items: [
          '开启 <span class="chip">Edit graph</span>，然后点击状态列表上方的 <b>+</b>，或在画布空白处右键 → <b>Add state</b>。',
          '为状态命名，并按需要将其标记为 <b>Initial</b>（入口状态）或 <b>Terminal</b>（终止状态）。',
          '要创建转换，可以在节点的连接点之间拖拽，也可以使用右侧检查器中的 <b>Transition routes</b> 区域——直接选择目标状态和事件，无需在画布上操作。',
          '通过 <b>Linked LCD screen → Edit layout</b> 将状态关联到 LCD 屏幕，可直接跳转到其像素设计界面。'
        ] },
        { k: 'sub', t: '概览与过滤' },
        { k: 'p', t: '当状态图较大时，开启 <span class="chip">Overview</span>——它只显示每个子系统的一个入口，而非完整图。当 Overview、子系统聚焦或图层过滤隐藏了部分转换时，工具栏会显示<b>“已显示 / 总数”</b>计数器及具体原因，旁边始终提供一键重置过滤的按钮。' },
        { k: 'shot', src: '05-fsm-overview.png', alt: '概览模式下的 FSM 编辑器，按子系统分组显示放大的状态卡片', cap: '<b>概览模式</b>按子系统和入口对状态分组——便于在大型项目中导航。' }
      ]
    }
  },
  {
    id: 'lcd',
    title: { en: 'LCD Screen Editor', ru: 'Редактор LCD-экранов', zh: 'LCD 屏幕编辑器' },
    blocks: {
      en: [
        { k: 'lede', t: 'Every screen is a pixel-accurate monochrome framebuffer of a fixed size (typically 128×64), edited as a canvas of typed objects: text, lines, rectangles, bitmap images, special elements.' },
        { k: 'shot', src: '06-lcd-editor.png', alt: 'LCD editor with canvas tools on the left, a centered display preview and screen properties on the right', cap: '<b>LCD editor.</b> Left: canvas tools and object types. Center: an exact 128×64 preview. Right: linking the screen to FSM states and layers.' },
        { k: 'points', items: [
          '<b>Select / Add text / Line / Rectangle / Invert row / Special element / Glyph editor</b> — the core drawing tools; every object stays editable (never rasterized) until export.',
          '<b>Pixel editor</b> becomes available for a selected bitmap object — point-precise pixel editing.',
          'Each screen can be linked to several FSM states at once and to a layer (such as “Demo” or a custom one) through the <b>Linked FSM states</b> panel on the right.'
        ] }
      ],
      ru: [
        { k: 'lede', t: 'Каждый экран — это точный по пикселям монохромный framebuffer заданного размера (обычно 128×64), редактируемый как холст с типизированными объектами: текст, линии, прямоугольники, битовые изображения, спецэлементы.' },
        { k: 'shot', src: '06-lcd-editor.png', alt: 'LCD-редактор с инструментами холста слева, превью дисплея по центру и свойствами экрана справа', cap: '<b>LCD-редактор.</b> Слева — инструменты холста и типы объектов, по центру — точное превью 128×64, справа — привязка экрана к состояниям FSM и слоям.' },
        { k: 'points', items: [
          '<b>Select / Add text / Line / Rectangle / Invert row / Special element / Glyph editor</b> — основной набор инструментов рисования; каждый объект остаётся редактируемым (не растеризуется) до экспорта.',
          '<b>Pixel editor</b> становится доступен для выбранного bitmap-объекта — точечное редактирование конкретных пикселей.',
          'Каждый экран можно привязать сразу к нескольким состояниям FSM и слою (например, «Демо» или пользовательский слой) через панель <b>Linked FSM states</b> справа.'
        ] }
      ],
      zh: [
        { k: 'lede', t: '每个屏幕都是固定尺寸（通常为 128×64）的像素级精确单色帧缓冲，以带类型对象的画布形式编辑：文本、直线、矩形、位图、特殊元素。' },
        { k: 'shot', src: '06-lcd-editor.png', alt: 'LCD 编辑器，左侧为画布工具，中间为屏幕预览，右侧为屏幕属性', cap: '<b>LCD 编辑器。</b>左侧为画布工具和对象类型，中间是精确的 128×64 预览，右侧用于将屏幕关联到 FSM 状态与图层。' },
        { k: 'points', items: [
          '<b>Select / Add text / Line / Rectangle / Invert row / Special element / Glyph editor</b>——核心绘图工具；在导出之前，每个对象都保持可编辑状态（不会被栅格化）。',
          '选中某个位图对象后即可使用 <b>Pixel editor</b>——逐像素精确编辑。',
          '通过右侧的 <b>Linked FSM states</b> 面板，每个屏幕都可以同时关联到多个 FSM 状态和某个图层（例如“Demo”或自定义图层）。'
        ] }
      ]
    }
  },
  {
    id: 'raster',
    title: { en: 'Raster Import', ru: 'Импорт растра', zh: '位图导入' },
    blocks: {
      en: [
        { k: 'p', t: 'Turn finished artwork (a logo, an icon, a scan) into a 1bpp image and keep editing it pixel-by-pixel as a regular bitmap layer.' },
        { k: 'shot', src: '18-pixel-importer.png', alt: 'Image import panel with a binarization threshold slider', cap: '<b>Image import.</b> The <span class="chip">Import image</span> tab in the LCD editor: PNG/JPEG/BMP/SVG → threshold + dithering → 1bpp.' },
        { k: 'steps', items: [
          'Open the screen you want the image placed on, then switch to the <b>Import image</b> tab.',
          'Choose a file and adjust <b>Threshold</b> and <b>Dithering</b> until the 128×64 preview reads clearly.',
          'Click <b>Insert and edit bitmap</b> — the image is inserted on the screen, selected, and the pixel editor opens for fine-tuning right away.'
        ] }
      ],
      ru: [
        { k: 'p', t: 'Готовую графику (логотип, иконку, скан) можно превратить в 1bpp-изображение и продолжить редактировать её попиксельно как обычный bitmap-слой.' },
        { k: 'shot', src: '18-pixel-importer.png', alt: 'Панель импорта изображений с ползунком порога бинаризации', cap: '<b>Импорт изображения.</b> Вкладка <span class="chip">Import image</span> в LCD-редакторе: PNG/JPEG/BMP/SVG → порог + дизеринг → 1bpp.' },
        { k: 'steps', items: [
          'Откройте экран, на который нужно поместить изображение, и перейдите на вкладку <b>Import image</b>.',
          'Выберите файл, настройте <b>Threshold</b> (порог бинаризации) и <b>Dithering</b>, пока превью 128×64 не станет читаемым.',
          'Нажмите <b>Insert and edit bitmap</b> — изображение сразу вставится на экран, выделится и откроется в пиксельном редакторе для точечной доработки.'
        ] }
      ],
      zh: [
        { k: 'p', t: '可以把成品图像（徽标、图标、扫描件）转换为 1bpp 图像，并继续作为普通位图层逐像素编辑。' },
        { k: 'shot', src: '18-pixel-importer.png', alt: '带二值化阈值滑块的图像导入面板', cap: '<b>图像导入。</b>LCD 编辑器中的 <span class="chip">Import image</span> 标签页：PNG/JPEG/BMP/SVG → 阈值 + 抖动 → 1bpp。' },
        { k: 'steps', items: [
          '打开要放置图像的屏幕，切换到 <b>Import image</b> 标签页。',
          '选择文件，调整 <b>Threshold</b>（阈值）和 <b>Dithering</b>（抖动），直到 128×64 预览清晰可辨。',
          '点击 <b>Insert and edit bitmap</b>——图像会立即插入屏幕并被选中，同时打开像素编辑器供进一步精修。'
        ] }
      ]
    }
  },
  {
    id: 'animation',
    title: { en: 'Animations', ru: 'Анимации', zh: '动画' },
    blocks: {
      en: [
        { k: 'lede', t: 'An animation resource is an ordered set of 1bpp frames, each with its own duration and a shared loop flag. One resource can be bound either to an entire screen or to a single bitmap layer, leaving the rest of the screen static.' },
        { k: 'shot', src: '08-lcd-animations-panel.png', alt: 'Animations tab in the LCD editor with the new-animation button', cap: '<b>Animations panel.</b> The <span class="chip">Animations</span> tab sits next to <span class="chip">Import image</span> — the same conversion pipeline creates animation frames.' },
        { k: 'steps', items: [
          'Click <b>New animation</b> and pick an image for the first frame — sized to the selected bitmap object, or to the screen if nothing is selected.',
          'Add more frames from other images, tune each frame’s duration in milliseconds, and duplicate, remove or reorder them.',
          'Turn on <b>Loop</b> for a repeating animation (a busy indicator, say) or leave it off for a one-shot sequence.',
          'Preview the result with play / replay / the scrubber on a deterministic clock, then bind the resource with <b>Bind to screen</b> (whole screen) or <b>Bind to selected layer</b> (only the selected bitmap object).'
        ] },
        { k: 'callout', warn: true, t: 'For changing numeric values (a countdown timer, say) use a text field bound to a runtime tag rather than an animation: animation is meant for graphics, not for hundreds of near-identical numeral frames.' },
        { k: 'p', t: 'On firmware export, every resource becomes a <code>lcd_animation_frame_t</code> frame array (bytes, byte count, duration) wrapped in an <code>lcd_animation_t</code> (frame table, frame count, <code>loop</code> flag) — screen and layer binding metadata is exported alongside it.' }
      ],
      ru: [
        { k: 'lede', t: 'Ресурс анимации — это упорядоченный набор 1bpp-кадров с длительностью каждого кадра и флагом зацикливания. Один ресурс можно привязать целиком к экрану или только к одному bitmap-слою, оставив остальной экран статичным.' },
        { k: 'shot', src: '08-lcd-animations-panel.png', alt: 'Вкладка Animations в LCD-редакторе с кнопкой создания новой анимации', cap: '<b>Панель анимаций.</b> Вкладка <span class="chip">Animations</span> рядом с <span class="chip">Import image</span> — тот же конвейер конвертации создаёт кадры анимации.' },
        { k: 'steps', items: [
          'Нажмите <b>New animation</b> и выберите изображение для первого кадра — по размеру выбранного bitmap-объекта, либо по размеру экрана, если объект не выбран.',
          'Добавляйте следующие кадры из других изображений, настраивайте длительность каждого в миллисекундах, дублируйте, удаляйте и переупорядочивайте их.',
          'Включите <b>Loop</b> для повторяющейся анимации (например, индикатор ожидания) или оставьте выключенным для одноразовой последовательности.',
          'Просмотрите результат через play / replay / ползунок на детерминированных часах, затем привяжите ресурс кнопкой <b>Bind to screen</b> (весь экран) или <b>Bind to selected layer</b> (только выбранный bitmap-объект).'
        ] },
        { k: 'callout', warn: true, t: 'Для меняющихся числовых значений (например, обратный отсчёт таймера) используйте текстовое поле с runtime-тегом, а не анимацию: анимация предназначена для графики, а не для сотен почти одинаковых кадров с цифрами.' },
        { k: 'p', t: 'При экспорте прошивки каждый ресурс превращается в массив кадров <code>lcd_animation_frame_t</code> (байты, их количество, длительность) и обёртку <code>lcd_animation_t</code> (таблица кадров, их число, флаг <code>loop</code>) — метаданные привязки к экранам и слоям экспортируются вместе с ними.' }
      ],
      zh: [
        { k: 'lede', t: '动画资源是一组有序的 1bpp 帧，每帧都有自己的持续时间，并共享一个循环标志。一个资源既可以绑定到整个屏幕，也可以只绑定到单个位图层，屏幕其余部分保持静态。' },
        { k: 'shot', src: '08-lcd-animations-panel.png', alt: 'LCD 编辑器中的 Animations 标签页，带有新建动画按钮', cap: '<b>动画面板。</b><span class="chip">Animations</span> 标签页与 <span class="chip">Import image</span> 相邻——使用同一套转换流程生成动画帧。' },
        { k: 'steps', items: [
          '点击 <b>New animation</b>，为第一帧选择一张图像——尺寸取自所选位图对象，若未选中对象则取自屏幕尺寸。',
          '从其他图像添加更多帧，调整每帧的持续时间（毫秒），并可复制、删除或重新排序。',
          '为循环动画（例如等待指示器）开启 <b>Loop</b>，或将其保持关闭以生成单次播放序列。',
          '使用播放 / 重播 / 进度条在确定性时钟下预览效果，然后通过 <b>Bind to screen</b>（整屏）或 <b>Bind to selected layer</b>（仅所选位图对象）绑定该资源。'
        ] },
        { k: 'callout', warn: true, t: '对于不断变化的数值（例如倒计时），请使用绑定 runtime 标签的文本字段，而不是动画：动画用于图形，不应该用几百张几乎相同的数字帧来实现。' },
        { k: 'p', t: '导出固件时，每个资源都会生成一个 <code>lcd_animation_frame_t</code> 帧数组（字节数据、字节数、持续时间），并包装为 <code>lcd_animation_t</code>（帧表、帧数、<code>loop</code> 标志）——屏幕与图层的绑定元数据会随之一并导出。' }
      ]
    }
  },
  {
    id: 'panel',
    title: { en: 'Control Panel', ru: 'Панель управления', zh: '控制面板' },
    blocks: {
      en: [
        { k: 'p', t: 'The physical layout of buttons and indicators is designed separately from the logic and linked to FSM events.' },
        { k: 'shot', src: '09-control-panel.png', alt: 'Control panel editor with a positioned LCD screen and four physical buttons', cap: '<b>Control panel editor.</b> The <span class="chip">LCD</span>, <span class="chip">Button</span>, <span class="chip">Label</span>, <span class="chip">Rectangle</span>, <span class="chip">Image</span> tools let you assemble an exact enclosure layout; every button is linked to an FSM event.' },
        { k: 'points', items: [
          '<b>Group / Ungroup</b> and the alignment tools help lay out many elements neatly.',
          '<b>Grid</b> and <b>Snap</b> give precise positioning against the enclosure’s pixel grid.',
          'The <b>Panel validation</b> panel at the bottom right immediately flags any button with no linked event.'
        ] }
      ],
      ru: [
        { k: 'p', t: 'Физическая раскладка кнопок и индикаторов проектируется отдельно от логики и связывается с событиями FSM.' },
        { k: 'shot', src: '09-control-panel.png', alt: 'Редактор панели управления с расположенным LCD-экраном и четырьмя физическими кнопками', cap: '<b>Редактор панели управления.</b> Инструменты <span class="chip">LCD</span>, <span class="chip">Button</span>, <span class="chip">Label</span>, <span class="chip">Rectangle</span>, <span class="chip">Image</span> позволяют собрать точную раскладку корпуса прибора; каждая кнопка привязывается к событию FSM.' },
        { k: 'points', items: [
          '<b>Group / Ungroup</b> и инструменты выравнивания — для аккуратной раскладки множества элементов.',
          '<b>Grid</b> и <b>Snap</b> обеспечивают точное позиционирование по сетке в пикселях корпуса.',
          'Панель <b>Panel validation</b> справа снизу сразу показывает, есть ли кнопки без привязанного события.'
        ] }
      ],
      zh: [
        { k: 'p', t: '按钮和指示灯的物理布局与逻辑设计相互独立，并与 FSM 事件绑定。' },
        { k: 'shot', src: '09-control-panel.png', alt: '控制面板编辑器，左侧放置 LCD 屏幕，右侧为四个物理按钮', cap: '<b>控制面板编辑器。</b><span class="chip">LCD</span>、<span class="chip">Button</span>、<span class="chip">Label</span>、<span class="chip">Rectangle</span>、<span class="chip">Image</span> 等工具可用于搭建精确的外壳布局；每个按钮都绑定到一个 FSM 事件。' },
        { k: 'points', items: [
          '<b>Group / Ungroup</b> 及对齐工具便于整齐排布大量元素。',
          '<b>Grid</b> 与 <b>Snap</b> 可按外壳的像素网格进行精确定位。',
          '右下角的 <b>Panel validation</b> 面板会立即提示尚未绑定事件的按钮。'
        ] }
      ]
    }
  },
  {
    id: 'hmi',
    title: { en: 'HMI Designer', ru: 'HMI Designer', zh: 'HMI 设计器' },
    blocks: {
      en: [
        { k: 'p', t: 'Combines the screen and the physical panel into one scene to check the whole interaction scenario at once: which button does what on which screen, and which tags and procedures are involved.' },
        { k: 'shot', src: '10-hmi-designer.png', alt: 'HMI Designer with the instrument panel on the left and the scenario, tags and procedures on the right', cap: '<b>HMI Designer.</b> Modes <span class="chip">Design</span> / <span class="chip">Simulate</span> / <span class="chip">Runtime</span> / <span class="chip">Coverage</span>; the right column traces which state, screen, button, tag, procedure and alarm are involved in the current scenario.' },
        { k: 'p', t: '<b>Coverage</b> mode helps find states or panel elements never used in any scenario — useful before handing the project off to firmware.' }
      ],
      ru: [
        { k: 'p', t: 'Объединяет экран и физическую панель в одну сцену для проверки сценария взаимодействия целиком: какая кнопка что делает на каком экране, какие теги и процедуры задействованы.' },
        { k: 'shot', src: '10-hmi-designer.png', alt: 'HMI Designer с приборной панелью слева и сценарием, тегами и процедурами справа', cap: '<b>HMI Designer.</b> Режимы <span class="chip">Design</span> / <span class="chip">Simulate</span> / <span class="chip">Runtime</span> / <span class="chip">Coverage</span>; правая колонка трассирует, какое состояние, экран, кнопка, тег, процедура и авария задействованы в текущем сценарии.' },
        { k: 'p', t: 'Режим <b>Coverage</b> помогает найти состояния или элементы панели, ни разу не задействованные ни в одном сценарии — полезно перед передачей прошивке.' }
      ],
      zh: [
        { k: 'p', t: '将屏幕与物理面板整合到同一个场景中，从而一次性检查整个交互场景：哪个按钮在哪个屏幕上做什么，涉及哪些标签和流程。' },
        { k: 'shot', src: '10-hmi-designer.png', alt: 'HMI 设计器，左侧为仪表面板，右侧为场景、标签与流程', cap: '<b>HMI Designer。</b>提供 <span class="chip">Design</span> / <span class="chip">Simulate</span> / <span class="chip">Runtime</span> / <span class="chip">Coverage</span> 模式；右侧栏会追踪当前场景涉及的状态、屏幕、按钮、标签、流程与报警。' },
        { k: 'p', t: '<b>Coverage</b> 模式有助于找出从未在任何场景中使用过的状态或面板元素——在交付固件团队之前非常有用。' }
      ]
    }
  },
  {
    id: 'hardware',
    title: { en: 'Tags, Procedures, Alarms', ru: 'Теги, процедуры, аварии', zh: '标签、流程与报警' },
    blocks: {
      en: [
        { k: 'p', t: 'Three linked registries describe what physically happens on the device without being drawn on a screen directly.' },
        { k: 'table', head: ['Section', 'Purpose', 'Where'], rows: [
          ['<b>Tag registry</b>', 'Typed firmware data (float / int / bool / string) exchanged between screens and procedures', 'Hardware → Tag registry'],
          ['<b>Procedures</b>', 'Named backend processes (calibration, say), documented with engineering notes', 'Hardware → Procedures'],
          ['<b>Alarms</b>', 'Named abnormal-condition events, checkable from any FSM transition regardless of the current screen', 'Logic → Alarms']
        ] },
        { k: 'shot', src: '13-alarms.png', alt: 'Empty alarms section with a built-in three-step hint: tag, alarm, transition', cap: '<b>Creating an alarm.</b> The built-in hint spells out the exact sequence: a tag in the registry → an alarm with condition <code>@tag_id</code> → a reference to it in an FSM transition guard.' },
        { k: 'shot', src: '11-tags.png', alt: 'Empty tag registry showing the available data types float, int, bool, string', cap: '<b>Tag registry.</b> The right column lists the supported data types for new tags.' }
      ],
      ru: [
        { k: 'p', t: 'Три связанных реестра описывают то, что физически происходит на приборе, но не рисуется на экране напрямую.' },
        { k: 'table', head: ['Раздел', 'Назначение', 'Где'], rows: [
          ['<b>Tag registry</b>', 'Типизированные данные прошивки (float / int / bool / string), которыми обмениваются экраны и процедуры', 'Hardware → Tag registry'],
          ['<b>Procedures</b>', 'Именованные backend-процессы (например, калибровка), документируемые инженерными заметками', 'Hardware → Procedures'],
          ['<b>Alarms</b>', 'Именованные события аварийного состояния, проверяемые из любого перехода FSM независимо от текущего экрана', 'Logic → Alarms']
        ] },
        { k: 'shot', src: '13-alarms.png', alt: 'Пустой раздел аварий со встроенной подсказкой из трёх шагов: тег, авария, переход', cap: '<b>Создание аварии.</b> Встроенная подсказка описывает точную последовательность: тег в реестре → авария с условием <code>@tag_id</code> → ссылка на неё в guard-условии перехода FSM.' },
        { k: 'shot', src: '11-tags.png', alt: 'Пустой реестр тегов с доступными типами данных float, int, bool, string', cap: '<b>Реестр тегов.</b> Правая колонка показывает поддерживаемые типы данных для новых тегов.' }
      ],
      zh: [
        { k: 'p', t: '三个相互关联的注册表描述了设备上实际发生但不直接绘制在屏幕上的内容。' },
        { k: 'table', head: ['区域', '用途', '位置'], rows: [
          ['<b>Tag registry</b>', '屏幕与流程之间交换的类型化固件数据（float / int / bool / string）', 'Hardware → Tag registry'],
          ['<b>Procedures</b>', '带工程说明文档的命名后端流程（例如校准）', 'Hardware → Procedures'],
          ['<b>Alarms</b>', '命名的异常状态事件，可在任意 FSM 转换中检查，与当前屏幕无关', 'Logic → Alarms']
        ] },
        { k: 'shot', src: '13-alarms.png', alt: '空的报警区域，内置三步提示：标签、报警、转换', cap: '<b>创建报警。</b>内置提示给出了确切步骤：在注册表中创建标签 → 创建条件为 <code>@tag_id</code> 的报警 → 在 FSM 转换的 guard 条件中引用它。' },
        { k: 'shot', src: '11-tags.png', alt: '空的标签注册表，显示可用数据类型 float、int、bool、string', cap: '<b>标签注册表。</b>右侧列出新建标签可用的数据类型。' }
      ]
    }
  },
  {
    id: 'runtime',
    title: { en: 'Runtime Preview', ru: 'Runtime-предпросмотр', zh: '运行时预览' },
    blocks: {
      en: [
        { k: 'lede', t: 'Run the FSM logic without firmware: press virtual buttons, watch a live render of the LCD screen and the event log — before handing the project to the embedded team.' },
        { k: 'shot', src: '14-runtime.png', alt: 'Runtime preview with the current state on the left, a live LCD screen in the center and the event log on the right', cap: '<b>Runtime preview.</b> Left: the current state and the buttons available from it (unavailable ones are dimmed with a reason). Center: an exact screen render. Right: the event, tag and procedure log.' },
        { k: 'points', items: [
          '<span class="chip">Step mode</span> advances one event at a time — useful for tracing complex logic.',
          '<span class="chip">Express timer</span> speeds up simulated timers without changing transition logic.',
          '<span class="chip">Bypass procedures</span> lets you skip external backend procedures while running the scenario end to end.',
          'The <b>Validation</b> panel on the left shows the same warnings the project validator does — an unreachable state, for instance.'
        ] }
      ],
      ru: [
        { k: 'lede', t: 'Прогон логики FSM без прошивки: нажимайте виртуальные кнопки, смотрите на живой рендер LCD-экрана и журнал событий — прежде чем передавать проект встраиваемой команде.' },
        { k: 'shot', src: '14-runtime.png', alt: 'Runtime-предпросмотр с текущим состоянием слева, живым LCD-экраном по центру и журналом событий справа', cap: '<b>Runtime-предпросмотр.</b> Слева — текущее состояние и доступные из него кнопки (недоступные подсвечены с указанием причины), по центру — точный рендер экрана, справа — журнал событий, тегов и процедур.' },
        { k: 'points', items: [
          '<span class="chip">Step mode</span> выполняет переходы по одному событию за раз — удобно для разбора сложной логики.',
          '<span class="chip">Express timer</span> ускоряет симулированные таймеры, не меняя логику переходов.',
          '<span class="chip">Bypass procedures</span> позволяет пропустить внешние backend-процедуры при прогоне сценария целиком.',
          'Панель <b>Validation</b> слева выводит те же предупреждения, что видит валидатор проекта — например, недостижимые состояния.'
        ] }
      ],
      zh: [
        { k: 'lede', t: '在没有固件的情况下运行 FSM 逻辑：按下虚拟按钮，实时查看 LCD 屏幕渲染和事件日志——然后再将项目交付给嵌入式团队。' },
        { k: 'shot', src: '14-runtime.png', alt: '运行时预览，左侧为当前状态，中间为实时 LCD 屏幕，右侧为事件日志', cap: '<b>运行时预览。</b>左侧显示当前状态及其可用按钮（不可用按钮会变暗并标注原因），中间是精确的屏幕渲染，右侧是事件、标签与流程日志。' },
        { k: 'points', items: [
          '<span class="chip">Step mode</span> 每次只执行一个事件——便于追踪复杂逻辑。',
          '<span class="chip">Express timer</span> 加速模拟定时器，但不改变转换逻辑。',
          '<span class="chip">Bypass procedures</span> 可在完整运行场景时跳过外部后端流程。',
          '左侧的 <b>Validation</b> 面板显示与项目校验器相同的警告——例如无法到达的状态。'
        ] }
      ]
    }
  },
  {
    id: 'handoff',
    title: { en: 'Firmware Handoff', ru: 'Передача прошивке', zh: '固件交付' },
    blocks: {
      en: [
        { k: 'p', t: 'The final step before release: assembling a package for the embedded team — validation, a supplier package, a device-connection check.' },
        { k: 'shot', src: '15-handoff.png', alt: 'HMI Handoff screen showing validation results: 0 errors, 0 uncovered states, 3 warnings', cap: '<b>HMI Handoff → Validate.</b> The summary combines the overall project validation with coverage checks for screens, button routes and interface-language translations.' },
        { k: 'callout', warn: true, t: '<b>Important:</b> this package is an HMI/FSM specification, not a firmware binary. It hands the supplier screens, bindings, state transitions, text resources and display bytes with traceability. C/C++ sources, MCU and toolchain details, drivers and protocols, and the device update procedure remain the embedded team’s responsibility.' }
      ],
      ru: [
        { k: 'p', t: 'Финальный шаг перед выпуском — сборка пакета для встраиваемой команды: валидация, пакет для поставщика, проверка соединения с устройством.' },
        { k: 'shot', src: '15-handoff.png', alt: 'Экран HMI Handoff с результатами валидации: 0 ошибок, 0 непокрытых состояний, 3 предупреждения', cap: '<b>HMI Handoff → Validate.</b> Сводка объединяет общую валидацию проекта с проверкой покрытия экранов, маршрутов кнопок и переводов на все языки интерфейса.' },
        { k: 'callout', warn: true, t: '<b>Важно:</b> этот пакет — спецификация HMI/FSM, а не бинарник прошивки. Он передаёт поставщику экраны, привязки, переходы состояний, текстовые ресурсы и байты дисплея с трассируемостью. Исходники C/C++, детали MCU и тулчейна, драйверы и протоколы, процедура обновления устройства — по-прежнему задача встраиваемой команды.' }
      ],
      zh: [
        { k: 'p', t: '发布前的最后一步：为嵌入式团队组装交付包——校验、供应商包、设备连接检查。' },
        { k: 'shot', src: '15-handoff.png', alt: 'HMI Handoff 界面显示校验结果：0 个错误、0 个未覆盖状态、3 个警告', cap: '<b>HMI Handoff → Validate。</b>汇总结果将项目整体校验与屏幕覆盖率、按钮路由及界面语言翻译的检查结合在一起。' },
        { k: 'callout', warn: true, t: '<b>注意：</b>该交付包是 HMI/FSM 规格说明，并非固件二进制文件。它向供应商提供屏幕、绑定关系、状态转换、文本资源和可追溯的显示字节数据。C/C++ 源代码、MCU 与工具链细节、驱动与协议，以及设备更新流程，仍然是嵌入式团队的职责。' }
      ]
    }
  },
  {
    id: 'mcp',
    title: { en: 'API and MCP Servers', ru: 'API и MCP-серверы', zh: 'API 与 MCP 服务器' },
    blocks: {
      en: [
        { k: 'lede', t: 'The Electron and Tauri builds run the identical local automation contract: REST on <code class="mono">127.0.0.1:8766</code> and MCP (JSON-RPC over HTTP) on <code class="mono">127.0.0.1:8767/mcp</code> — letting external scripts, SCADA systems and LLM agents read and edit the open project directly.' },
        { k: 'shot', src: '17-settings-api-mcp.png', alt: 'API and MCP servers settings section describing the capability', cap: '<b>Settings → API &amp; MCP servers.</b> Desktop builds show live status for both servers, their addresses and whether token verification is enabled; unavailable in the web build.' },
        { k: 'points', items: [
          'Both servers bind only to <code>127.0.0.1</code> and never listen on an external interface.',
          '<code class="mono">GET /health</code> on the MCP port is an availability check with no token and no project access.',
          'The <code class="mono">LCD_IDE_AUTOMATION_TOKEN</code> environment variable turns on mandatory Bearer authorization for write operations.',
          'The full tool list, schemas and integration examples live in <a href="https://github.com/myahlovvlad/LCD-bitmap-IDE/blob/main/docs/API_MCP_CONNECTORS.md">docs/API_MCP_CONNECTORS.md</a>.'
        ] }
      ],
      ru: [
        { k: 'lede', t: 'Electron- и Tauri-сборки запускают одинаковый локальный контракт автоматизации: REST на <code class="mono">127.0.0.1:8766</code> и MCP (JSON-RPC/HTTP) на <code class="mono">127.0.0.1:8767/mcp</code> — это позволяет внешним скриптам, SCADA-системам и LLM-агентам читать и редактировать открытый проект напрямую.' },
        { k: 'shot', src: '17-settings-api-mcp.png', alt: 'Раздел настроек API и MCP серверов с описанием возможностей', cap: '<b>Settings → API &amp; MCP servers.</b> В десктопных сборках здесь отображается живой статус обоих серверов, их адреса и включена ли проверка токена; недоступно в веб-сборке.' },
        { k: 'points', items: [
          'Оба сервера привязаны только к <code>127.0.0.1</code> и никогда не слушают внешний интерфейс.',
          '<code class="mono">GET /health</code> на MCP-порту — проверка доступности без токена и без доступа к проекту.',
          'Переменная окружения <code class="mono">LCD_IDE_AUTOMATION_TOKEN</code> включает обязательную Bearer-авторизацию для операций записи.',
          'Полный список инструментов, схемы и примеры интеграции — в <a href="https://github.com/myahlovvlad/LCD-bitmap-IDE/blob/main/docs/API_MCP_CONNECTORS.md">docs/API_MCP_CONNECTORS.md</a>.'
        ] }
      ],
      zh: [
        { k: 'lede', t: 'Electron 和 Tauri 构建运行完全相同的本地自动化协议：REST 位于 <code class="mono">127.0.0.1:8766</code>，MCP（基于 HTTP 的 JSON-RPC）位于 <code class="mono">127.0.0.1:8767/mcp</code>——外部脚本、SCADA 系统和 LLM 代理可借此直接读取和编辑已打开的项目。' },
        { k: 'shot', src: '17-settings-api-mcp.png', alt: '描述该功能的 API 与 MCP 服务器设置区域', cap: '<b>Settings → API &amp; MCP servers。</b>桌面构建会在此显示两个服务器的实时状态、地址以及是否启用了令牌校验；网页版不可用。' },
        { k: 'points', items: [
          '两个服务器都仅绑定到 <code>127.0.0.1</code>，从不监听外部网络接口。',
          'MCP 端口上的 <code class="mono">GET /health</code> 是无需令牌、也不访问项目数据的可用性检查。',
          '环境变量 <code class="mono">LCD_IDE_AUTOMATION_TOKEN</code> 可为写操作开启强制的 Bearer 鉴权。',
          '完整的工具列表、协议结构与集成示例见 <a href="https://github.com/myahlovvlad/LCD-bitmap-IDE/blob/main/docs/API_MCP_CONNECTORS.md">docs/API_MCP_CONNECTORS.md</a>。'
        ] }
      ]
    }
  },
  {
    id: 'trouble',
    title: { en: 'Troubleshooting', ru: 'Диагностика', zh: '故障排查' },
    blocks: {
      en: [
        { k: 'table', head: ['Symptom', 'Cause', 'Fix'], rows: [
          ['“Add state” is disabled', 'The FSM graph is open read-only', 'Turn on <span class="chip">Edit graph</span> in the FSM toolbar'],
          ['Transitions disappeared from the canvas', 'Overview, a subsystem focus or a layer filter is active', 'Check the “shown / total” counter next to the filters and click <b>Reset filters</b>'],
          ['<code class="mono">connection refused</code> on 8766/8767', 'The desktop app is not running, or another process holds the port', 'Start the Electron/Tauri build and check its automation console'],
          ['The API returns <code class="mono">project: null</code>', 'No project is open', 'Open a <code>.lcdproj</code> file or the demo project in the app'],
          ['An MCP/REST request does not respond', 'The renderer did not answer within 5 seconds', 'Make sure the app window is open and not blocked by a modal dialog']
        ] }
      ],
      ru: [
        { k: 'table', head: ['Симптом', 'Причина', 'Решение'], rows: [
          ['Кнопка «Add state» неактивна', 'Граф FSM открыт в режиме только для чтения', 'Включите <span class="chip">Edit graph</span> в панели инструментов FSM'],
          ['Переходы исчезли на холсте', 'Активны Overview, фокус подсистемы или фильтр слоёв', 'Проверьте счётчик «показано / всего» рядом с фильтрами и нажмите <b>Reset filters</b>'],
          ['<code class="mono">connection refused</code> на 8766/8767', 'Десктопное приложение не запущено, либо порт занят другим процессом', 'Запустите Electron/Tauri сборку и проверьте её консоль автоматизации'],
          ['API возвращает <code class="mono">project: null</code>', 'Ни один проект не открыт', 'Откройте <code>.lcdproj</code> или демо-проект в приложении'],
          ['Запрос к MCP/REST не отвечает', 'Renderer не ответил в течение 5 секунд', 'Убедитесь, что окно приложения открыто и не заблокировано модальным диалогом']
        ] }
      ],
      zh: [
        { k: 'table', head: ['现象', '原因', '解决方法'], rows: [
          ['“Add state” 按钮不可用', 'FSM 图当前处于只读模式', '在 FSM 工具栏中开启 <span class="chip">Edit graph</span>'],
          ['画布上的转换消失了', 'Overview、子系统聚焦或图层过滤处于激活状态', '查看过滤按钮旁的“已显示 / 总数”计数器，并点击 <b>Reset filters</b>'],
          ['8766/8767 端口出现 <code class="mono">connection refused</code>', '桌面应用未运行，或端口被其他进程占用', '启动 Electron/Tauri 构建并查看其自动化控制台'],
          ['API 返回 <code class="mono">project: null</code>', '当前没有打开任何项目', '在应用中打开一个 <code>.lcdproj</code> 文件或演示项目'],
          ['MCP/REST 请求无响应', '渲染进程未在 5 秒内响应', '确认应用窗口已打开且未被模态对话框阻塞']
        ] }
      ]
    }
  }
];

function esc(s) { return String(s); } // content is already trusted HTML fragments

function renderTOC(lang) {
  const items = CH.map((c) => `<li><a href="#${c.id}">${c.title[lang]}</a></li>`).join('\n');
  return `<nav class="toc" aria-label="${META[lang].tocLabel}"><h2>${META[lang].tocLabel}</h2><ol>${items}</ol></nav>`;
}

function renderBlock(b, lang) {
  switch (b.k) {
    case 'lede': return `<p class="lede">${b.t}</p>`;
    case 'p': return `<p>${b.t}</p>`;
    case 'sub': return `<h3 class="sub">${b.t}</h3>`;
    case 'points': return `<ul class="points">${b.items.map((i) => `<li><span>${i}</span></li>`).join('')}</ul>`;
    case 'steps': return `<ol class="steps">${b.items.map((i) => `<li><span>${i}</span></li>`).join('')}</ol>`;
    case 'callout': return `<div class="callout${b.warn ? ' warn' : ''}"><p>${b.t}</p></div>`;
    case 'table': return `<table><thead><tr>${b.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'shot': return `<figure class="shot"><img src="${assetsDirName}/${b.src}" alt="${b.alt}" /><figcaption>${b.cap}</figcaption></figure>`;
    default: return '';
  }
}

function renderChapter(ch, index, lang) {
  const num = String(index + 1).padStart(2, '0');
  const blocks = ch.blocks[lang].map((b) => renderBlock(b, lang)).join('\n');
  return `<section class="chapter" id="${ch.id}">
  <p class="chap-eyebrow">${lang === 'zh' ? `第 ${index + 1} 章` : lang === 'ru' ? `Глава ${index + 1}` : `Chapter ${index + 1}`}</p>
  <h2 class="chap-title">${ch.title[lang]}</h2>
  ${blocks}
</section>`;
}

function renderHtml(lang) {
  const m = META[lang];
  const badge = `<div class="badge-lcd" aria-hidden="true"><svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="62" height="38" rx="2" stroke="#c8e06a" stroke-width="2"/><rect x="9" y="9" width="4" height="4" fill="#c8e06a"/><rect x="17" y="9" width="4" height="4" fill="#c8e06a"/><rect x="25" y="9" width="4" height="4" fill="#c8e06a"/><rect x="9" y="17" width="4" height="4" fill="#c8e06a"/><rect x="25" y="17" width="4" height="4" fill="#c8e06a"/><rect x="9" y="25" width="4" height="4" fill="#c8e06a"/><rect x="17" y="25" width="4" height="4" fill="#c8e06a"/><rect x="25" y="25" width="4" height="4" fill="#c8e06a"/><circle cx="47" cy="20" r="9" stroke="#c8e06a" stroke-width="2"/><circle cx="47" cy="20" r="2.4" fill="#c8e06a"/><line x1="47" y1="11" x2="47" y2="14.6" stroke="#c8e06a" stroke-width="2"/><line x1="47" y1="25.4" x2="47" y2="29" stroke="#c8e06a" stroke-width="2"/><line x1="38" y1="20" x2="41.6" y2="20" stroke="#c8e06a" stroke-width="2"/><line x1="52.4" y1="20" x2="56" y2="20" stroke="#c8e06a" stroke-width="2"/></svg></div>`;
  const meta = m.meta.map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('');
  const chapters = CH.map((c, i) => renderChapter(c, i, lang)).join('\n');
  const langSwitch = LANGS.filter((l) => l !== lang)
    .map((l) => `<a href="operation-user-manual.${l}.html">${l.toUpperCase()}</a>`).join(' · ');

  return `<!doctype html>
<html lang="${m.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${m.docTitle}</title>
<style>
  :root {
    --paper: #f6f5ef; --panel: #eeece1; --line: #d9d7c8; --ink: #1c2118; --ink-soft: #565a4c;
    --phosphor: #4f6b1a; --phosphor-deep: #3c5313; --blueprint: #3a5a78; --code-bg: #e8e6d8;
    --shadow: 0 1px 2px rgba(28,33,24,0.06), 0 8px 24px rgba(28,33,24,0.06); --radius: 10px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: "Charter","Iowan Old Style","Palatino Linotype",Georgia,"Noto Serif","Noto Serif SC",serif; font-size: 16.5px; line-height: 1.62; -webkit-font-smoothing: antialiased; }
  .mono { font-family: "JetBrains Mono","Cascadia Code",ui-monospace,"SF Mono",Consolas,"Liberation Mono",monospace; }
  a { color: var(--blueprint); }
  h1, h2, h3 { font-weight: 700; color: var(--ink); }
  .masthead { border-bottom: 1px solid var(--line); padding: 48px 24px 34px; }
  .masthead-inner { max-width: 980px; margin: 0 auto; display: grid; grid-template-columns: auto 1fr; gap: 26px; align-items: center; }
  .badge-lcd { width: 88px; height: 88px; border-radius: 6px; background: var(--phosphor-deep); display: grid; place-items: center; box-shadow: var(--shadow); flex: 0 0 auto; }
  .badge-lcd svg { width: 60px; height: 36px; }
  .mast-label { font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--phosphor); margin: 0 0 8px; }
  .langbar { font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 11.5px; margin: 0 0 8px; color: var(--ink-soft); }
  .langbar a { color: var(--ink-soft); text-decoration: none; border-bottom: 1px dotted var(--ink-soft); }
  h1.title { margin: 0 0 8px; font-size: 38px; line-height: 1.08; letter-spacing: -0.01em; }
  .subtitle { margin: 0; max-width: 64ch; color: var(--ink-soft); font-size: 17px; }
  .mast-meta { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 6px 18px; font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 12px; color: var(--ink-soft); }
  .mast-meta b { color: var(--ink); font-weight: 600; }
  .shell { max-width: 980px; margin: 0 auto; padding: 36px 24px 90px; display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 44px; align-items: start; }
  nav.toc { border-right: 1px solid var(--line); padding-right: 18px; }
  nav.toc h2 { font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); margin: 0 0 12px; font-weight: 600; }
  nav.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; counter-reset: toc; }
  nav.toc a { counter-increment: toc; display: flex; gap: 8px; padding: 5px 4px; color: var(--ink-soft); text-decoration: none; font-size: 13px; line-height: 1.35; }
  nav.toc a::before { content: counter(toc, decimal-leading-zero); font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 10.5px; color: var(--phosphor); padding-top: 1px; }
  main { min-width: 0; }
  section.chapter { padding-top: 6px; margin-bottom: 54px; }
  .chap-eyebrow { font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--phosphor); margin: 0 0 6px; }
  h2.chap-title { font-size: 25px; margin: 0 0 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
  .chapter p, .lede { max-width: 68ch; }
  .lede { font-size: 17.5px; color: var(--ink-soft); }
  h3.sub { font-size: 16px; margin: 24px 0 8px; font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; }
  ol.steps, ul.points { margin: 10px 0 18px; padding-left: 0; max-width: 68ch; display: grid; gap: 9px; list-style: none; counter-reset: step; }
  ol.steps li { counter-increment: step; display: grid; grid-template-columns: 24px 1fr; gap: 9px; }
  ol.steps li::before { content: counter(step); font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 11px; font-weight: 700; color: var(--phosphor-deep); background: var(--panel); border: 1px solid var(--line); border-radius: 50%; width: 20px; height: 20px; display: grid; place-items: center; }
  ul.points li { display: grid; grid-template-columns: 13px 1fr; gap: 9px; }
  ul.points li::before { content: ""; width: 7px; height: 7px; margin-top: 7px; background: var(--phosphor); border-radius: 1px; }
  figure.shot { margin: 18px 0 22px; max-width: 100%; }
  figure.shot img { display: block; width: 100%; height: auto; border-radius: var(--radius); border: 1px solid var(--line); box-shadow: var(--shadow); }
  figure.shot figcaption { margin-top: 8px; font-size: 12.5px; color: var(--ink-soft); font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; line-height: 1.5; }
  .callout { max-width: 68ch; margin: 16px 0; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--phosphor); border-radius: 8px; font-size: 15px; }
  .callout.warn { border-left-color: var(--blueprint); }
  code, kbd { font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 0.86em; background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; max-width: 100%; font-size: 13.5px; }
  table th, table td { border: 1px solid var(--line); padding: 7px 9px; text-align: left; vertical-align: top; }
  table th { font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-soft); background: var(--panel); }
  .chip { display: inline-block; font-family: "JetBrains Mono",ui-monospace,Consolas,monospace; font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-soft); background: var(--panel); }
  .end { max-width: 68ch; padding-top: 20px; border-top: 1px solid var(--line); color: var(--ink-soft); font-size: 13.5px; }
  @page { size: A4; margin: 16mm 14mm; }
  @media print {
    .shell { grid-template-columns: 1fr; }
    nav.toc { display: none; }
    section.chapter { break-inside: avoid-page; page-break-inside: avoid; }
    figure.shot { break-inside: avoid-page; }
  }
</style>
</head>
<body>
<header class="masthead">
  <div class="masthead-inner">
    ${badge}
    <div>
      <p class="langbar">${langSwitch}</p>
      <p class="mast-label">${m.kicker}</p>
      <h1 class="title">${m.title}</h1>
      <p class="subtitle">${m.subtitle}</p>
      <div class="mast-meta">${meta}</div>
    </div>
  </div>
</header>
<div class="shell">
  ${renderTOC(lang)}
  <main>
    ${chapters}
    <p class="end">${m.footer}</p>
  </main>
</div>
</body>
</html>`;
}

async function generate() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of LANGS) {
      const base = `operation-user-manual.${lang}`;
      const htmlPath = resolve(outputDir, `${base}.html`);
      const pdfPath = resolve(outputDir, `${base}.pdf`);
      await writeFile(htmlPath, renderHtml(lang), 'utf8');

      const page = await browser.newPage();
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' } });
      await page.close();
      console.log(`Generated ${base}.html and ${base}.pdf`);
    }
  } finally {
    await browser.close();
  }
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
