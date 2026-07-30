import type { ITransport, TransportResult } from '../services/runtime/ITransport';
import {
  ECROS_FILTERS,
  selectEcrosFilterForWavelength,
  type EcrosFilterId
} from './ecrosProfiles';

export type EcrosLampId = 1 | 2;

export interface Ecros5501OperationalState {
  connected: boolean;
  wavelengthNm: number;
  gratingWavelengthNm: number;
  filterId: EcrosFilterId;
  lampSwitchWavelengthNm: number;
  selectedLampId: EcrosLampId;
  tungstenLampOn: boolean;
  deuteriumLampOn: boolean;
  gain: number;
  referenceGain: number;
  slitWidthNm: number;
  autosamplerInstalled: boolean;
  samplerPosition: number | null;
  serialNumber: string;
  softwareVersion: string;
  hardwareVersion: string;
  referenceAdc: number;
  sampleAdc: number;
  darkAdcByGain: number[];
}

export interface EcrosSimulationResult {
  response: string;
  operations: readonly string[];
  state: Readonly<Ecros5501OperationalState>;
}

const DEFAULT_DARK = [55, 102, 202, 399, 771, 1440, 2510, 4238];

export function createEcros5501InitialState(
  overrides: Partial<Ecros5501OperationalState> = {}
): Ecros5501OperationalState {
  return {
    connected: false,
    wavelengthNm: 546,
    gratingWavelengthNm: 546,
    filterId: 8,
    lampSwitchWavelengthNm: 340,
    selectedLampId: 1,
    tungstenLampOn: true,
    deuteriumLampOn: false,
    gain: 2,
    referenceGain: 2,
    slitWidthNm: 1.8,
    autosamplerInstalled: false,
    samplerPosition: null,
    serialNumber: 'ECROS-5501_1',
    softwareVersion: '2.2.29',
    hardwareVersion: 'R0A',
    referenceAdc: 24818,
    sampleAdc: 24843,
    darkAdcByGain: [...DEFAULT_DARK],
    ...overrides
  };
}

export class Ecros5501OperationalSimulator {
  readonly state: Ecros5501OperationalState;

  constructor(overrides: Partial<Ecros5501OperationalState> = {}) {
    this.state = createEcros5501InitialState(overrides);
  }

  execute(rawCommand: string): EcrosSimulationResult {
    const trimmed = rawCommand.trim();
    const [commandId = '', ...argumentParts] = trimmed.split(/\s+/);
    const argument = argumentParts.join(' ');
    const operations: string[] = [];

    if (!commandId) {
      throw new Error('ECROS command is empty.');
    }
    if (commandId !== 'connect' && !this.state.connected) {
      throw new Error(`Command "${commandId}" requires an active CLI connection.`);
    }

    let response = '';
    switch (commandId) {
      case 'connect':
        this.state.connected = true;
        response = 'ok.';
        operations.push('CLI session connected');
        break;
      case 'quit':
        this.state.connected = false;
        operations.push('CLI session disconnected');
        break;
      case 'rezero':
        response = `${this.state.referenceAdc}\r\n${this.state.gain}`;
        operations.push('Stored current signal as 100 %T / A=0');
        break;
      case 'getdark':
        response = this.state.darkAdcByGain.join('\r\n');
        operations.push('Read stored dark current for gain 1–8');
        break;
      case 'resetdark': {
        const previousFilter = this.state.filterId;
        this.state.filterId = 3;
        operations.push('Filter wheel → 3 (shutter)');
        this.state.darkAdcByGain = [...DEFAULT_DARK];
        operations.push('Measured dark current for gain 1–8');
        this.state.filterId = previousFilter;
        operations.push(`Filter wheel restored → ${previousFilter}`);
        response = this.state.darkAdcByGain.join('\r\n');
        break;
      }
      case 'ge': {
        const count = parseIntegerArgument(commandId, argument, 1, 1000);
        response = Array.from({ length: count }, () => String(this.state.sampleAdc)).join('\r\n');
        operations.push(`Read sample energy ${count} time(s) at gain ${this.state.gain}`);
        break;
      }
      case 'swl': {
        const wavelength = parseNumberArgument(commandId, argument, 190, 1100);
        this.state.wavelengthNm = wavelength;
        this.state.gratingWavelengthNm = wavelength;
        this.state.filterId = selectEcrosFilterForWavelength(wavelength);
        operations.push(`Diffraction grating → ${wavelength} nm`);
        operations.push(`Filter wheel → ${this.state.filterId} (${ECROS_FILTERS[this.state.filterId].labelRu})`);
        break;
      }
      case 'swm': {
        const wavelength = parseNumberArgument(commandId, argument, 190, 1100);
        this.state.gratingWavelengthNm = wavelength;
        operations.push(`Diffraction grating only → ${wavelength} nm`);
        operations.push(`Filter wheel unchanged → ${this.state.filterId}`);
        break;
      }
      case 'getwl':
        response = formatNumber(this.state.wavelengthNm);
        break;
      case 'sa':
        this.state.gain = parseIntegerArgument(commandId, argument, 1, 8);
        operations.push(`Sample gain → ${this.state.gain}`);
        break;
      case 'ga':
        response = String(this.state.gain);
        break;
      case 'sr':
        this.state.referenceGain = parseIntegerArgument(commandId, argument, 1, 3);
        operations.push(`Reference gain → ${this.state.referenceGain}`);
        break;
      case 'gr':
        response = String(this.state.referenceGain);
        break;
      case 'setlampwl':
        this.state.lampSwitchWavelengthNm = parseNumberArgument(commandId, argument, 300, 400);
        operations.push(`Lamp switch wavelength → ${this.state.lampSwitchWavelengthNm} nm`);
        break;
      case 'getlampwl':
        response = formatNumber(this.state.lampSwitchWavelengthNm);
        break;
      case 'wuon':
        this.state.tungstenLampOn = true;
        operations.push('Tungsten lamp on');
        break;
      case 'wuoff':
        this.state.tungstenLampOn = false;
        operations.push('Tungsten lamp off');
        break;
      case 'd2on':
        this.state.deuteriumLampOn = true;
        operations.push('Deuterium lamp on');
        break;
      case 'd2off':
        this.state.deuteriumLampOn = false;
        operations.push('Deuterium lamp off');
        break;
      case 'getd2':
        response = this.state.deuteriumLampOn ? '1' : '0';
        break;
      case 'getwu':
        response = this.state.tungstenLampOn ? '1' : '0';
        break;
      case 'setfilter':
        this.state.filterId = parseIntegerArgument(commandId, argument, 1, 8) as EcrosFilterId;
        operations.push(`Filter wheel → ${this.state.filterId} (${ECROS_FILTERS[this.state.filterId].labelRu})`);
        break;
      case 'setlamp':
        this.state.selectedLampId = parseIntegerArgument(commandId, argument, 1, 2) as EcrosLampId;
        operations.push(this.state.selectedLampId === 1
          ? 'Optical path → tungsten lamp'
          : 'Optical path → deuterium lamp');
        break;
      case 'adjustwl':
        this.state.deuteriumLampOn = true;
        operations.push('Deuterium lamp on');
        this.state.gratingWavelengthNm = 651.1;
        this.state.filterId = 4;
        operations.push('Calibration line search → 651.1 nm; filter wheel → open');
        operations.push('Wavelength zero position detected');
        this.state.wavelengthNm = 546;
        this.state.gratingWavelengthNm = 546;
        this.state.filterId = 8;
        operations.push('Working wavelength → 546 nm; filter wheel → 8 (green)');
        break;
      case 'startwl':
        response = '190.0';
        break;
      case 'endwl':
        response = '1100.0';
        break;
      case 'getslit':
        response = formatNumber(this.state.slitWidthNm);
        break;
      case 'getslittype':
        response = '1';
        break;
      case 'setslit':
        throw new Error('ECROS-5501 has a fixed 1.8 nm slit; setslit is unavailable.');
      case 'getsamplertype':
        response = this.state.autosamplerInstalled ? '1' : '0';
        break;
      case 'getsampler':
        response = this.state.autosamplerInstalled && this.state.samplerPosition
          ? String(this.state.samplerPosition)
          : '0';
        break;
      case 'setsampler':
        if (!this.state.autosamplerInstalled) {
          throw new Error('Automatic cuvette holder is not installed.');
        }
        this.state.samplerPosition = parseIntegerArgument(commandId, argument, 1, 8);
        operations.push(`Automatic cuvette holder → position ${this.state.samplerPosition}`);
        break;
      case 'gettype':
        response = 'ECROS-5501';
        break;
      case 'getsoftver':
        response = this.state.softwareVersion;
        break;
      case 'gethardver':
        response = this.state.hardwareVersion;
        break;
      case 'getsn':
        response = this.state.serialNumber;
        break;
      case 'setsn':
        if (!argument.trim()) throw new Error('Command "setsn" requires a serial number.');
        this.state.serialNumber = argument.trim();
        operations.push(`Serial number → ${this.state.serialNumber}`);
        break;
      case 'company':
        response = 'METASH Instrument';
        break;
      case 'help':
        response = 'connect quit rezero getdark resetdark ge swl getwl sa ga sr gr setlampwl wuon wuoff d2on d2off gettype setfilter setlamp getlampwl getd2 getwu getsoftver gethardver swm adjustwl startwl endwl getslit getsampler setslit setsampler getslittype getsamplertype setsn getsn udb cap help company boot';
        break;
      case 'udb':
      case 'cap':
        operations.push(`${commandId} requested`);
        break;
      case 'boot':
        Object.assign(this.state, createEcros5501InitialState());
        operations.push('Instrument rebooted; CLI session disconnected');
        break;
      default:
        throw new Error(`Unknown ECROS-5501 command "${commandId}".`);
    }

    return { response, operations, state: this.state };
  }
}

export interface Ecros5501SimulationTransportOptions {
  startConnected?: boolean;
}

export class Ecros5501SimulationTransport implements ITransport {
  readonly kind = 'simulation' as const;
  readonly simulator: Ecros5501OperationalSimulator;

  constructor(options: Ecros5501SimulationTransportOptions = {}) {
    this.simulator = new Ecros5501OperationalSimulator({
      connected: options.startConnected ?? true
    });
  }

  isConnected(): boolean {
    return this.simulator.state.connected;
  }

  async sendCommand(command: string): Promise<TransportResult> {
    try {
      const result = this.simulator.execute(command);
      return { ok: true, response: result.response || 'ok.' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        retriable: false
      };
    }
  }
}

function parseNumberArgument(command: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Command "${command}" requires a number from ${min} to ${max}.`);
  }
  return value;
}

function parseIntegerArgument(command: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Command "${command}" requires an integer from ${min} to ${max}.`);
  }
  return value;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
