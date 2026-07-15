import { exportSessionScreenInterchange } from '../screenInterchangeFacade';
import type { ProjectSession } from '../projectSession';
import {
  screenInterchangeToDslDocument,
  writeCanonicalScreenDslJson,
  writeCanonicalScreenDslYaml
} from '../../screen-dsl';
import type { ScreenDslTextFormat } from './contracts';

export function exportScreenDsl(
  session: ProjectSession,
  format: ScreenDslTextFormat,
  screenIds?: readonly string[]
): string {
  const document = screenInterchangeToDslDocument(exportSessionScreenInterchange(session, screenIds).package);
  return format === 'json'
    ? writeCanonicalScreenDslJson(document)
    : writeCanonicalScreenDslYaml(document);
}
