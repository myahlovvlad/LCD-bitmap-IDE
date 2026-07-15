import type React from 'react';
import { useState } from 'react';
import { X, ChevronRight, HelpCircle } from 'lucide-react';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { LanguageCode } from '../../renderer/types/domain';

export type TutorialWorkspace = 'tags' | 'procedures' | 'fsm' | 'lcd' | 'control-panel' | 'preview' | 'alarms' | 'screen-dsl';

interface TutorialStep {
  title: string;
  body: string;
}

const TUTORIAL_CONTENT: Record<LanguageCode, Record<TutorialWorkspace, TutorialStep[]>> = {
  en: {
    tags: [
      { title: 'Tag Registry', body: 'Tags are named data channels that connect HMI elements to device measurements. Each tag has a data type, unit and optional source binding.' },
      { title: 'Add a tag', body: 'Click the + button in the sidebar to create a new tag. Fill in the name in all three languages, choose a data type (float, int, bool, string) and optionally set min/max bounds.' },
      { title: 'Data sources', body: 'Switch to the "Data sources" tab to configure where tag values come from: CLI commands, serial bus, simulation or formula-based computation.' },
      { title: 'Bind tags to HMI', body: 'After defining tags, open the Control Panel workspace and set bindings on buttons or display elements to read/write tag values at runtime.' }
    ],
    procedures: [
      { title: 'Procedure editor', body: 'Procedures are ordered sequences of backend steps that execute when an FSM transition fires. They drive the real device via CLI commands.' },
      { title: 'Add a procedure', body: 'Click + in the sidebar to create a procedure. Give it a unique ID and localized name, then add steps in the center panel.' },
      { title: 'Step types', body: 'cli — send a command to the device; delay — wait a fixed time; setTag — update a tag value; guard — abort if a condition is false; audit — log a message.' },
      { title: 'Link to FSM', body: 'Open the FSM editor, select a transition, and enter the procedure ID in the "Backend process" field. The orchestrated engine will run it when the event fires.' }
    ],
    fsm: [
      { title: 'FSM Editor', body: 'The finite-state machine graph defines all application states and transitions. Each node is a state, each edge is a transition triggered by an event.' },
      { title: 'Create states', body: 'Click "Add state" in the toolbar. Drag the new node to position it. Double-click a node to rename it.' },
      { title: 'Create transitions', body: 'Drag from the handle of one state to another to create a transition. Assign an event ID and optional guard condition in the right inspector.' },
      { title: 'Link screens', body: 'Select a state and link it to an LCD screen in the right inspector. The preview workspace will display that screen when the state is active.' }
    ],
    lcd: [
      { title: 'LCD Editor', body: 'Design the contents of a single LCD screen. Objects (text, lines, rectangles, glyphs) are layered on the pixel canvas.' },
      { title: 'Add objects', body: 'Choose a tool in the toolbar — text, line, rectangle, glyph or special element — then click the display to place it.' },
      { title: 'Object properties', body: 'Select an object to edit its position, size and text in the right inspector. Use the layer panel to reorder and toggle visibility.' },
      { title: 'Export', body: 'Use "Download .h" to get a C header with a 1-bpp bitmap array, or "Download .bin" for raw binary. "All screens .h" exports every screen at once.' }
    ],
    'control-panel': [
      { title: 'Control Panel', body: 'The control panel defines the physical buttons and UI elements visible to the operator. Each button can trigger an FSM event.' },
      { title: 'Add buttons', body: 'Click "Add button" in the toolbar. Position and resize the button on the canvas. Assign a label and FSM event in the inspector.' },
      { title: 'Allowed states', body: 'Set allowed or disabled states for each button. The runtime preview will only enable the button when the FSM is in an allowed state.' },
      { title: 'HMI bindings', body: 'Use the "Bindings" section in the inspector to bind button visibility, text or value to a tag expression.' }
    ],
    preview: [
      { title: 'Runtime preview', body: 'Simulates the FSM in real time. Click buttons on the control panel to fire events. The LCD display updates to the screen linked to the current state.' },
      { title: 'Step mode', body: 'Enable step mode to advance the FSM one transition at a time. Useful for debugging complex state sequences.' },
      { title: 'Runtime log', body: 'The log panel shows every event, transition and backend message. Errors appear in red.' }
    ],
    alarms: [
      { title: 'What is an alarm?', body: 'An alarm is a named abnormal-condition event: a sensor failure, a threshold exceeded, or an unexpected device response. It is NOT a regular FSM event — it is a separate watch condition layered on top of your tags.' },
      { title: 'When to use it', body: 'Use an alarm whenever the device can enter a state that needs operator attention regardless of which screen is currently shown — e.g. a lamp that stops responding, an out-of-range measurement, or a communication timeout.' },
      { title: 'Step 1 — create a tag', body: 'Open Tag Registry and create a boolean or numeric tag that reflects the fault, e.g. "lamp_d2_fail" (bool) or "absorbance" (float). The tag is the data source the alarm watches.' },
      { title: 'Step 2 — create the alarm', body: 'Click "+" here, give it a name and severity (info / warning / critical), then set its condition to "@tag_id" (fires when the tag is truthy) or a literal expression.' },
      { title: 'Step 3 — use it from FSM', body: 'In the FSM editor, you can reference the alarm condition in a transition guard so the state machine automatically routes to a diagnostic/error screen when the alarm is active.' }
    ],
    'screen-dsl': [
      { title: 'What is Screen Schema Studio?', body: 'A text-based (JSON/YAML) editor for your screens, meant for bulk edits, scripting, and round-tripping with external tools. It is a power-user companion to the visual LCD editor, not a replacement for it.' },
      { title: 'Format and Mode', body: 'Format chooses JSON or YAML syntax. Mode chooses what the source describes: Create (a brand-new screen), Update (overwrite an existing screen, requires selecting a target screen), or Clone (duplicate an existing screen under a new id).' },
      { title: 'The Create → Preview → Apply loop', body: '"Generate from Project" fills the editor with the current screen as a starting point. Edit the text, then click Preview to validate it and compute a diff. Apply is only enabled once a clean Preview exists.' },
      { title: 'Reading diagnostics and changes', body: 'The Diagnostics tab lists syntax/schema errors. The Changes tab shows exactly which objects will be added, updated or deleted — destructive deletions are marked and require confirmation before Apply.' },
      { title: '"Stale" warnings', body: 'If the project changes elsewhere (e.g. via Undo, or editing the same screen in the visual editor) while you have an unapplied draft, the session is marked stale. Re-run Preview before Apply to confirm your draft still matches the current project.' },
      { title: 'File workflow', body: '"Open DSL File" loads an external .json/.yaml file into the editor for review (it does not touch the project until you Apply). "Export Canonical" saves the current project state as a file, useful for sharing with other tools or engineers.' }
    ]
  },
  ru: {
    tags: [
      { title: 'Реестр тегов', body: 'Теги — именованные каналы данных, связывающие элементы HMI с измерениями устройства. Каждый тег имеет тип данных, единицу измерения и опциональную привязку к источнику.' },
      { title: 'Добавить тег', body: 'Нажмите кнопку + на панели слева, чтобы создать тег. Заполните имя на трёх языках, выберите тип данных (float, int, bool, string) и при необходимости задайте диапазон значений.' },
      { title: 'Источники данных', body: 'Переключитесь на вкладку "Источники данных", чтобы настроить, откуда берутся значения тегов: CLI-команды, последовательная шина, симуляция или вычисляемая формула.' },
      { title: 'Привязка к HMI', body: 'После определения тегов откройте рабочую область панели управления и настройте привязки на кнопках или элементах дисплея для чтения/записи значений тегов во время выполнения.' }
    ],
    procedures: [
      { title: 'Редактор процедур', body: 'Процедуры — упорядоченные последовательности backend-шагов, выполняемых при срабатывании перехода FSM. Они управляют реальным устройством через CLI-команды.' },
      { title: 'Добавить процедуру', body: 'Нажмите + на панели слева для создания процедуры. Задайте уникальный ID и локализованное имя, затем добавьте шаги в центральной панели.' },
      { title: 'Типы шагов', body: 'cli — отправить команду устройству; delay — ожидание; setTag — установить значение тега; guard — прервать при ложном условии; audit — запись в журнал.' },
      { title: 'Связь с FSM', body: 'Откройте редактор FSM, выберите переход и введите ID процедуры в поле "Backend-процесс". Движок оркестрации выполнит её при наступлении события.' }
    ],
    fsm: [
      { title: 'FSM-редактор', body: 'Граф конечного автомата определяет все состояния и переходы приложения. Каждый узел — состояние, каждая дуга — переход, запускаемый событием.' },
      { title: 'Создание состояний', body: 'Нажмите "Добавить состояние" на панели инструментов. Переместите узел мышью. Двойной клик — переименование.' },
      { title: 'Создание переходов', body: 'Перетащите из маркера одного состояния к другому. Назначьте ID события и условие в правом инспекторе.' },
      { title: 'Связь с экранами', body: 'Выберите состояние и свяжите его с LCD-экраном в правом инспекторе. В режиме просмотра будет отображаться этот экран.' }
    ],
    lcd: [
      { title: 'LCD-редактор', body: 'Проектирует содержимое одного LCD-экрана. Объекты (текст, линии, прямоугольники, глифы) накладываются на пиксельный холст.' },
      { title: 'Добавление объектов', body: 'Выберите инструмент на панели — текст, линию, прямоугольник, глиф или спецэлемент — затем кликните по дисплею.' },
      { title: 'Свойства объекта', body: 'Выберите объект для редактирования в правом инспекторе. Панель слоёв позволяет изменить порядок и видимость.' },
      { title: 'Экспорт', body: 'Используйте "Скачать .h" для C-заголовка с 1-bpp массивом, или "Скачать .bin" для бинарного формата.' }
    ],
    'control-panel': [
      { title: 'Панель управления', body: 'Определяет физические кнопки и UI-элементы, видимые оператору. Каждая кнопка может запускать событие FSM.' },
      { title: 'Добавление кнопок', body: 'Нажмите "Добавить кнопку". Разместите и измените размер на холсте. Назначьте надпись и событие FSM в инспекторе.' },
      { title: 'Разрешённые состояния', body: 'Задайте разрешённые или отключённые состояния для кнопки. В режиме просмотра кнопка будет доступна только в разрешённых состояниях.' },
      { title: 'HMI-привязки', body: 'В разделе "Привязки" инспектора настройте зависимость видимости, текста или значения кнопки от выражения с тегами.' }
    ],
    preview: [
      { title: 'Просмотр выполнения', body: 'Симулирует FSM в реальном времени. Нажимайте кнопки на панели управления для генерации событий. Дисплей обновляется.' },
      { title: 'Пошаговый режим', body: 'Включите пошаговый режим для перехода по одному переходу за раз. Удобно для отладки сложных последовательностей.' },
      { title: 'Журнал выполнения', body: 'В панели журнала отображаются все события, переходы и backend-сообщения. Ошибки выделены красным.' }
    ],
    alarms: [
      { title: 'Что такое авария?', body: 'Авария — именованное событие нештатного состояния: отказ датчика, превышение порога, неожиданный ответ устройства. Это НЕ обычное событие FSM, а отдельное условие наблюдения поверх тегов.' },
      { title: 'Когда применять', body: 'Используйте аварию, когда устройство может перейти в состояние, требующее внимания оператора независимо от того, какой экран сейчас показан — например, лампа перестала отвечать, измерение вышло за диапазон, таймаут связи.' },
      { title: 'Шаг 1 — создайте тег', body: 'Откройте "Реестр тегов" и создайте булевый или числовой тег, отражающий неисправность, например "lamp_d2_fail" (bool) или "absorbance" (float). Тег — источник данных, который отслеживает авария.' },
      { title: 'Шаг 2 — создайте аварию', body: 'Нажмите "+" здесь, задайте имя и серьёзность (info / warning / critical), затем укажите условие "@tag_id" (срабатывает, когда тег истинен) или литеральное выражение.' },
      { title: 'Шаг 3 — используйте в FSM', body: 'В FSM-редакторе можно сослаться на условие аварии в условии перехода, чтобы автомат автоматически переходил на диагностический экран при активной аварии.' }
    ],
    'screen-dsl': [
      { title: 'Что такое Screen Schema Studio?', body: 'Текстовый (JSON/YAML) редактор экранов — для массовых правок, скриптов и обмена с внешними инструментами. Это инструмент для продвинутых пользователей в дополнение к визуальному LCD-редактору, а не замена ему.' },
      { title: 'Format и Mode', body: 'Format выбирает синтаксис JSON или YAML. Mode определяет, что описывает источник: Create (новый экран), Update (перезаписать существующий экран, требуется выбрать целевой экран) или Clone (дублировать существующий экран с новым ID).' },
      { title: 'Цикл Create → Preview → Apply', body: '"Generate from Project" заполняет редактор текущим экраном как отправной точкой. Отредактируйте текст, затем нажмите Preview для проверки и расчёта изменений. Apply становится доступен только после чистого Preview.' },
      { title: 'Чтение диагностики и изменений', body: 'Вкладка Diagnostics показывает синтаксические/схемные ошибки. Вкладка Changes показывает, какие объекты будут добавлены, изменены или удалены — разрушающие удаления помечаются и требуют подтверждения перед Apply.' },
      { title: 'Предупреждения "Stale" (устарело)', body: 'Если проект изменился в другом месте (например, через Undo или редактирование того же экрана в визуальном редакторе) пока у вас есть неприменённый черновик, сессия помечается как устаревшая. Повторите Preview перед Apply, чтобы убедиться, что черновик соответствует текущему проекту.' },
      { title: 'Работа с файлами', body: '"Open DSL File" загружает внешний .json/.yaml файл в редактор для просмотра (проект не меняется, пока вы не нажмёте Apply). "Export Canonical" сохраняет текущее состояние проекта в файл — полезно для обмена с другими инструментами или инженерами.' }
    ]
  },
  zh: {
    tags: [
      { title: '标签注册表', body: '标签是命名数据通道，将 HMI 元素与设备测量值连接起来。每个标签具有数据类型、单位和可选的来源绑定。' },
      { title: '添加标签', body: '点击侧边栏中的 + 按钮创建新标签。填写三种语言的名称，选择数据类型（float、int、bool、string），并可选地设置值范围。' },
      { title: '数据源', body: '切换到"数据源"选项卡，配置标签值的来源：CLI 命令、串行总线、仿真或基于公式的计算。' },
      { title: '绑定到 HMI', body: '定义标签后，打开控制面板工作区，在按钮或显示元素上设置绑定，以在运行时读写标签值。' }
    ],
    procedures: [
      { title: '流程编辑器', body: '流程是 FSM 转换触发时执行的有序后端步骤序列，通过 CLI 命令驱动真实设备。' },
      { title: '添加流程', body: '点击侧边栏中的 + 创建流程。提供唯一 ID 和本地化名称，然后在中央面板添加步骤。' },
      { title: '步骤类型', body: 'cli — 向设备发送命令；delay — 等待固定时间；setTag — 更新标签值；guard — 条件为假时中止；audit — 记录消息。' },
      { title: '关联到 FSM', body: '打开 FSM 编辑器，选择转换，在"后端进程"字段中输入流程 ID。事件触发时，编排引擎将运行该流程。' }
    ],
    fsm: [
      { title: 'FSM 编辑器', body: '有限状态机图定义了应用的所有状态和转换。每个节点是一个状态，每条边是由事件触发的转换。' },
      { title: '创建状态', body: '点击工具栏中的"添加状态"。拖动新节点定位。双击节点可重命名。' },
      { title: '创建转换', body: '从一个状态的手柄拖到另一个状态可创建转换。在右侧检查器中分配事件 ID 和可选守卫条件。' },
      { title: '关联屏幕', body: '选择状态并在右侧检查器中将其链接到 LCD 屏幕。预览工作区将在该状态活动时显示该屏幕。' }
    ],
    lcd: [
      { title: 'LCD 编辑器', body: '设计单个 LCD 屏幕的内容。对象（文本、线条、矩形、字形）叠加在像素画布上。' },
      { title: '添加对象', body: '在工具栏中选择工具——文本、线条、矩形、字形或特殊元素——然后点击显示屏放置。' },
      { title: '对象属性', body: '选择对象以在右侧检查器中编辑其位置、大小和文本。使用图层面板重新排序和切换可见性。' },
      { title: '导出', body: '使用"下载 .h"获取带 1-bpp 位图数组的 C 头文件，或使用"下载 .bin"获取原始二进制文件。' }
    ],
    'control-panel': [
      { title: '控制面板', body: '控制面板定义操作员可见的物理按钮和 UI 元素。每个按钮可触发 FSM 事件。' },
      { title: '添加按钮', body: '点击"添加按钮"。在画布上定位和调整大小。在检查器中分配标签和 FSM 事件。' },
      { title: '允许状态', body: '为每个按钮设置允许或禁用状态。运行时预览中，只有当 FSM 处于允许状态时，按钮才可用。' },
      { title: 'HMI 绑定', body: '在检查器的"绑定"部分，将按钮的可见性、文本或值绑定到标签表达式。' }
    ],
    preview: [
      { title: '运行预览', body: '实时模拟 FSM。点击控制面板上的按钮触发事件。LCD 显示屏更新为当前状态链接的屏幕。' },
      { title: '单步模式', body: '启用单步模式，每次前进一个转换。适用于调试复杂状态序列。' },
      { title: '运行日志', body: '日志面板显示每个事件、转换和后端消息。错误以红色显示。' }
    ],
    alarms: [
      { title: '什么是报警？', body: '报警是一个命名的异常状态事件：传感器故障、超出阈值或设备意外响应。它不是普通的 FSM 事件，而是叠加在标签之上的独立监视条件。' },
      { title: '何时使用', body: '当设备可能进入需要操作员注意的状态时使用报警，无论当前显示哪个屏幕——例如灯不再响应、测量值超出范围、通信超时。' },
      { title: '第 1 步 — 创建标签', body: '打开"标签注册表"，创建反映故障的布尔或数值标签，例如 "lamp_d2_fail"（bool）或 "absorbance"（float）。标签是报警监视的数据源。' },
      { title: '第 2 步 — 创建报警', body: '点击此处的 "+"，设置名称和严重性（info / warning / critical），然后将条件设置为 "@tag_id"（标签为真时触发）或字面表达式。' },
      { title: '第 3 步 — 在 FSM 中使用', body: '在 FSM 编辑器中，可以在转换守卫中引用报警条件，使状态机在报警激活时自动跳转到诊断/错误屏幕。' }
    ],
    'screen-dsl': [
      { title: '什么是 Screen Schema Studio？', body: '一个基于文本（JSON/YAML）的屏幕编辑器，用于批量编辑、脚本化和与外部工具的往返交互。它是可视化 LCD 编辑器的高级配套工具，而不是替代品。' },
      { title: 'Format 和 Mode', body: 'Format 选择 JSON 或 YAML 语法。Mode 决定源描述的内容：Create（全新屏幕）、Update（覆盖现有屏幕，需要选择目标屏幕）或 Clone（在新 ID 下复制现有屏幕）。' },
      { title: 'Create → Preview → Apply 循环', body: '"Generate from Project" 会用当前屏幕填充编辑器作为起点。编辑文本后点击 Preview 进行验证并计算差异。只有在 Preview 通过后 Apply 才会启用。' },
      { title: '查看诊断和更改', body: 'Diagnostics 标签列出语法/模式错误。Changes 标签显示将添加、更新或删除的具体对象——破坏性删除会被标记，在 Apply 前需要确认。' },
      { title: '"Stale"（已过期）警告', body: '如果项目在其他地方发生更改（例如通过撤销，或在可视化编辑器中编辑同一屏幕）而您有未应用的草稿，该会话会被标记为已过期。请在 Apply 前重新运行 Preview，以确认草稿仍与当前项目匹配。' },
      { title: '文件工作流', body: '"Open DSL File" 将外部 .json/.yaml 文件加载到编辑器中供查看（在您点击 Apply 之前不会影响项目）。"Export Canonical" 将当前项目状态保存为文件，便于与其他工具或工程师共享。' }
    ]
  }
};

export function TutorialOverlay({
  workspace,
  language,
  onClose
}: {
  workspace: TutorialWorkspace;
  language: LanguageCode;
  onClose: () => void;
}): React.ReactElement {
  const [step, setStep] = useState(0);
  const steps = TUTORIAL_CONTENT[language][workspace];
  const current = steps[step];
  const labels = UI_TEXT[language];

  if (!current) {
    onClose();
    return <></>;
  }

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label={labels.contextualHelp}>
      <div className="tutorial-card">
        <div className="tutorial-header">
          <span className="tutorial-badge"><HelpCircle size={14} />{labels.contextualHelp}</span>
          <button type="button" className="tutorial-close" onClick={onClose} aria-label={labels.tutorialClose}>
            <X size={15} />
          </button>
        </div>
        <div className="tutorial-step-indicator">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`tutorial-dot${i === step ? ' active' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`${labels.wizardStep} ${i + 1}`}
            />
          ))}
        </div>
        <h3 className="tutorial-title">{current.title}</h3>
        <p className="tutorial-body">{current.body}</p>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn-secondary" onClick={onClose}>{labels.tutorialClose}</button>
          {step < steps.length - 1
            ? <button type="button" className="tutorial-btn-primary" onClick={() => setStep(step + 1)}>
                {labels.tutorialNext}<ChevronRight size={14} />
              </button>
            : <button type="button" className="tutorial-btn-primary" onClick={onClose}>{labels.finish}</button>
          }
        </div>
      </div>
    </div>
  );
}
