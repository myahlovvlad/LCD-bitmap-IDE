import { describe, expect, it } from 'vitest';
import { getAutomationCapabilities, getMcpToolDefinitions } from '../../src/shared/automation';

describe('semantic index automation registry', () => {
  it('publishes all semantic-index read commands through the shared REST/MCP registry', () => {
    const names = getAutomationCapabilities().map((definition) => definition.name);
    expect(names).toEqual(expect.arrayContaining([
      'get_project_semantic_index',
      'list_project_semantic_workflows',
      'get_project_semantic_workflow'
    ]));
    const tools = new Map(getMcpToolDefinitions().map((tool) => [tool.name, tool]));
    expect(tools.has('get_project_semantic_index')).toBe(true);
    expect(tools.has('list_project_semantic_workflows')).toBe(true);
    expect(tools.get('get_project_semantic_workflow')?.inputSchema.properties).toHaveProperty('workflowId');
  });
});
