import type { IpcMain } from 'electron';
import {
  SPECTRO_SERIAL_CLOSE_CHANNEL,
  SPECTRO_SERIAL_COMMAND_CHANNEL,
  SPECTRO_SERIAL_LIST_CHANNEL,
  SPECTRO_SERIAL_OPEN_CHANNEL,
  SPECTRO_SERIAL_STATUS_CHANNEL
} from '../../shared/spectrophotometerSerial/channels.js';
import type { SpectroSerialCommandRequest } from '../../shared/spectrophotometerSerial/contracts.js';
import { EcrosSerialService } from './EcrosSerialService.js';

export function registerSpectrophotometerSerialHandlers(ipcMain: IpcMain): EcrosSerialService {
  const service = new EcrosSerialService();
  ipcMain.handle(SPECTRO_SERIAL_LIST_CHANNEL, () => service.listPorts());
  ipcMain.handle(SPECTRO_SERIAL_OPEN_CHANNEL, (_event, path: unknown) => {
    if (typeof path !== 'string' || path.length > 260) {
      throw new Error('Invalid serial port path.');
    }
    return service.open(path);
  });
  ipcMain.handle(SPECTRO_SERIAL_CLOSE_CHANNEL, () => service.close());
  ipcMain.handle(SPECTRO_SERIAL_STATUS_CHANNEL, () => service.status());
  ipcMain.handle(SPECTRO_SERIAL_COMMAND_CHANNEL, (_event, request: unknown) => {
    if (!isCommandRequest(request)) {
      throw new Error('Invalid ECROS serial command request.');
    }
    return service.send(request);
  });
  return service;
}

function isCommandRequest(value: unknown): value is SpectroSerialCommandRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Record<string, unknown>;
  return typeof request.commandId === 'string' &&
    request.commandId.length <= 64 &&
    (request.argument === undefined || typeof request.argument === 'string' || typeof request.argument === 'number');
}
