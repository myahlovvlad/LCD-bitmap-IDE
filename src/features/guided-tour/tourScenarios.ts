/**
 * Tour scenario step definitions.
 *
 * Each step has:
 *  - title/body in 3 languages
 *  - targetTestId: data-testid of the element to spotlight (optional)
 *  - verify: predicate checked against raw project store state (null = auto-pass / informational)
 *  - hint: extra hint shown when verify fails
 */

import type { LanguageCode } from '../../renderer/types/domain';

export interface TourStep {
  title: Record<LanguageCode, string>;
  body: Record<LanguageCode, string>;
  hint?: Record<LanguageCode, string>;
  /** data-testid of the UI element to spotlight/highlight. */
  targetTestId?: string;
  /**
   * Predicate against the raw Zustand store state snapshot.
   * If null/undefined, step is purely informational and "Next" advances without check.
   */
  verify?: ((storeSnapshot: StoreSnapshot) => boolean) | null;
}

export interface StoreSnapshot {
  project: {
    fsm: {
      stateOrder: string[];
      states: Record<string, { initial: boolean; screenId?: string | null; title: string }>;
      transitionOrder: string[];
      events: Record<string, { id: string; name: string }>;
    };
    screenOrder: string[];
    screens: Record<string, { objects: { type: string }[] }>;
  } | null;
  selectedStateId: string | null;
  language: LanguageCode;
}

export const FIRST_HMI_TOUR: TourStep[] = [
  {
    title: { en: 'Welcome — your first HMI', ru: 'Добро пожаловать — первый HMI', zh: '欢迎 — 您的第一个 HMI' },
    body: {
      en: 'This guided tour will walk you through building a minimal working HMI: one state, one screen, and a running simulation. Each step gives you an instruction — perform the action in the IDE, then click "Check & Next".',
      ru: 'Это пошаговое руководство поможет вам создать минимальный рабочий HMI: одно состояние, один экран и запущенная симуляция. На каждом шаге выполняйте инструкцию в IDE, затем нажимайте «Проверить и далее».',
      zh: '本向导将引导您构建一个最小可用 HMI：一个状态、一个屏幕和一个运行中的仿真。每个步骤给出操作指令，在 IDE 中执行后点击"检查并继续"。'
    },
    verify: null
  },
  {
    title: { en: 'Open the FSM editor', ru: 'Откройте FSM-редактор', zh: '打开 FSM 编辑器' },
    body: {
      en: 'Click the "FSM editor" tab in the top navigation bar.',
      ru: 'Нажмите вкладку «FSM-редактор» в верхней панели навигации.',
      zh: '点击顶部导航栏中的"FSM 编辑器"选项卡。'
    },
    targetTestId: 'workspace-fsm',
    verify: null
  },
  {
    title: { en: 'Create a state', ru: 'Создайте состояние', zh: '创建一个状态' },
    body: {
      en: 'Click the "+" button in the States sidebar (top-left of the FSM editor). A new state "State 1" will appear on the canvas.',
      ru: 'Нажмите кнопку «+» в боковой панели States (верхний левый угол FSM-редактора). На холсте появится новое состояние «State 1».',
      zh: '点击 FSM 编辑器左上角 States 侧边栏中的"+"按钮。画布上将出现新状态"State 1"。'
    },
    targetTestId: 'fsm-add-state',
    hint: {
      en: 'Look for the "+" button next to "States" in the left sidebar.',
      ru: 'Ищите кнопку «+» рядом с надписью «States» в левой панели.',
      zh: '在左侧边栏中查找"States"旁边的"+"按钮。'
    },
    verify: (s) => (s.project?.fsm.stateOrder.length ?? 0) > 0
  },
  {
    title: { en: 'Mark it as the initial state', ru: 'Пометьте как начальное состояние', zh: '标记为初始状态' },
    body: {
      en: 'Click the new state in the canvas or sidebar, then check the "Initial state" checkbox in the right inspector panel. You can also click "Fix: mark first state as initial" in the FSM validation panel below the States list.',
      ru: 'Нажмите на новое состояние на холсте или в боковой панели, затем отметьте чекбокс «Начальное состояние» в правой панели инспектора. Или нажмите «Fix: mark first state as initial» в панели FSM validation.',
      zh: '在画布或侧边栏中点击新状态，然后在右侧检查器面板中勾选"初始状态"复选框。您也可以点击 FSM 验证面板中的"Fix: mark first state as initial"。'
    },
    hint: {
      en: 'Select the state, then look for "Initial state" checkbox in the right panel.',
      ru: 'Выберите состояние, затем найдите чекбокс «Начальное состояние» в правой панели.',
      zh: '选择状态，然后在右侧面板中查找"初始状态"复选框。'
    },
    verify: (s) => Object.values(s.project?.fsm.states ?? {}).some((st) => st.initial)
  },
  {
    title: { en: 'Open the LCD editor', ru: 'Откройте LCD-редактор', zh: '打开 LCD 编辑器' },
    body: {
      en: 'Click the "LCD editor" tab. You\'ll see the screen linked to the state you created. Now add something to it.',
      ru: 'Нажмите вкладку «LCD-редактор». Вы увидите экран, связанный с созданным состоянием. Теперь добавьте на него что-нибудь.',
      zh: '点击"LCD 编辑器"选项卡。您将看到与创建的状态关联的屏幕。现在在其上添加一些内容。'
    },
    targetTestId: 'workspace-lcd',
    verify: null
  },
  {
    title: { en: 'Draw a text element', ru: 'Нарисуйте текстовый элемент', zh: '绘制一个文本元素' },
    body: {
      en: 'Click "Add text" in the Canvas tools, then click anywhere on the LCD display to place a text object. Type something (e.g. "Hello"). The screen should now have at least one object.',
      ru: 'Нажмите «Добавить текст» в инструментах холста, затем кликните в любом месте LCD-дисплея для размещения текстового объекта. Введите что-нибудь (например, «Hello»). На экране должен появиться хотя бы один объект.',
      zh: '在画布工具中点击"添加文本"，然后点击 LCD 显示屏上的任意位置放置文本对象。输入一些内容（如"Hello"）。屏幕上现在应该至少有一个对象。'
    },
    hint: {
      en: 'Use the "Add text" button in the tools panel on the left.',
      ru: 'Используйте кнопку «Добавить текст» в панели инструментов слева.',
      zh: '使用左侧工具面板中的"添加文本"按钮。'
    },
    verify: (s) => {
      const project = s.project;
      if (!project) return false;
      return project.screenOrder.some((id) => (project.screens[id]?.objects.length ?? 0) > 0);
    }
  },
  {
    title: { en: 'Open the Runtime workspace', ru: 'Откройте рабочую область Выполнение', zh: '打开运行时工作区' },
    body: {
      en: 'Click the "Runtime" tab in the top navigation. This is the full simulation engine where you can run the FSM, fire events, and see the live LCD display.',
      ru: 'Нажмите вкладку «Выполнение» в верхней навигации. Это полный движок симуляции — здесь можно запустить FSM, генерировать события и видеть живой LCD-дисплей.',
      zh: '点击顶部导航中的"运行时"选项卡。这是完整的仿真引擎，您可以运行 FSM、触发事件并查看实时 LCD 显示。'
    },
    targetTestId: 'workspace-runtime',
    verify: null
  },
  {
    title: { en: 'Congratulations!', ru: 'Поздравляем!', zh: '恭喜！' },
    body: {
      en: 'You\'ve built your first minimal HMI: an FSM state, a linked LCD screen with content, and a simulation. From here: add more states, connect them with transitions, add tags to display live measurements, and configure alarm conditions.',
      ru: 'Вы создали свой первый минимальный HMI: FSM-состояние, связанный LCD-экран с содержимым и симуляцию. Далее: добавляйте больше состояний, соединяйте их переходами, добавляйте теги для отображения живых измерений и настраивайте условия аварий.',
      zh: '您已经构建了第一个最小 HMI：一个 FSM 状态、带内容的关联 LCD 屏幕和仿真。接下来：添加更多状态，用转换连接它们，添加标签显示实时测量值，并配置报警条件。'
    },
    verify: null
  }
];
