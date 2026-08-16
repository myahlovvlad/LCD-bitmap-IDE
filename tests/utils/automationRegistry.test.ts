import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_COMMAND_TYPES } from '../../src/application/commandTypes';
import {
  getAutomationCapabilities,
  getMcpToolDefinitions,
  UI_AUTOMATION_PARITY
} from '../../src/shared/automation';

describe('AutomationCommandRegistry', () => {
  it('publishes unique versionable contracts for the required first milestone operations', () => {
    const definitions = getAutomationCapabilities();
    const names = definitions.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      'get_capabilities', 'get_project_revision', 'preview_changes', 'apply_changes',
      'undo_last_agent_change', 'reorder_screens', 'validate_project', 'compile_assets',
      'set_authoring_language', 'create_fsm_state', 'auto_layout_fsm',
      'upsert_tag', 'upsert_procedure', 'upsert_alarm'
    ]));
    for (const definition of definitions) {
      expect(definition.inputSchema).toMatchObject({ type: 'object' });
      expect(definition.outputSchema).toMatchObject({ type: 'object' });
      expect(definition.permission).toMatch(/^[a-z]+:[a-z]+$/);
      expect(definition.handler).not.toBe('');
    }
  });

  it('derives every Electron MCP schema from the registry and adds the common envelope', () => {
    const capabilities = getAutomationCapabilities();
    const tools = getMcpToolDefinitions();
    expect(tools.map((tool) => tool.name)).toEqual(capabilities.map((definition) => definition.name));
    const writeNames = new Set(capabilities.filter((definition) => definition.access !== 'read').map((definition) => definition.name));
    for (const tool of tools.filter((item) => writeNames.has(item.name))) {
      expect(tool.inputSchema.properties).toMatchObject({
        expectedRevision: expect.objectContaining({ type: 'integer' }),
        idempotencyKey: expect.objectContaining({ type: 'string' }),
        dryRun: expect.objectContaining({ type: 'boolean' })
      });
    }
  });

  it('maps every public UI command or records a non-empty uiOnlyReason', () => {
    const byUiCommand = new Map(UI_AUTOMATION_PARITY.map((entry) => [entry.uiCommand, entry]));
    const automationNames = new Set(getAutomationCapabilities().map((definition) => definition.name));
    expect([...byUiCommand.keys()].sort()).toEqual([...PROJECT_COMMAND_TYPES].sort());
    for (const commandType of PROJECT_COMMAND_TYPES) {
      const entry = byUiCommand.get(commandType)!;
      expect(Boolean(entry.uiOnlyReason) !== Boolean(entry.automationCommands?.length)).toBe(true);
      for (const mapping of entry.automationCommands ?? []) expect(automationNames.has(mapping)).toBe(true);
    }
  });

  it('routes Tauri REST and MCP through renderer automation instead of a Rust project owner', () => {
    const root = process.cwd();
    const rust = readFileSync(path.join(root, 'apps/tauri/src-tauri/src/automation.rs'), 'utf8');
    const bridge = readFileSync(path.join(root, 'src/renderer/tauriBridge.ts'), 'utf8');
    expect(rust).toContain('/api/v1/commands/');
    expect(rust).toContain('/output/mcpTools');
    expect(rust).toContain('127.0.0.1');
    expect(rust).toContain('MAX_BODY_BYTES');
    expect(rust).toContain('LCD_IDE_AUTOMATION_TOKEN');
    expect(rust).not.toContain('LcdBitmapProject');
    expect(bridge).toContain("'automation-request'");
    expect(bridge).toContain("invoke('automation_respond'");
  });
});
