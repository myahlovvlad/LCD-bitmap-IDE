export type EcrosCliResponseKind =
  | 'none'
  | 'ok'
  | 'integer'
  | 'integer-list'
  | 'number'
  | 'number-list'
  | 'text'
  | 'rezero';

export interface EcrosCliCommandContract {
  id: string;
  command: string;
  requiresConnection: boolean;
  argument?: { type: 'integer' | 'number' | 'string'; min?: number; max?: number };
  response: EcrosCliResponseKind;
  expectedLines?: number;
  description: { en: string; ru: string; zh: string };
  documented?: boolean;
}

export type EcrosParsedResponse =
  | { kind: 'none' }
  | { kind: 'ok' }
  | { kind: 'integer'; value: number }
  | { kind: 'integer-list'; values: number[] }
  | { kind: 'number'; value: number }
  | { kind: 'number-list'; values: number[] }
  | { kind: 'text'; value: string }
  | { kind: 'rezero'; referenceAdc: number; gain: number };

const command = (
  id: string,
  response: EcrosCliResponseKind,
  ru: string,
  options: Partial<Omit<EcrosCliCommandContract, 'id' | 'command' | 'response' | 'description'>> = {}
): EcrosCliCommandContract => ({
  id,
  command: id,
  response,
  requiresConnection: id !== 'connect',
  description: { en: ru, ru, zh: ru },
  documented: true,
  ...options
});

export const ECROS_CLI_COMMANDS: readonly EcrosCliCommandContract[] = [
  command('connect', 'ok', 'Подключить спектрофотометр', { requiresConnection: false }),
  command('quit', 'none', 'Разорвать соединение'),
  command('rezero', 'rezero', 'Установить 100 %T / A=0', { expectedLines: 2 }),
  command('getdark', 'integer-list', 'Получить темновой ток для gain 1–8', { expectedLines: 8 }),
  command('resetdark', 'integer-list', 'Измерить и сохранить темновой ток для gain 1–8', { expectedLines: 8 }),
  command('ge', 'integer-list', 'Измерить текущий сигнал', { argument: { type: 'integer', min: 1, max: 1000 } }),
  command('swl', 'none', 'Установить длину волны и автоматически выбрать светофильтр', { argument: { type: 'number', min: 190, max: 1100 } }),
  command('getwl', 'number', 'Получить рабочую длину волны'),
  command('sa', 'none', 'Установить ступень усиления', { argument: { type: 'integer', min: 1, max: 8 } }),
  command('ga', 'integer', 'Получить ступень усиления'),
  command('sr', 'none', 'Установить опорную ступень усиления', { argument: { type: 'integer', min: 1, max: 3 } }),
  command('gr', 'integer', 'Получить опорную ступень усиления'),
  command('setlampwl', 'none', 'Установить длину волны переключения ламп', { argument: { type: 'number', min: 300, max: 400 } }),
  command('wuon', 'none', 'Включить галогенную лампу'),
  command('wuoff', 'none', 'Выключить галогенную лампу'),
  command('d2on', 'none', 'Включить дейтериевую лампу'),
  command('d2off', 'none', 'Выключить дейтериевую лампу'),
  command('gettype', 'text', 'Получить тип прибора'),
  command('setfilter', 'none', 'Установить позицию диска светофильтров', { argument: { type: 'integer', min: 1, max: 8 } }),
  command('setlamp', 'none', 'Переключить оптический тракт на лампу', { argument: { type: 'integer', min: 1, max: 2 } }),
  command('getlampwl', 'number', 'Получить длину волны переключения ламп'),
  command('getd2', 'integer', 'Получить состояние дейтериевой лампы'),
  command('getwu', 'integer', 'Получить состояние галогенной лампы'),
  command('getsoftver', 'text', 'Получить версию прошивки'),
  command('gethardver', 'text', 'Получить версию аппаратной части'),
  command('swm', 'none', 'Повернуть только дифракционную решётку', { argument: { type: 'number', min: 190, max: 1100 } }),
  command('adjustwl', 'none', 'Выполнить калибровку длины волны по линии 651.1 нм'),
  command('startwl', 'number', 'Получить начало диапазона длин волн'),
  command('endwl', 'number', 'Получить конец диапазона длин волн'),
  command('help', 'text', 'Получить список команд'),
  command('company', 'text', 'Получить производителя'),
  command('getslit', 'number', 'Получить ширину спектральной щели'),
  command('getsampler', 'integer', 'Получить позицию автоматического кюветодержателя'),
  command('setslit', 'none', 'Установить позицию многощелевого механизма', { argument: { type: 'integer', min: 1, max: 5 } }),
  command('setsampler', 'none', 'Установить позицию автоматического кюветодержателя', { argument: { type: 'integer', min: 1, max: 8 } }),
  command('getslittype', 'integer', 'Получить число доступных щелей'),
  command('getsamplertype', 'integer', 'Получить тип кюветодержателя'),
  command('boot', 'none', 'Перезагрузить прибор'),
  command('udb', 'none', 'Обновить файл ресурсов через USB'),
  command('cap', 'none', 'Снять данные LCD-дисплея'),
  command('getsn', 'text', 'Получить серийный номер'),
  command('setsn', 'none', 'Установить серийный номер', { argument: { type: 'string' } })
];

export function buildEcrosCommand(commandId: string, argument?: string | number): string {
  const contract = ECROS_CLI_COMMANDS.find((item) => item.id === commandId);
  if (!contract) {
    throw new Error(`Unknown ECROS command "${commandId}".`);
  }
  if (!contract.argument) {
    if (argument !== undefined) {
      throw new Error(`Command "${commandId}" does not accept an argument.`);
    }
    return contract.command;
  }
  if (argument === undefined || argument === '') {
    throw new Error(`Command "${commandId}" requires an argument.`);
  }
  if (contract.argument.type === 'integer') {
    const value = typeof argument === 'number' ? argument : Number(argument);
    if (!Number.isInteger(value)) {
      throw new Error(`Command "${commandId}" requires an integer argument.`);
    }
    if (contract.argument.min !== undefined && value < contract.argument.min) {
      throw new Error(`Command "${commandId}" argument must be >= ${contract.argument.min}.`);
    }
    if (contract.argument.max !== undefined && value > contract.argument.max) {
      throw new Error(`Command "${commandId}" argument must be <= ${contract.argument.max}.`);
    }
  } else if (contract.argument.type === 'number') {
    const value = typeof argument === 'number' ? argument : Number(argument);
    if (!Number.isFinite(value)) {
      throw new Error(`Command "${commandId}" requires a numeric argument.`);
    }
    if (contract.argument.min !== undefined && value < contract.argument.min) {
      throw new Error(`Command "${commandId}" argument must be >= ${contract.argument.min}.`);
    }
    if (contract.argument.max !== undefined && value > contract.argument.max) {
      throw new Error(`Command "${commandId}" argument must be <= ${contract.argument.max}.`);
    }
  }
  return `${contract.command} ${String(argument).trim()}`;
}

export function parseEcrosResponse(commandId: string, raw: string): EcrosParsedResponse {
  const contract = ECROS_CLI_COMMANDS.find((item) => item.id === commandId);
  if (!contract) {
    throw new Error(`Unknown ECROS command "${commandId}".`);
  }
  const lines = normalizeLines(raw);
  const deviceError = lines.find((line) => /^(?:bad argument|error|failed|invalid)\b/i.test(line));
  if (deviceError) {
    throw new Error(`Command "${commandId}" failed: ${deviceError}`);
  }
  switch (contract.response) {
    case 'none':
      return { kind: 'none' };
    case 'ok':
      if (lines.join(' ').toLowerCase() !== 'ok.') {
        throw new Error(`Command "${commandId}" expected "ok.", received "${lines.join(' ')}".`);
      }
      return { kind: 'ok' };
    case 'integer':
      return { kind: 'integer', value: parseIntegerLine(lines, 0, commandId) };
    case 'integer-list': {
      if (contract.expectedLines !== undefined && lines.length !== contract.expectedLines) {
        throw new Error(`Command "${commandId}" expected ${contract.expectedLines} lines, received ${lines.length}.`);
      }
      return { kind: 'integer-list', values: lines.map((_, index) => parseIntegerLine(lines, index, commandId)) };
    }
    case 'number':
      return { kind: 'number', value: parseNumberLine(lines, 0, commandId) };
    case 'number-list': {
      if (contract.expectedLines !== undefined && lines.length !== contract.expectedLines) {
        throw new Error(`Command "${commandId}" expected ${contract.expectedLines} lines, received ${lines.length}.`);
      }
      return { kind: 'number-list', values: lines.map((_, index) => parseNumberLine(lines, index, commandId)) };
    }
    case 'text':
      return { kind: 'text', value: lines.join('\n') };
    case 'rezero':
      if (lines.length !== 2) {
        throw new Error(`Command "rezero" expected 2 lines, received ${lines.length}.`);
      }
      return {
        kind: 'rezero',
        referenceAdc: parseIntegerLine(lines, 0, commandId),
        gain: parseIntegerLine(lines, 1, commandId)
      };
  }
}

function normalizeLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('>'));
}

function parseIntegerLine(lines: readonly string[], index: number, commandId: string): number {
  const value = Number(lines[index]);
  if (!Number.isInteger(value)) {
    throw new Error(`Command "${commandId}" returned non-integer line ${index + 1}: "${lines[index] ?? ''}".`);
  }
  return value;
}

function parseNumberLine(lines: readonly string[], index: number, commandId: string): number {
  const value = Number(lines[index]);
  if (!Number.isFinite(value)) {
    throw new Error(`Command "${commandId}" returned non-numeric line ${index + 1}: "${lines[index] ?? ''}".`);
  }
  return value;
}
