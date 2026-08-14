import { describe, expect, it } from 'vitest';
import { MCP_TOOL_DEFINITIONS } from '../../src/main/mcp/mcpServer';

describe('MCP tool definitions', () => {
  it('publishes stable unique tool names', () => {
    const names = MCP_TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
