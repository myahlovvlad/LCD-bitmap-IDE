import type {
  SemanticInputKind,
  SemanticStateCandidate,
  SemanticStateClassification,
  SemanticWorkflowDefinition,
  SemanticWorkflowStep
} from '../../../domain/semanticIndex';

const KNOWN_PREFIX = /^(?:DIAG_|MAINMNU_|PHOT_|QUANT_|QC_|KIN_|MW_|FILE_|SET_|P_|Q_|K_|F_|S_|INIT$|SELFTEST$|WARMUP$|MAIN$)/i;

function sourceText(candidate: SemanticStateCandidate): string {
  return `${candidate.id} ${candidate.title} ${candidate.subsystem ?? ''}`.toLowerCase().replace(/ё/g, 'е');
}

function modeFor(text: string, id: string): SemanticStateClassification['mode'] {
  if (/^(?:phot_|p_)/i.test(id) || /photometry|фотометр/.test(text)) return 'photometry';
  if (/^(?:quant_|qc_|q_)/i.test(id) || /quantitative|количеств|calibration|градуир|coefficient|коэффициент/.test(text)) return 'quantitative';
  if (/^(?:kin_|k_)/i.test(id) || /kinetic|кинетик/.test(text)) return 'kinetics';
  if (/^(?:mw_)/i.test(id) || /multiwavelength|multiwave|многоволн/.test(text)) return 'multiwave';
  return null;
}

function quantityFor(text: string, id: string, mode: SemanticStateClassification['mode']): SemanticStateClassification['quantity'] {
  if (mode === 'quantitative' && /analyte|concentr|концентр|quantitative.*meas|количеств.*измер/.test(text)) return 'C';
  if (/(?:^|[_-])a(?:[_-]|$)/i.test(id) || /absorbance|оптическ.*плотност/.test(text)) return 'A';
  if (/(?:^|[_-])e(?:[_-]|$)/i.test(id) || /photometry[-_ ]?e/.test(text)) return 'E';
  if (/(?:^|[_-])t(?:[_-]|$)/i.test(id) || /%t|transmittance|пропускан/.test(text)) return '%T';
  return null;
}

function inputKindFor(text: string): SemanticInputKind {
  if (/filename|file name|имя файла|[_ -]name(?:[_ -]|$)/.test(text)) return 'text.filename';
  if (/wavelength|input[_ -]?wl|длин[аы] волн|λ/.test(text)) return 'numeric.wavelength';
  if (/parall|parallel|паралл/.test(text)) return 'numeric.parallel_count';
  if (/gain|усилен/.test(text)) return 'numeric.gain';
  if (/coefficient|коэффициент|coef/.test(text)) return 'numeric.coefficient';
  if (/concentration|концентр|[_ -]conc(?:[_ -]|$)/.test(text)) return 'numeric.concentration';
  return null;
}

export function classifyEcros5400State(candidate: SemanticStateCandidate): SemanticStateClassification {
  const text = sourceText(candidate);
  const mode = modeFor(text, candidate.id);
  const inputKind = inputKindFor(text);
  const startup = /init|self.?test|self diagnostic|самодиаг|diagnostic|diag_|warm|прогрев|waiting/.test(text);
  const files = /^(?:file_|f_)/i.test(candidate.id) || /file group|storage|файл|usb.*storage/.test(text);
  const settings = /^(?:set_|s_)/i.test(candidate.id) || /settings|setup|настрой/.test(text);
  const mainMenu = /main menu|главн.*меню|^main$/.test(text.trim()) || /^(?:MAIN|MAINMNU_)/i.test(candidate.id);

  let domain: SemanticStateClassification['domain'] = 'unknown';
  if (startup) domain = 'startup';
  else if (mode) domain = 'measurement';
  else if (files) domain = 'files';
  else if (settings) domain = 'settings';
  else if (mainMenu) domain = 'navigation';
  else if (/printer|usb|pc |alarm|error|ошиб/.test(text)) domain = 'auxiliary';

  let phase: SemanticStateClassification['phase'] = 'unknown';
  if (startup && /warm|прогрев|waiting/.test(text)) phase = 'warmup';
  else if (startup) phase = 'diagnostic';
  else if (mainMenu) phase = 'navigation';
  else if (/zero|нол/.test(text)) phase = 'zeroing';
  else if (/measure|measurement|измер/.test(text) && !/parallel|паралл/.test(text)) phase = 'measurement';
  else if (/print|печат/.test(text)) phase = 'print';
  else if (/result|результ/.test(text)) phase = 'results';
  else if (/save|storage|filename|file name|сохран|место сохран|имя файла/.test(text)) phase = 'save';
  else if (files) phase = 'file';
  else if (settings) phase = 'settings';
  else if (mode && (/param|parall|parallel|input|setup|wavelength|gain|coef|concentr|парамет|ввод|градуир/.test(text) || inputKind)) phase = 'configuration';
  else if (mode) phase = 'navigation';

  let operation = 'unknown';
  if (phase === 'diagnostic') operation = 'startup.self_diagnostic';
  else if (phase === 'warmup') operation = 'startup.warmup';
  else if (phase === 'zeroing') operation = 'measurement.zero';
  else if (phase === 'measurement') operation = mode === 'quantitative' && /calibr|градуир|qc_/.test(text) ? 'calibration.measure' : 'measurement.measure';
  else if (inputKind === 'numeric.wavelength') operation = 'input.wavelength';
  else if (inputKind === 'numeric.parallel_count') operation = 'input.parallel_count';
  else if (inputKind === 'numeric.gain') operation = 'input.gain';
  else if (inputKind === 'numeric.coefficient') operation = 'input.coefficient';
  else if (inputKind === 'numeric.concentration') operation = 'input.concentration';
  else if (inputKind === 'text.filename') operation = 'input.filename';
  else if (phase === 'results') operation = 'result.view';
  else if (phase === 'print') operation = 'result.print';
  else if (phase === 'save') operation = 'result.save';
  else if (phase === 'file') operation = /calibr|градуир/.test(text) ? 'file.open_calibration' : /result|результ/.test(text) ? 'file.open_result' : 'files.navigate';
  else if (phase === 'settings') operation = 'settings.configure';
  else if (mode && /param|парамет/.test(text)) operation = 'parameters.configure';
  else if (domain === 'navigation') operation = 'navigation.menu';
  else if (mode) operation = 'measurement.ready';

  return {
    domain,
    mode,
    phase,
    operation,
    quantity: quantityFor(text, candidate.id, mode),
    inputKind,
    longRunning: phase === 'measurement' || phase === 'zeroing' || phase === 'diagnostic' || phase === 'warmup',
    confidence: KNOWN_PREFIX.test(candidate.id) ? 'exact' : domain === 'unknown' ? 'unknown' : 'derived'
  };
}

export function globalEcros5400EventIntent(eventId: string): string {
  if (/^UI\.K(?:[0-9]|9A|9B)$/.test(eventId)) return 'input.append_digit';
  switch (eventId) {
    case 'UI.MINUS': return 'input.toggle_sign';
    case 'UI.DOT': return 'input.append_decimal';
    case 'UI.ZERO': return 'measurement.zero';
    case 'UI.WL': return 'input.wavelength.open';
    case 'UI.PAR': return 'parameters.open';
    case 'UI.FILE': return 'files.open';
    case 'UI.PRN': return 'result.print';
    case 'UI.CLR': return 'result.clear_selected';
    case 'UI.UP': return 'selection.previous';
    case 'UI.DOWN': return 'selection.next';
    case 'UI.ESC': return 'navigation.cancel';
    case 'UI.OK': return 'navigation.confirm';
    case 'UI.RUN': return 'measurement.start_or_pause';
    case 'SYS.AUTO': return 'system.auto';
    case 'SYS.ERR': return 'system.error';
    default: return 'event.trigger';
  }
}

export function resolveEcros5400EventIntent(
  eventId: string,
  source: SemanticStateClassification,
  target: SemanticStateClassification
): string {
  if (eventId === 'UI.OK' && (source.inputKind || target.inputKind)) return 'input.confirm';
  if (eventId === 'UI.FILE') {
    if (source.phase === 'results' || target.phase === 'save') return 'result.save';
    return 'files.open';
  }
  if (eventId === 'UI.RUN') {
    if (source.phase === 'measurement' && target.phase === 'measurement') return 'measurement.pause_or_resume';
    if (target.phase === 'measurement') return 'measurement.start';
    return 'measurement.start_or_pause';
  }
  return globalEcros5400EventIntent(eventId);
}

interface ClassifiedCandidate extends SemanticStateCandidate {
  classification: SemanticStateClassification;
}

function step(id: string, title: string, operation: string, states: ClassifiedCandidate[], predicate: (state: ClassifiedCandidate) => boolean, next: string[] = [], branch?: string): SemanticWorkflowStep {
  const matches = states.filter(predicate);
  return {
    id,
    title,
    operation,
    stateIds: matches.map((item) => item.id).sort(),
    screenIds: matches.map((item) => item.screenId).filter((value): value is string => Boolean(value)).sort(),
    next,
    ...(branch ? { branch } : {})
  };
}

function contains(state: ClassifiedCandidate, pattern: RegExp): boolean {
  return pattern.test(sourceText(state));
}

export function buildEcros5400WorkflowDefinitions(candidates: SemanticStateCandidate[]): SemanticWorkflowDefinition[] {
  const states: ClassifiedCandidate[] = candidates.map((candidate) => ({ ...candidate, classification: classifyEcros5400State(candidate) }));
  const byMode = (mode: SemanticStateClassification['mode']) => (state: ClassifiedCandidate) => state.classification.mode === mode;
  const quantity = (mode: SemanticStateClassification['mode'], phase: SemanticStateClassification['phase'], q: SemanticStateClassification['quantity']) =>
    (state: ClassifiedCandidate) => state.classification.mode === mode && state.classification.phase === phase && state.classification.quantity === q;

  const photometrySteps: SemanticWorkflowStep[] = [
    step('open', 'Open Photometry', 'measurement.open', states, (s) => byMode('photometry')(s) && s.classification.phase === 'navigation', ['parameters']),
    step('parameters', 'Photometry parameters', 'parameters.configure', states, (s) => byMode('photometry')(s) && s.classification.phase === 'configuration' && !s.classification.inputKind, ['wavelength', 'zero.A', 'zero.E', 'zero.T']),
    step('wavelength', 'Wavelength input', 'input.wavelength', states, (s) => byMode('photometry')(s) && s.classification.inputKind === 'numeric.wavelength', ['zero.A', 'zero.E', 'zero.T']),
    step('zero.A', 'Zero A', 'measurement.zero', states, quantity('photometry', 'zeroing', 'A'), ['measure.A'], 'A'),
    step('measure.A', 'Measure A', 'measurement.measure', states, quantity('photometry', 'measurement', 'A'), ['results'], 'A'),
    step('zero.E', 'Zero E', 'measurement.zero', states, quantity('photometry', 'zeroing', 'E'), ['measure.E'], 'E'),
    step('measure.E', 'Measure E', 'measurement.measure', states, quantity('photometry', 'measurement', 'E'), ['results'], 'E'),
    step('zero.T', 'Zero %T', 'measurement.zero', states, quantity('photometry', 'zeroing', '%T'), ['measure.T'], '%T'),
    step('measure.T', 'Measure %T', 'measurement.measure', states, quantity('photometry', 'measurement', '%T'), ['results'], '%T'),
    step('results', 'Photometry results', 'result.view', states, (s) => byMode('photometry')(s) && s.classification.phase === 'results', ['save']),
    step('save', 'Save Photometry result', 'result.save', states, (s) => byMode('photometry')(s) && s.classification.phase === 'save')
  ];

  const quantitative = (id: string, title: string, selector: RegExp): SemanticWorkflowDefinition => ({
    id,
    title,
    mode: 'quantitative',
    steps: [
      step('select', 'Select quantitative submode', 'measurement.open', states, (s) => byMode('quantitative')(s) && contains(s, selector), ['parameters']),
      step('parameters', 'Configure parallel measurements', 'input.parallel_count', states, (s) => byMode('quantitative')(s) && s.classification.inputKind === 'numeric.parallel_count' && (contains(s, selector) || id.includes('load_calibration')), ['zero']),
      step('calibration', 'Calibration setup/measurement', 'calibration.measure', states, (s) => byMode('quantitative')(s) && /calibr|градуир|qc_/.test(sourceText(s)) && (id.includes('new_calibration') || contains(s, selector)), ['zero']),
      step('coefficient', 'Coefficient input', 'input.coefficient', states, (s) => byMode('quantitative')(s) && s.classification.inputKind === 'numeric.coefficient' && id.includes('coefficients.create'), ['zero']),
      step('zero', 'Zero analyte', 'measurement.zero', states, (s) => byMode('quantitative')(s) && s.classification.phase === 'zeroing' && !/calibr|градуир|qc_/.test(sourceText(s)), ['measure']),
      step('measure', 'Measure analyte', 'measurement.measure', states, (s) => byMode('quantitative')(s) && s.classification.phase === 'measurement' && !/calibr|градуир|qc_/.test(sourceText(s)), ['results']),
      step('results', 'Quantitative results', 'result.view', states, (s) => byMode('quantitative')(s) && s.classification.phase === 'results', ['save']),
      step('save', 'Save quantitative results', 'result.save', states, (s) => byMode('quantitative')(s) && s.classification.phase === 'save')
    ]
  });

  const simpleMeasurementWorkflow = (id: string, title: string, mode: 'kinetics' | 'multiwave'): SemanticWorkflowDefinition => ({
    id, title, mode,
    steps: [
      step('parameters', `${title} parameters`, 'parameters.configure', states, (s) => byMode(mode)(s) && s.classification.phase === 'configuration', ['zero.A', 'zero.T']),
      step('zero.A', 'Zero A', 'measurement.zero', states, quantity(mode, 'zeroing', 'A'), ['measure.A'], 'A'),
      step('measure.A', 'Measure A', 'measurement.measure', states, quantity(mode, 'measurement', 'A'), ['results'], 'A'),
      step('zero.T', 'Zero %T', 'measurement.zero', states, quantity(mode, 'zeroing', '%T'), ['measure.T'], '%T'),
      step('measure.T', 'Measure %T', 'measurement.measure', states, quantity(mode, 'measurement', '%T'), ['results'], '%T'),
      step('measure', 'Measure', 'measurement.measure', states, (s) => byMode(mode)(s) && s.classification.phase === 'measurement' && !s.classification.quantity, ['results']),
      step('results', `${title} results`, 'result.view', states, (s) => byMode(mode)(s) && s.classification.phase === 'results', ['save']),
      step('save', `Save ${title} result`, 'result.save', states, (s) => byMode(mode)(s) && s.classification.phase === 'save')
    ]
  });

  const workflows: SemanticWorkflowDefinition[] = [
    {
      id: 'startup.standard', title: 'Startup', mode: null,
      steps: [
        step('self_diagnostic', 'Self-diagnostic', 'startup.self_diagnostic', states, (s) => s.classification.phase === 'diagnostic', ['warmup']),
        step('warmup', 'Warm-up', 'startup.warmup', states, (s) => s.classification.phase === 'warmup', ['main_menu']),
        step('main_menu', 'Main menu', 'navigation.menu', states, (s) => s.classification.domain === 'navigation' && s.classification.phase === 'navigation')
      ]
    },
    { id: 'measurement.photometry', title: 'Photometry', mode: 'photometry', steps: photometrySteps },
    quantitative('measurement.quantitative.new_calibration', 'Quantitative — new calibration', /new.*calibr|нов.*градуир|q_new|qc_/),
    quantitative('measurement.quantitative.load_calibration', 'Quantitative — load calibration', /load.*calibr|загруз.*градуир|q_load/),
    quantitative('measurement.quantitative.coefficients.create', 'Quantitative — create coefficients', /coef.*(?:new|create|input)|коэфф.*(?:созд|ввод)|q_coef_new/),
    quantitative('measurement.quantitative.coefficients.open', 'Quantitative — open coefficients', /coef.*(?:open|file)|коэфф.*(?:откр|файл)|q_coef_open/),
    simpleMeasurementWorkflow('measurement.kinetics', 'Kinetics', 'kinetics'),
    simpleMeasurementWorkflow('measurement.multiwave', 'Multiwavelength', 'multiwave'),
    {
      id: 'files.open_result', title: 'Open result', mode: null,
      steps: [step('open_result', 'Open saved result', 'file.open_result', states, (s) => s.classification.domain === 'files' && /result|результ/.test(sourceText(s)))]
    },
    {
      id: 'files.open_calibration', title: 'Open calibration', mode: null,
      steps: [step('open_calibration', 'Open saved calibration', 'file.open_calibration', states, (s) => s.classification.domain === 'files' && /calibr|градуир|curve|crv/.test(sourceText(s)))]
    },
    {
      id: 'settings.main', title: 'Settings', mode: null,
      steps: [step('settings', 'Settings', 'settings.configure', states, (s) => s.classification.domain === 'settings')]
    }
  ];

  return workflows;
}
