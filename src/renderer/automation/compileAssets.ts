import { useProjectStore } from '../store/projectStore';
import {
  EMBEDDED_FORMAT_EXTENSIONS,
  exportScreenEmbedded,
  type EmbeddedExportFormat
} from '../utils/codegen';

export interface CompiledAutomationArtifact {
  screenId: string;
  filename: string;
  format: string;
  content: string;
  encoding: 'utf8' | 'base64';
}

export function compileAssetsForAutomation(body: Record<string, unknown>): { artifacts: CompiledAutomationArtifact[] } {
  const store = useProjectStore.getState();
  const project = store.project;
  if (!project) throw new Error('No project loaded');

  const format = (body.format as EmbeddedExportFormat) ?? 'c-vertical-lsb';
  const scope = (body.scope as string) ?? 'all-screens';
  const requestedScreenId = body.screenId as string | undefined;
  const targetScreenIds = scope === 'selected-screen'
    ? [requestedScreenId ?? store.selectedScreenId ?? project.screenOrder[0]].filter((id): id is string => Boolean(id))
    : project.screenOrder;

  if (targetScreenIds.length === 0) throw new Error('No LCD screens available to compile');

  return {
    artifacts: targetScreenIds.map((screenId) => {
      const screen = project.screens[screenId];
      if (!screen) throw new Error(`Screen not found: ${screenId}`);
      const symbolName = `${project.meta.name}_${screen.name || screen.id}_screen`;
      const result = exportScreenEmbedded(screen.objects, format, {
        symbolName,
        language: project.authoringLanguage ?? store.language,
        width: screen.width,
        height: screen.height
      });
      const ext = EMBEDDED_FORMAT_EXTENSIONS[format] ?? 'h';
      if (typeof result === 'string') {
        return { screenId, filename: `${screen.id}_screen.${ext}`, format, content: result, encoding: 'utf8' as const };
      }
      return {
        screenId,
        filename: `${screen.id}_screen.${ext}`,
        format,
        content: uint8ArrayToBase64(result),
        encoding: 'base64' as const
      };
    })
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}
