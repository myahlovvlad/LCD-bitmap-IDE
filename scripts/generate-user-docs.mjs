import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDir = resolve('docs/user-manuals');

const languages = [
  { code: 'en', label: 'English', htmlLang: 'en' },
  { code: 'ru', label: 'Русский', htmlLang: 'ru' },
  { code: 'zh', label: '简体中文', htmlLang: 'zh-CN' }
];

const docs = [
  {
    id: 'operation-user-manual',
    titles: {
      en: 'LCD-bitmap IDE Operation User Manual',
      ru: 'Руководство пользователя LCD-bitmap IDE',
      zh: 'LCD-bitmap IDE 操作用户手册'
    },
    subtitles: {
      en: 'Beginner-friendly workflow for designing, checking and exporting embedded LCD measurement interfaces.',
      ru: 'Пошаговый workflow для новичков: проектирование, проверка и экспорт LCD-интерфейсов для измерительных сценариев.',
      zh: '面向新用户的流程：设计、检查并导出嵌入式 LCD 测量界面。'
    },
    chapters: {
      en: [
        {
          title: '1. What This Application Does',
          body: [
            'LCD-bitmap IDE is an offline desktop workbench for monochrome LCD screens, finite-state-machine navigation, control-panel bindings and firmware-ready exports.',
            'Use it to design the operator interface around a measurement workflow: setup, start, progress, result review, warnings and service states.',
            'The application does not perform physical measurements by itself. Real measurement acquisition requires your instrument firmware, backend service or hardware connector. In LCD-bitmap IDE you design and validate the user interface and its runtime behavior before integrating it with target firmware.'
          ],
          checklist: ['Create or open a project.', 'Design screens and FSM transitions.', 'Preview the workflow.', 'Export firmware assets.']
        },
        {
          title: '2. Install And Start',
          steps: [
            'Install Node.js 22 or newer and Git.',
            'Clone the repository and run npm ci.',
            'Start the browser build with npm run dev, or start the desktop build with npm run electron:dev.',
            'Use the desktop build when you need REST API, MCP automation, PDF export or local app packaging.'
          ],
          code: 'git clone https://github.com/myahlovvlad/LCD-bitmap-IDE.git\ncd LCD-bitmap-IDE\nnpm ci\nnpm run electron:dev'
        },
        {
          title: '3. Open The Demo Project',
          body: [
            'On the start screen, choose the bundled demo or open examples/universal-lcd-demo.lcdproj.',
            'The demo is intentionally generic. It shows how a measurement-oriented interface can be represented without vendor implementation files, private device identifiers or proprietary screen catalogs.'
          ],
          steps: ['Open the demo.', 'Visit FSM, LCD, Tags and Runtime workspaces.', 'Do not edit everything at once. Change one screen or transition, then preview it.']
        },
        {
          title: '4. Understand The Workspace',
          table: [
            ['Workspace', 'Purpose', 'Beginner result'],
            ['FSM', 'States and transitions', 'A clear operator flow'],
            ['LCD', 'Pixel-accurate 128x64 screens', 'Readable screen layouts'],
            ['Control panel', 'Button and event bindings', 'Predictable operator input'],
            ['Tags', 'Named values used by screens and procedures', 'Traceable measurement values'],
            ['Runtime', 'Interactive flow preview', 'A checked workflow before firmware export']
          ]
        },
        {
          title: '5. Build A Measurement Workflow',
          body: [
            'Start with the states an operator expects, not with pixels. A simple workflow usually has Idle, Setup, Ready, Running, Result, Error and Service states.',
            'Each state should answer one user question: what is happening, what value matters now, and what action is available.'
          ],
          steps: ['Add the workflow states in FSM.', 'Name each transition with an event such as START, NEXT, CANCEL or RETRY.', 'Keep error transitions explicit.', 'Run the workflow in Runtime Preview before editing detailed graphics.']
        },
        {
          title: '6. Design LCD Screens',
          body: [
            'Design for quick reading. Put the current state at the top, the key value in the center and the available action near the bottom.',
            'Use text, lines, rectangles, bitmap layers and special elements such as progress bars or indicators. Avoid filling the screen with decorative content.'
          ],
          checklist: ['Text is readable on 128x64.', 'Important values have units.', 'The active action is visible.', 'Warning screens are visually distinct.']
        },
        {
          title: '7. Bind Buttons, Tags And Procedures',
          body: [
            'Buttons should fire events that match FSM transitions. Tags should describe measurement values, configuration values or status flags. Procedures describe backend actions such as starting a reading, clearing a result or opening a service routine.',
            'Use stable names. A clear tag such as sample_absorbance is easier to maintain than value1.'
          ]
        },
        {
          title: '8. Preview The Workflow',
          steps: ['Open Runtime.', 'Start from the initial state.', 'Press each expected button in the same order as a real operator.', 'Check that every measurement status screen appears in the right order.', 'Test error and cancel paths, not only the successful path.']
        },
        {
          title: '9. Export For Firmware',
          body: [
            'After the workflow is stable, export screens as C headers, binary frame buffers, XBM, Arduino PROGMEM, Rust embedded-graphics or ESP-IDF assets.',
            'Confirm that your target display uses the same resolution, page order, bit order and monochrome format before flashing hardware.'
          ]
        },
        {
          title: '10. Save, Version And Share',
          checklist: ['Save the .lcdproj file after meaningful changes.', 'Commit project files and exported assets separately.', 'Include screenshots in reviews.', 'Keep generated firmware artifacts traceable to a project version.']
        },
        {
          title: '11. Troubleshooting',
          table: [
            ['Symptom', 'Likely cause', 'Action'],
            ['Runtime button does nothing', 'No transition for that event', 'Check FSM transition event names'],
            ['Export looks inverted', 'Target display bit order differs', 'Verify driver byte order'],
            ['Text is clipped', 'Text object or font is too large', 'Use shorter copy or reposition the text'],
            ['API connection refused', 'Desktop app is not running', 'Start npm run electron:dev or packaged app']
          ]
        }
      ],
      ru: [
        {
          title: '1. Что делает приложение',
          body: [
            'LCD-bitmap IDE - offline desktop-инструмент для проектирования монохромных LCD-экранов, FSM-навигации, привязок панели управления и firmware-ready экспортов.',
            'Используйте его для проектирования интерфейса вокруг измерительного workflow: настройка, старт, ход выполнения, просмотр результата, предупреждения и сервисные состояния.',
            'Само приложение не выполняет физические измерения. Для реального снятия данных нужен firmware прибора, backend-сервис или hardware connector. В LCD-bitmap IDE вы проектируете и проверяете интерфейс и runtime-поведение до интеграции с целевой прошивкой.'
          ],
          checklist: ['Создать или открыть проект.', 'Спроектировать экраны и FSM-переходы.', 'Проверить workflow в preview.', 'Экспортировать firmware assets.']
        },
        {
          title: '2. Установка и запуск',
          steps: [
            'Установите Node.js 22 или новее и Git.',
            'Склонируйте репозиторий и выполните npm ci.',
            'Запустите browser-сборку через npm run dev или desktop-сборку через npm run electron:dev.',
            'Desktop-сборка нужна для REST API, MCP-автоматизации, PDF-экспорта и packaging.'
          ],
          code: 'git clone https://github.com/myahlovvlad/LCD-bitmap-IDE.git\ncd LCD-bitmap-IDE\nnpm ci\nnpm run electron:dev'
        },
        {
          title: '3. Открытие demo-проекта',
          body: [
            'На стартовом экране выберите встроенный demo-проект или откройте examples/universal-lcd-demo.lcdproj.',
            'Demo специально сделан универсальным. Он показывает, как представить измерительный интерфейс без vendor implementation files, private device identifiers и приватных каталогов экранов.'
          ],
          steps: ['Откройте demo.', 'Посмотрите вкладки FSM, LCD, Tags и Runtime.', 'Не меняйте всё сразу. Измените один экран или переход, затем проверьте preview.']
        },
        {
          title: '4. Основные рабочие области',
          table: [
            ['Область', 'Назначение', 'Результат для новичка'],
            ['FSM', 'Состояния и переходы', 'Понятный операторский flow'],
            ['LCD', 'Пиксельные экраны 128x64', 'Читаемые screen layouts'],
            ['Control panel', 'Привязка кнопок и событий', 'Предсказуемый ввод оператора'],
            ['Tags', 'Именованные значения экранов и процедур', 'Traceable измерительные значения'],
            ['Runtime', 'Интерактивная проверка flow', 'Проверенный workflow до firmware export']
          ]
        },
        {
          title: '5. Построение измерительного workflow',
          body: [
            'Начинайте не с пикселей, а с состояний, которые ожидает оператор. Простой workflow обычно включает Idle, Setup, Ready, Running, Result, Error и Service.',
            'Каждое состояние должно отвечать на один вопрос пользователя: что происходит, какое значение важно сейчас и какое действие доступно.'
          ],
          steps: ['Добавьте состояния во вкладке FSM.', 'Назовите переходы событиями START, NEXT, CANCEL или RETRY.', 'Сделайте error transitions явными.', 'Проверьте workflow в Runtime Preview до детальной графики.']
        },
        {
          title: '6. Проектирование LCD-экранов',
          body: [
            'Проектируйте экран для быстрого чтения. Текущее состояние обычно сверху, ключевое значение в центре, доступное действие ближе к нижней части.',
            'Используйте текст, линии, прямоугольники, bitmap-слои и special elements: progress bar, indicators, checkbox/radio. Не перегружайте экран декоративными деталями.'
          ],
          checklist: ['Текст читается на 128x64.', 'Важные значения имеют единицы измерения.', 'Доступное действие видно.', 'Warning screens визуально отличаются.']
        },
        {
          title: '7. Привязка кнопок, tags и procedures',
          body: [
            'Кнопки должны генерировать события, совпадающие с FSM transitions. Tags описывают измерительные значения, настройки или status flags. Procedures описывают backend-действия: старт измерения, сброс результата, сервисная процедура.',
            'Используйте стабильные имена. Tag sample_absorbance проще поддерживать, чем value1.'
          ]
        },
        {
          title: '8. Проверка workflow',
          steps: ['Откройте Runtime.', 'Начните с initial state.', 'Нажимайте кнопки в порядке реального оператора.', 'Проверьте, что все status screens появляются в правильной последовательности.', 'Проверьте error и cancel paths, а не только успешный сценарий.']
        },
        {
          title: '9. Экспорт для firmware',
          body: [
            'Когда workflow стабилен, экспортируйте экраны как C headers, binary frame buffers, XBM, Arduino PROGMEM, Rust embedded-graphics или ESP-IDF assets.',
            'Перед прошивкой hardware проверьте, что целевой дисплей использует ту же resolution, page order, bit order и monochrome format.'
          ]
        },
        {
          title: '10. Сохранение, версии и передача',
          checklist: ['Сохраняйте .lcdproj после смысловых изменений.', 'Коммитьте project files и generated assets отдельно.', 'Добавляйте screenshots в review.', 'Связывайте firmware artifacts с версией проекта.']
        },
        {
          title: '11. Устранение неполадок',
          table: [
            ['Симптом', 'Вероятная причина', 'Действие'],
            ['Кнопка Runtime ничего не делает', 'Нет transition для события', 'Проверьте event names в FSM'],
            ['Export выглядит инвертированным', 'Bit order целевого дисплея отличается', 'Проверьте byte order драйвера'],
            ['Текст обрезан', 'Объект или шрифт слишком большой', 'Сократите текст или измените позицию'],
            ['API connection refused', 'Desktop app не запущен', 'Запустите npm run electron:dev или packaged app']
          ]
        }
      ],
      zh: [
        {
          title: '1. 应用程序用途',
          body: [
            'LCD-bitmap IDE 是离线桌面工作台，用于设计单色 LCD 屏幕、有限状态机导航、控制面板绑定以及可交付给固件的导出文件。',
            '它适合围绕测量流程设计操作界面：设置、启动、运行进度、结果查看、警告和维护状态。',
            '应用本身不直接执行物理测量。真实数据采集需要仪器固件、后端服务或硬件连接器。LCD-bitmap IDE 用于在集成到目标固件之前设计和验证界面与运行行为。'
          ],
          checklist: ['创建或打开项目。', '设计屏幕和 FSM 转换。', '在预览中检查流程。', '导出固件资源。']
        },
        {
          title: '2. 安装与启动',
          steps: ['安装 Node.js 22 或更高版本以及 Git。', '克隆仓库并运行 npm ci。', '使用 npm run dev 启动浏览器版本，或使用 npm run electron:dev 启动桌面版本。', '需要 REST API、MCP 自动化、PDF 导出或应用打包时，请使用桌面版本。'],
          code: 'git clone https://github.com/myahlovvlad/LCD-bitmap-IDE.git\ncd LCD-bitmap-IDE\nnpm ci\nnpm run electron:dev'
        },
        {
          title: '3. 打开演示项目',
          body: ['在启动界面选择内置演示项目，或打开 examples/universal-lcd-demo.lcdproj。', '演示项目是通用的。它展示如何表示测量类界面，而不包含供应商固件、序列号或私有屏幕目录。'],
          steps: ['打开演示项目。', '查看 FSM、LCD、Tags 和 Runtime 工作区。', '不要一次修改所有内容。先修改一个屏幕或转换，然后预览。']
        },
        {
          title: '4. 工作区概览',
          table: [
            ['工作区', '用途', '新手得到的结果'],
            ['FSM', '状态和转换', '清晰的操作流程'],
            ['LCD', '128x64 像素级屏幕', '可读的屏幕布局'],
            ['Control panel', '按钮和事件绑定', '可预测的操作输入'],
            ['Tags', '屏幕和过程使用的命名值', '可追踪的测量值'],
            ['Runtime', '交互式流程预览', '固件导出前检查流程']
          ]
        },
        {
          title: '5. 构建测量流程',
          body: ['先考虑操作员期望看到的状态，而不是先画像素。简单流程通常包含 Idle、Setup、Ready、Running、Result、Error 和 Service。', '每个状态都应回答一个问题：现在发生了什么，当前最重要的值是什么，用户可以执行什么操作。'],
          steps: ['在 FSM 中添加流程状态。', '使用 START、NEXT、CANCEL 或 RETRY 等事件命名转换。', '明确绘制错误转换。', '在详细绘图前先运行 Runtime Preview。']
        },
        {
          title: '6. 设计 LCD 屏幕',
          body: ['屏幕应便于快速读取。通常将当前状态放在顶部，关键数值放在中间，可执行操作放在底部附近。', '可以使用文本、线条、矩形、位图层以及进度条、指示器等特殊元素。避免装饰性内容占用屏幕。'],
          checklist: ['文字在 128x64 上可读。', '重要数值带单位。', '当前可用操作清晰可见。', '警告屏幕具有明显区别。']
        },
        {
          title: '7. 绑定按钮、标签和过程',
          body: ['按钮应触发与 FSM 转换匹配的事件。Tags 描述测量值、配置值或状态标志。Procedures 描述后端动作，例如开始读数、清除结果或进入维护流程。', '使用稳定的名称。sample_absorbance 比 value1 更容易维护。']
        },
        {
          title: '8. 预览流程',
          steps: ['打开 Runtime。', '从初始状态开始。', '按照真实操作顺序按下每个按钮。', '检查所有测量状态屏幕是否按正确顺序出现。', '测试错误和取消路径，不要只测试成功路径。']
        },
        {
          title: '9. 导出到固件',
          body: ['流程稳定后，可将屏幕导出为 C headers、binary frame buffers、XBM、Arduino PROGMEM、Rust embedded-graphics 或 ESP-IDF 资源。', '刷写硬件之前，请确认目标显示屏使用相同的分辨率、page order、bit order 和单色格式。']
        },
        {
          title: '10. 保存、版本管理和交付',
          checklist: ['在重要修改后保存 .lcdproj 文件。', '项目文件和生成资源分别提交。', '在评审中包含截图。', '将固件资源追溯到项目版本。']
        },
        {
          title: '11. 故障排除',
          table: [
            ['现象', '可能原因', '处理方法'],
            ['Runtime 按钮无反应', '没有对应事件的转换', '检查 FSM 转换事件名称'],
            ['导出图像反色', '目标显示屏 bit order 不同', '确认驱动 byte order'],
            ['文本被裁剪', '文本对象或字体过大', '缩短文本或调整位置'],
            ['API connection refused', '桌面应用未运行', '运行 npm run electron:dev 或 packaged app']
          ]
        }
      ]
    }
  },
  {
    id: 'llm-project-lifecycle-manual',
    titles: {
      en: 'LLM Project Lifecycle Manual',
      ru: 'Руководство по жизненному циклу проекта через LLM',
      zh: '通过 LLM 管理项目生命周期手册'
    },
    subtitles: {
      en: 'How to prepare the environment and operate LCD-bitmap IDE with Claude Code, Codex, OpenCode, LM Studio and Ollama.',
      ru: 'Как подготовить окружение и управлять LCD-bitmap IDE через Claude Code, Codex, OpenCode, LM Studio и Ollama.',
      zh: '如何准备环境，并使用 Claude Code、Codex、OpenCode、LM Studio 和 Ollama 操作 LCD-bitmap IDE。'
    },
    chapters: {
      en: lifecycleEn(),
      ru: lifecycleRu(),
      zh: lifecycleZh()
    }
  }
];

function lifecycleEn() {
  return [
    { title: '1. What The LLM Should Do', body: ['Use the LLM as an assistant for structured edits, reviews and repetitive project work. The UI remains the source of truth.', 'The LLM should read project state first, propose a small change, apply it through MCP or REST, then validate and report the result.'], checklist: ['Read before write.', 'Change one concept at a time.', 'Validate after each batch.', 'Keep the desktop app visible.'] },
    { title: '2. Prepare The Environment', steps: ['Install Node.js 22+, Git and a supported LLM client.', 'Run npm ci in the repository.', 'Start the Electron app with npm run electron:dev.', 'Open a project or the bundled demo before calling tools.'], code: 'npm ci\nnpm run electron:dev\ncurl http://127.0.0.1:8766/api/health' },
    { title: '3. Choose A Connector Path', table: [['Client', 'Best path', 'Fallback'], ['Claude Code', 'MCP HTTP server', 'REST through shell commands'], ['Codex', 'MCP HTTP server or local shell REST calls', 'Small JSON scripts'], ['OpenCode', 'MCP HTTP server', 'curl commands'], ['LM Studio', 'Tool wrapper calling REST', 'Manual curl recipes'], ['Ollama', 'Agent wrapper calling REST', 'Scripted batch edits']] },
    { title: '4. Recommended System Prompt', body: ['Give the agent explicit guardrails. It should not delete states, overwrite a project or perform broad edits without confirmation.'], code: 'You are operating LCD-bitmap IDE through local MCP/REST.\nFirst read the project summary and FSM states.\nBefore each mutation, describe the intended change.\nApply small changes only.\nAfter each mutation, validate and summarize the result.\nDo not delete states unless the user explicitly asks.' },
    { title: '5. Read Project State', body: ['Start every session by reading the current project. This avoids stale assumptions and prevents the model from editing the wrong state, screen or tag.'], code: 'curl http://127.0.0.1:8766/api/project/meta\ncurl http://127.0.0.1:8766/api/fsm/states\ncurl http://127.0.0.1:8766/api/tags' },
    { title: '6. Edit The Project Safely', steps: ['Ask for one outcome: add a state, rename a screen, add a tag or connect a transition.', 'Let the agent prepare the payload.', 'Apply the payload through MCP or REST.', 'Read the state again and compare the result.', 'Save the project in the UI after successful batches.'] },
    { title: '7. Validate Measurement Workflows', body: ['For measurement-oriented projects, the LLM should verify that setup, run, result, cancel and error paths all exist. It should also check that key measurement tags have units and precision.'], checklist: ['Initial state exists.', 'START has a valid path.', 'Result state is reachable.', 'Cancel and error paths are reachable.', 'Measurement tags have names, units and precision.'] },
    { title: '8. Compile And Review', steps: ['Compile screens after LCD changes.', 'Run Runtime Preview after FSM changes.', 'Review screenshots or exported assets before handing changes to firmware.', 'Commit documentation and project changes together when they describe the same behavior.'] },
    { title: '9. Release Handoff', body: ['A clean handoff contains the .lcdproj file, exported firmware assets, screenshots, validation notes and the exact application version or commit hash used to generate them.'] },
    { title: '10. Security Rules', checklist: ['Do not expose 127.0.0.1 automation ports through a public tunnel.', 'Do not paste private implementation files, device identifiers or keys into prompts.', 'Review every DELETE operation manually.', 'Keep proprietary projects outside the public branch.'] }
  ];
}

function lifecycleRu() {
  return [
    { title: '1. Что должен делать LLM', body: ['Используйте LLM как помощника для структурированных правок, review и повторяемой работы с проектом. UI остаётся источником истины.', 'LLM сначала читает состояние проекта, предлагает небольшое изменение, применяет его через MCP или REST, затем валидирует и сообщает результат.'], checklist: ['Сначала читать, потом писать.', 'Менять один концепт за раз.', 'Валидировать после каждой пачки.', 'Держать desktop app открытым.'] },
    { title: '2. Подготовка окружения', steps: ['Установите Node.js 22+, Git и выбранный LLM-клиент.', 'Выполните npm ci в репозитории.', 'Запустите Electron app через npm run electron:dev.', 'Откройте проект или bundled demo до вызова tools.'], code: 'npm ci\nnpm run electron:dev\ncurl http://127.0.0.1:8766/api/health' },
    { title: '3. Выбор connector-пути', table: [['Клиент', 'Лучший путь', 'Fallback'], ['Claude Code', 'MCP HTTP server', 'REST через shell-команды'], ['Codex', 'MCP HTTP server или shell REST calls', 'Небольшие JSON scripts'], ['OpenCode', 'MCP HTTP server', 'curl commands'], ['LM Studio', 'Tool wrapper поверх REST', 'Ручные curl recipes'], ['Ollama', 'Agent wrapper поверх REST', 'Scripted batch edits']] },
    { title: '4. Рекомендуемый system prompt', body: ['Дайте agent явные ограничения. Он не должен удалять states, перезаписывать проект или делать широкие правки без подтверждения.'], code: 'You are operating LCD-bitmap IDE through local MCP/REST.\nFirst read the project summary and FSM states.\nBefore each mutation, describe the intended change.\nApply small changes only.\nAfter each mutation, validate and summarize the result.\nDo not delete states unless the user explicitly asks.' },
    { title: '5. Чтение состояния проекта', body: ['Каждую сессию начинайте с чтения проекта. Это предотвращает устаревшие предположения и правки не того state, screen или tag.'], code: 'curl http://127.0.0.1:8766/api/project/meta\ncurl http://127.0.0.1:8766/api/fsm/states\ncurl http://127.0.0.1:8766/api/tags' },
    { title: '6. Безопасное редактирование проекта', steps: ['Запрашивайте один outcome: добавить state, переименовать screen, добавить tag или связать transition.', 'Пусть agent подготовит payload.', 'Примените payload через MCP или REST.', 'Снова прочитайте state и сравните результат.', 'После успешной пачки сохраните проект в UI.'] },
    { title: '7. Валидация измерительных workflow', body: ['Для measurement-oriented проектов LLM должен проверить наличие setup, run, result, cancel и error paths. Также нужно проверить, что measurement tags имеют units и precision.'], checklist: ['Initial state существует.', 'START ведёт по валидному пути.', 'Result state достижим.', 'Cancel и error paths достижимы.', 'Measurement tags имеют names, units и precision.'] },
    { title: '8. Compile и review', steps: ['Компилируйте screens после LCD-изменений.', 'Запускайте Runtime Preview после FSM-изменений.', 'Проверяйте screenshots или exported assets до передачи firmware-разработчику.', 'Коммитьте docs и project changes вместе, если они описывают одно поведение.'] },
    { title: '9. Release handoff', body: ['Чистая передача включает .lcdproj, exported firmware assets, screenshots, validation notes и точную версию приложения или commit hash, которыми они были созданы.'] },
    { title: '10. Security rules', checklist: ['Не открывайте 127.0.0.1 automation ports через публичный tunnel.', 'Не вставляйте private implementation files, device identifiers или keys в prompts.', 'Проверяйте каждый DELETE вручную.', 'Держите proprietary projects вне public branch.'] }
  ];
}

function lifecycleZh() {
  return [
    { title: '1. LLM 应该做什么', body: ['将 LLM 作为结构化修改、审查和重复性项目工作的助手。UI 仍然是事实来源。', 'LLM 应先读取项目状态，提出小范围修改，通过 MCP 或 REST 应用，然后验证并报告结果。'], checklist: ['先读后写。', '一次只改一个概念。', '每批修改后验证。', '保持桌面应用可见。'] },
    { title: '2. 准备环境', steps: ['安装 Node.js 22+、Git 和支持的 LLM 客户端。', '在仓库中运行 npm ci。', '使用 npm run electron:dev 启动 Electron 应用。', '调用工具前先打开项目或内置演示。'], code: 'npm ci\nnpm run electron:dev\ncurl http://127.0.0.1:8766/api/health' },
    { title: '3. 选择连接方式', table: [['客户端', '最佳路径', '备用路径'], ['Claude Code', 'MCP HTTP server', '通过 shell 调用 REST'], ['Codex', 'MCP HTTP server 或本地 REST 调用', '小型 JSON 脚本'], ['OpenCode', 'MCP HTTP server', 'curl 命令'], ['LM Studio', '调用 REST 的工具包装器', '手动 curl 示例'], ['Ollama', '调用 REST 的 agent 包装器', '脚本化批量编辑']] },
    { title: '4. 推荐 System Prompt', body: ['为 agent 设置明确边界。未经确认，它不应删除状态、覆盖项目或执行大范围修改。'], code: 'You are operating LCD-bitmap IDE through local MCP/REST.\nFirst read the project summary and FSM states.\nBefore each mutation, describe the intended change.\nApply small changes only.\nAfter each mutation, validate and summarize the result.\nDo not delete states unless the user explicitly asks.' },
    { title: '5. 读取项目状态', body: ['每次会话都应从读取当前项目开始。这可以避免过期假设，并防止模型编辑错误的状态、屏幕或标签。'], code: 'curl http://127.0.0.1:8766/api/project/meta\ncurl http://127.0.0.1:8766/api/fsm/states\ncurl http://127.0.0.1:8766/api/tags' },
    { title: '6. 安全编辑项目', steps: ['一次只请求一个结果：添加状态、重命名屏幕、添加标签或连接转换。', '让 agent 准备 payload。', '通过 MCP 或 REST 应用 payload。', '再次读取状态并比较结果。', '成功批量修改后在 UI 中保存项目。'] },
    { title: '7. 验证测量流程', body: ['对于测量类项目，LLM 应检查 setup、run、result、cancel 和 error 路径是否存在。还应检查关键测量标签是否具有单位和精度。'], checklist: ['存在初始状态。', 'START 有有效路径。', 'Result 状态可达。', 'Cancel 和 error 路径可达。', '测量标签具有名称、单位和精度。'] },
    { title: '8. 编译与审查', steps: ['LCD 修改后编译屏幕。', 'FSM 修改后运行 Runtime Preview。', '交付固件前检查截图或导出资源。', '当文档和项目修改描述同一行为时，一起提交。'] },
    { title: '9. 发布交付', body: ['清晰的交付包应包含 .lcdproj 文件、导出的固件资源、截图、验证记录，以及生成这些内容所使用的应用版本或 commit hash。'] },
    { title: '10. 安全规则', checklist: ['不要通过公共隧道暴露 127.0.0.1 自动化端口。', '不要将私有固件、序列号或密钥粘贴到 prompt 中。', '手动审查每个 DELETE 操作。', '将专有项目保留在 public branch 之外。'] }
  ];
}

function renderHtml(doc, lang) {
  const title = doc.titles[lang.code];
  const subtitle = doc.subtitles[lang.code];
  const chapters = doc.chapters[lang.code];
  const toc = chapters.map((chapter, index) => `<a href="#chapter-${index + 1}">${escapeHtml(chapter.title)}</a>`).join('\n');
  const body = chapters.map((chapter, index) => renderChapter(chapter, index + 1)).join('\n');
  return `<!doctype html>
<html lang="${lang.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${manualCss()}</style>
</head>
<body>
  <header>
    <p class="eyebrow">LCD-bitmap IDE</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
  </header>
  <nav class="toc" aria-label="Table of contents">${toc}</nav>
  <main>${body}</main>
  <footer>Generated from scripts/generate-user-docs.mjs. For automation details see docs/API_MCP_CONNECTORS.md.</footer>
</body>
</html>`;
}

function renderChapter(chapter, number) {
  const parts = [`<section id="chapter-${number}"><h2>${escapeHtml(chapter.title)}</h2>`];
  for (const paragraph of chapter.body ?? []) parts.push(`<p>${escapeHtml(paragraph)}</p>`);
  if (chapter.steps) parts.push(`<ol>${chapter.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`);
  if (chapter.checklist) parts.push(`<ul class="checklist">${chapter.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  if (chapter.table) parts.push(renderTable(chapter.table));
  if (chapter.code) parts.push(`<pre><code>${escapeHtml(chapter.code)}</code></pre>`);
  parts.push('</section>');
  return parts.join('\n');
}

function renderTable(rows) {
  const [head, ...body] = rows;
  return `<table><thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function manualCss() {
  return `
  body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #15211d; background: #f7f8f4; line-height: 1.62; letter-spacing: 0; }
  header { padding: 48px 56px 34px; background: #10201a; color: #fff; }
  .eyebrow { margin: 0 0 10px; color: #9ed8bf; font-weight: 700; }
  h1 { max-width: 920px; margin: 0; font-size: 38px; line-height: 1.12; letter-spacing: 0; }
  .subtitle { max-width: 860px; margin: 16px 0 0; color: #d9e8df; font-size: 18px; }
  .toc { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; padding: 22px 56px; background: #e6eee8; border-bottom: 1px solid #cdd8d0; }
  .toc a { color: #195d48; text-decoration: none; font-weight: 650; }
  main { max-width: 980px; margin: 0 auto; padding: 28px 32px 56px; }
  section { margin: 0 0 34px; padding: 26px; background: #fff; border: 1px solid #d7ded8; border-radius: 8px; break-inside: avoid; }
  h2 { margin: 0 0 14px; font-size: 24px; line-height: 1.25; letter-spacing: 0; }
  p { margin: 0 0 12px; }
  ol, ul { margin: 8px 0 0; padding-left: 24px; }
  li { margin: 6px 0; }
  .checklist li::marker { content: "□ "; color: #20765a; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
  th, td { border: 1px solid #cfd9d2; padding: 9px 10px; text-align: left; vertical-align: top; }
  th { background: #eef4ef; }
  pre { margin: 14px 0 0; padding: 14px; overflow-x: auto; border-radius: 6px; background: #101816; color: #d7f5e7; font-size: 13px; }
  footer { padding: 24px 56px; color: #5c6761; }
  @page { size: A4; margin: 14mm; }
  @media print { header, .toc, footer { padding-left: 0; padding-right: 0; } body { background: #fff; } section { border: 1px solid #cfd9d2; } }
  `;
}

function flattenDoc(doc, lang) {
  const items = [];
  items.push({ type: 'title', text: doc.titles[lang.code] });
  items.push({ type: 'subtitle', text: doc.subtitles[lang.code] });
  for (const chapter of doc.chapters[lang.code]) {
    items.push({ type: 'heading', text: chapter.title });
    for (const paragraph of chapter.body ?? []) items.push({ type: 'paragraph', text: paragraph });
    for (const [index, step] of (chapter.steps ?? []).entries()) items.push({ type: 'paragraph', text: `${index + 1}. ${step}` });
    for (const item of chapter.checklist ?? []) items.push({ type: 'bullet', text: item });
    if (chapter.table) {
      const [head, ...rows] = chapter.table;
      items.push({ type: 'paragraph', text: head.join(' | ') });
      for (const row of rows) items.push({ type: 'bullet', text: row.join(' | ') });
    }
    if (chapter.code) items.push({ type: 'code', text: chapter.code });
  }
  return items;
}

function createDocxBuffer(doc, lang) {
  const documentXml = renderDocumentXml(flattenDoc(doc, lang));
  const files = {
    '[Content_Types].xml': contentTypesXml(),
    '_rels/.rels': rootRelsXml(),
    'docProps/core.xml': coreXml(doc.titles[lang.code]),
    'docProps/app.xml': appXml(),
    'word/document.xml': documentXml,
    'word/styles.xml': stylesXml()
  };
  return zipStore(files);
}

function renderDocumentXml(items) {
  const body = items.map((item) => {
    const style = item.type === 'title' ? 'Title'
      : item.type === 'subtitle' ? 'Subtitle'
      : item.type === 'heading' ? 'Heading1'
      : item.type === 'code' ? 'Code'
      : 'Normal';
    const prefix = item.type === 'bullet' ? '• ' : '';
    const lines = String(item.text).split('\n');
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(prefix + lines[0])}</w:t></w:r>${lines.slice(1).map((line) => `<w:r><w:br/><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`).join('')}</w:p>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body>
</w:document>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function coreXml(title) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>LCD-bitmap IDE</dc:creator><cp:lastModifiedBy>LCD-bitmap IDE</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LCD-bitmap IDE docs generator</Application></Properties>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:eastAsia="Microsoft YaHei" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="5C6761"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr></w:style></w:styles>`;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;');
}

async function generate() {
  await mkdir(outputDir, { recursive: true });
  const indexLinks = [];
  const browser = await chromium.launch();
  try {
    for (const doc of docs) {
      for (const lang of languages) {
        const base = `${doc.id}.${lang.code}`;
        const htmlPath = resolve(outputDir, `${base}.html`);
        const pdfPath = resolve(outputDir, `${base}.pdf`);
        const docxPath = resolve(outputDir, `${base}.docx`);
        const html = renderHtml(doc, lang);
        await writeFile(htmlPath, html, 'utf8');
        await writeFile(docxPath, createDocxBuffer(doc, lang));

        const page = await browser.newPage();
        await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' } });
        await page.close();

        indexLinks.push({ doc, lang, base });
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(resolve(outputDir, 'index.html'), renderIndex(indexLinks), 'utf8');
  console.log(`Generated ${indexLinks.length * 3 + 1} files in ${outputDir}`);
}

function renderIndex(links) {
  const cards = links.map(({ doc, lang, base }) => `<article><h2>${escapeHtml(doc.titles[lang.code])}</h2><p>${escapeHtml(lang.label)}</p><p><a href="./${base}.html">HTML</a> <a href="./${base}.pdf">PDF</a> <a href="./${base}.docx">DOCX</a></p></article>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LCD-bitmap IDE User Manuals</title><style>body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f7f8f4;color:#17201c;line-height:1.55}header{padding:42px;background:#10201a;color:#fff}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;padding:28px}article{background:#fff;border:1px solid #d7ded8;border-radius:8px;padding:20px}a{display:inline-block;margin-right:10px;color:#20765a;font-weight:700}</style></head><body><header><h1>LCD-bitmap IDE User Manuals</h1><p>Operation and LLM lifecycle manuals in English, Russian and Chinese.</p></header><main>${cards}</main></body></html>`;
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
