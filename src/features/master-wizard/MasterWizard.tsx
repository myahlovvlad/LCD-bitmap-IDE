import type React from 'react';
import { useState } from 'react';
import { BookOpen, Download, Tag, Workflow, X } from 'lucide-react';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { LanguageCode } from '../../renderer/types/domain';

export type WizardScenario = 'new-project' | 'demo-project' | 'tag-binding' | 'tutorial';

interface ScenarioMeta {
  id: WizardScenario;
  icon: React.ReactNode;
  title: Record<LanguageCode, string>;
  description: Record<LanguageCode, string>;
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'new-project',
    icon: <Workflow size={20} />,
    title: { en: 'New project', ru: 'Новый проект', zh: '新建项目' },
    description: {
      en: 'Create a blank project with display settings and an initial FSM state.',
      ru: 'Создайте пустой проект с настройками дисплея и начальным состоянием FSM.',
      zh: '创建一个带有显示设置和初始 FSM 状态的空白项目。'
    }
  },
  {
    id: 'demo-project',
    icon: <Download size={20} />,
    title: { en: 'Open demo project', ru: 'Открыть демо-проект', zh: '打开演示项目' },
    description: {
      en: 'Load a neutral sample project with LCD screens, FSM transitions and runtime-ready tags.',
      ru: 'Загрузите нейтральный пример с LCD-экранами, FSM-переходами и тегами для runtime.',
      zh: '加载包含 LCD 屏幕、FSM 转换和运行时标签的中性示例项目。'
    }
  },
  {
    id: 'tag-binding',
    icon: <Tag size={20} />,
    title: { en: 'Tag binding', ru: 'Привязка тегов', zh: '标签绑定' },
    description: {
      en: 'Guided flow for connecting measurement tags to panel buttons and LCD objects.',
      ru: 'Пошаговая привязка тегов измерений к кнопкам панели и объектам LCD.',
      zh: '将测量标签连接到面板按钮和 LCD 对象的引导流程。'
    }
  },
  {
    id: 'tutorial',
    icon: <BookOpen size={20} />,
    title: { en: 'Interactive tutorial', ru: 'Интерактивное обучение', zh: '交互教程' },
    description: {
      en: 'Step-by-step guided tour of all IDE workspaces with practical examples.',
      ru: 'Пошаговое знакомство со всеми рабочими областями IDE на практических примерах.',
      zh: '分步指导游览所有 IDE 工作区，包含实际示例。'
    }
  }
];

const STEPS: Record<WizardScenario, Record<LanguageCode, { title: string; body: string }[]>> = {
  'new-project': {
    en: [
      { title: 'Project name & display', body: 'Enter a project name and choose the LCD display resolution, for example 128x64 for a compact monochrome module.' },
      { title: 'Initial FSM state', body: 'The wizard creates a single main-menu state and one LCD screen linked to it.' },
      { title: 'Ready', body: 'Open the FSM editor to design the graph, or the LCD editor to draw the first screen.' }
    ],
    ru: [
      { title: 'Имя проекта и дисплей', body: 'Введите имя проекта и выберите разрешение LCD-дисплея, например 128x64 для компактного монохромного модуля.' },
      { title: 'Начальное состояние FSM', body: 'Мастер создает одно состояние main-menu и связанный с ним LCD-экран.' },
      { title: 'Готово', body: 'Откройте FSM-редактор для проектирования графа или LCD-редактор для первого экрана.' }
    ],
    zh: [
      { title: '项目名称和显示屏', body: '输入项目名称并选择 LCD 显示分辨率，例如紧凑型单色模块的 128x64。' },
      { title: '初始 FSM 状态', body: '向导创建一个 main-menu 状态和一个链接的 LCD 屏幕。' },
      { title: '准备就绪', body: '打开 FSM 编辑器设计状态图，或打开 LCD 编辑器绘制第一个屏幕。' }
    ]
  },
  'demo-project': {
    en: [
      { title: 'What the demo contains', body: 'The bundled demo is a neutral 128x64 LCD workflow: menu, measurement, saved result, error and glyph test screens.' },
      { title: 'Load the demo', body: 'Complete this scenario to replace the current empty workspace with the demo project.' },
      { title: 'Run it', body: 'Open Runtime and press START, SAVE or ERR to walk through the flow without external hardware.' }
    ],
    ru: [
      { title: 'Что содержит демо', body: 'Встроенный демо-проект - нейтральный workflow для LCD 128x64: меню, измерение, сохраненный результат, ошибка и тест глифов.' },
      { title: 'Загрузка демо', body: 'Завершите этот сценарий, чтобы заменить текущую пустую рабочую область демо-проектом.' },
      { title: 'Запуск', body: 'Откройте Runtime и нажмите START, SAVE или ERR, чтобы пройти flow без внешнего оборудования.' }
    ],
    zh: [
      { title: '演示内容', body: '内置演示是一个中性的 128x64 LCD 工作流，包含菜单、测量、保存结果、错误和字形测试屏幕。' },
      { title: '加载演示', body: '完成此场景以用演示项目替换当前空工作区。' },
      { title: '运行', body: '打开 Runtime 并按 START、SAVE 或 ERR，无需外部硬件即可遍历流程。' }
    ]
  },
  'tag-binding': {
    en: [
      { title: 'Define tags', body: 'Open Tag Registry and create tags for measured or simulated values.' },
      { title: 'Bind to LCD', body: 'Select a text object in the LCD editor and set a tag expression such as @absorbance.' },
      { title: 'Test at runtime', body: 'Open Runtime Preview and verify that bound values update as the FSM changes state.' }
    ],
    ru: [
      { title: 'Определите теги', body: 'Откройте Реестр тегов и создайте теги для измеряемых или моделируемых значений.' },
      { title: 'Привяжите к LCD', body: 'Выберите текстовый объект в LCD-редакторе и задайте выражение тега, например @absorbance.' },
      { title: 'Проверьте runtime', body: 'Откройте Runtime Preview и убедитесь, что значения обновляются при переходах FSM.' }
    ],
    zh: [
      { title: '定义标签', body: '打开标签注册表，为测量值或模拟值创建标签。' },
      { title: '绑定到 LCD', body: '在 LCD 编辑器中选择文本对象，并设置 @absorbance 等标签表达式。' },
      { title: '运行时测试', body: '打开 Runtime Preview，并验证绑定值是否随 FSM 状态变化而更新。' }
    ]
  },
  tutorial: {
    en: [
      { title: 'FSM workspace', body: 'Model the navigation graph and events.' },
      { title: 'LCD workspace', body: 'Draw pixel-precise monochrome screens.' },
      { title: 'Control panel and Runtime', body: 'Bind buttons to events and test the full workflow.' }
    ],
    ru: [
      { title: 'FSM-область', body: 'Моделируйте граф навигации и события.' },
      { title: 'LCD-область', body: 'Создавайте пиксельно-точные монохромные экраны.' },
      { title: 'Панель и Runtime', body: 'Привязывайте кнопки к событиям и проверяйте полный workflow.' }
    ],
    zh: [
      { title: 'FSM 工作区', body: '建模导航图和事件。' },
      { title: 'LCD 工作区', body: '绘制像素精确的单色屏幕。' },
      { title: '控制面板和 Runtime', body: '将按钮绑定到事件并测试完整工作流。' }
    ]
  }
};

export function MasterWizard({
  language,
  onClose,
  onScenarioComplete
}: {
  language: LanguageCode;
  onClose: () => void;
  onScenarioComplete?: (scenario: WizardScenario) => void;
}): React.ReactElement {
  const [selectedScenario, setSelectedScenario] = useState<WizardScenario | null>(null);
  const [step, setStep] = useState(0);
  const labels = UI_TEXT[language];

  const scenario = selectedScenario ? STEPS[selectedScenario][language] : null;
  const currentStep = scenario ? scenario[step] : null;
  const totalSteps = scenario?.length ?? 0;

  const reset = (): void => {
    setSelectedScenario(null);
    setStep(0);
  };

  const complete = (): void => {
    if (selectedScenario) {
      onScenarioComplete?.(selectedScenario);
    }
    onClose();
  };

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true" aria-label={labels.wizardTitle}>
      <div className="wizard-dialog">
        <div className="wizard-header">
          <h2>{labels.wizardTitle}</h2>
          <button type="button" onClick={onClose} aria-label={labels.wizardClose} className="wizard-close">
            <X size={18} />
          </button>
        </div>

        {!selectedScenario ? (
          <div className="wizard-scenario-select">
            <p className="wizard-prompt">{labels.chooseScenario}</p>
            <div className="wizard-scenario-grid">
              {SCENARIOS.map((scenarioItem) => (
                <button
                  key={scenarioItem.id}
                  type="button"
                  className="wizard-scenario-card"
                  onClick={() => { setSelectedScenario(scenarioItem.id); setStep(0); }}
                >
                  <div className="wizard-scenario-icon">{scenarioItem.icon}</div>
                  <div className="wizard-scenario-title">{scenarioItem.title[language]}</div>
                  <div className="wizard-scenario-desc">{scenarioItem.description[language]}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="wizard-step-view">
            <div className="wizard-progress">
              {scenario?.map((_, index) => (
                <div key={index} className={`wizard-progress-dot ${index <= step ? 'active' : ''}`} />
              ))}
            </div>

            <div className="wizard-step-counter">
              {labels.wizardStep} {step + 1} {labels.wizardOf} {totalSteps}
            </div>

            {currentStep ? (
              <>
                <h3>{currentStep.title}</h3>
                <p>{currentStep.body}</p>
              </>
            ) : null}

            <div className="wizard-actions">
              <button type="button" onClick={reset}>{labels.previous}</button>
              {step < totalSteps - 1 ? (
                <button type="button" onClick={() => setStep(step + 1)}>{labels.next}</button>
              ) : (
                <button type="button" onClick={complete}>{labels.wizardComplete}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
