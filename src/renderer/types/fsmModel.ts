export interface RawFsmModel {
  project?: string;
  version?: string;
  states?: RawFsmState[];
  transitions?: RawFsmTransition[];
  layouts?: Record<string, RawGraphPosition>;
  audit?: unknown;
  peripherals?: unknown;
  overlay_policy?: unknown;
  overlay_transitions?: unknown;
  dynamic_ui_rules?: unknown;
}

export interface RawFsmState {
  id: string;
  runtime_id?: string | null;
  legacy?: string[];
  title?: string;
  subsystem?: string;
  type?: string;
  origin?: string;
  lcd?: string[];
}

export interface RawFsmTransition {
  id?: string;
  frm?: string;
  from?: string;
  to: string;
  trigger?: string;
  kind?: string;
  condition?: string;
  source?: string;
  cli_command?: string | string[];
  cliCommands?: string[];
}

export interface RawGraphPosition {
  x: number;
  y: number;
}
