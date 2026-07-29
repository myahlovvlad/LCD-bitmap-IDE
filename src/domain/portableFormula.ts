export type PortableFormulaNode =
  | { kind: 'number'; value: number }
  | { kind: 'reference'; name: string }
  | { kind: 'unary'; operator: '+' | '-'; operand: PortableFormulaNode }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: PortableFormulaNode; right: PortableFormulaNode }
  | { kind: 'call'; functionName: PortableFormulaFunction; args: PortableFormulaNode[] };

export type PortableFormulaFunction = 'abs' | 'log10' | 'sqrt' | 'min' | 'max' | 'pow';

export interface PortableFormulaDiagnostic {
  code: 'syntax' | 'unknown-reference' | 'invalid-arity' | 'non-finite';
  message: string;
  position?: number;
}

export interface PortableFormulaResult {
  value: number | null;
  diagnostics: PortableFormulaDiagnostic[];
}

interface Token {
  type: 'number' | 'identifier' | 'operator' | 'left-paren' | 'right-paren' | 'comma' | 'eof';
  value: string;
  position: number;
}

const FUNCTION_ARITY: Record<PortableFormulaFunction, readonly [number, number]> = {
  abs: [1, 1],
  log10: [1, 1],
  sqrt: [1, 1],
  min: [2, Number.POSITIVE_INFINITY],
  max: [2, Number.POSITIVE_INFINITY],
  pow: [2, 2]
};

export function parsePortableFormula(expression: string): PortableFormulaNode {
  return new FormulaParser(tokenize(expression)).parse();
}

export function evaluatePortableFormula(
  expression: string,
  values: Readonly<Record<string, number>>
): PortableFormulaResult {
  try {
    const ast = parsePortableFormula(expression);
    const diagnostics: PortableFormulaDiagnostic[] = [];
    const value = evaluateNode(ast, values, diagnostics);
    if (value === null || !Number.isFinite(value)) {
      if (!diagnostics.some((item) => item.code === 'non-finite')) {
        diagnostics.push({ code: 'non-finite', message: 'Formula result is not finite.' });
      }
      return { value: null, diagnostics };
    }
    return { value, diagnostics };
  } catch (error) {
    return {
      value: null,
      diagnostics: [{
        code: 'syntax',
        message: error instanceof Error ? error.message : String(error)
      }]
    };
  }
}

export function emitPortableFormulaC(
  expression: string,
  resolveReference: (name: string) => string = defaultCReference
): string {
  return emitNodeC(parsePortableFormula(expression), resolveReference);
}

function evaluateNode(
  node: PortableFormulaNode,
  values: Readonly<Record<string, number>>,
  diagnostics: PortableFormulaDiagnostic[]
): number | null {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'reference': {
      const value = values[node.name];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        diagnostics.push({
          code: 'unknown-reference',
          message: `Formula reference "${node.name}" has no finite numeric value.`
        });
        return null;
      }
      return value;
    }
    case 'unary': {
      const operand = evaluateNode(node.operand, values, diagnostics);
      return operand === null ? null : node.operator === '-' ? -operand : operand;
    }
    case 'binary': {
      const left = evaluateNode(node.left, values, diagnostics);
      const right = evaluateNode(node.right, values, diagnostics);
      if (left === null || right === null) {
        return null;
      }
      if (node.operator === '/' && right === 0) {
        diagnostics.push({ code: 'non-finite', message: 'Formula attempted division by zero.' });
        return null;
      }
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
      }
    }
    case 'call': {
      const args = node.args.map((arg) => evaluateNode(arg, values, diagnostics));
      if (args.some((value) => value === null)) {
        return null;
      }
      const numericArgs = args as number[];
      switch (node.functionName) {
        case 'abs': return Math.abs(numericArgs[0]);
        case 'log10': return Math.log10(numericArgs[0]);
        case 'sqrt': return Math.sqrt(numericArgs[0]);
        case 'min': return Math.min(...numericArgs);
        case 'max': return Math.max(...numericArgs);
        case 'pow': return Math.pow(numericArgs[0], numericArgs[1]);
      }
    }
  }
}

function emitNodeC(node: PortableFormulaNode, resolveReference: (name: string) => string): string {
  switch (node.kind) {
    case 'number':
      return Number.isInteger(node.value) ? `${node.value}.0` : String(node.value);
    case 'reference':
      return resolveReference(node.name);
    case 'unary':
      return `(${node.operator}${emitNodeC(node.operand, resolveReference)})`;
    case 'binary':
      return `(${emitNodeC(node.left, resolveReference)} ${node.operator} ${emitNodeC(node.right, resolveReference)})`;
    case 'call':
      return `${node.functionName}(${node.args.map((arg) => emitNodeC(arg, resolveReference)).join(', ')})`;
  }
}

function defaultCReference(name: string): string {
  const normalized = name.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}

function tokenize(expression: string): Token[] {
  const source = expression.replace(/\bMath\.(?=(?:abs|log10|sqrt|min|max|pow)\b)/g, '');
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) {
        throw new Error(`Invalid number at position ${index}.`);
      }
      tokens.push({ type: 'number', value: match[0], position: index });
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_.]*/);
      if (!match) {
        throw new Error(`Invalid identifier at position ${index}.`);
      }
      tokens.push({ type: 'identifier', value: match[0], position: index });
      index += match[0].length;
      continue;
    }
    const simpleType: Partial<Record<string, Token['type']>> = {
      '+': 'operator',
      '-': 'operator',
      '*': 'operator',
      '/': 'operator',
      '(': 'left-paren',
      ')': 'right-paren',
      ',': 'comma'
    };
    const type = simpleType[char];
    if (!type) {
      throw new Error(`Unsupported token "${char}" at position ${index}.`);
    }
    tokens.push({ type, value: char, position: index });
    index += 1;
  }
  tokens.push({ type: 'eof', value: '', position: source.length });
  return tokens;
}

class FormulaParser {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): PortableFormulaNode {
    const node = this.parseAdditive();
    this.expect('eof');
    return node;
  }

  private parseAdditive(): PortableFormulaNode {
    let node = this.parseMultiplicative();
    while (this.matchesOperator('+') || this.matchesOperator('-')) {
      const operator = this.consume().value as '+' | '-';
      node = { kind: 'binary', operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): PortableFormulaNode {
    let node = this.parseUnary();
    while (this.matchesOperator('*') || this.matchesOperator('/')) {
      const operator = this.consume().value as '*' | '/';
      node = { kind: 'binary', operator, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): PortableFormulaNode {
    if (this.matchesOperator('+') || this.matchesOperator('-')) {
      const operator = this.consume().value as '+' | '-';
      return { kind: 'unary', operator, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): PortableFormulaNode {
    const token = this.current();
    if (token.type === 'number') {
      this.consume();
      const value = Number(token.value);
      if (!Number.isFinite(value)) {
        throw new Error(`Number at position ${token.position} is not finite.`);
      }
      return { kind: 'number', value };
    }
    if (token.type === 'identifier') {
      this.consume();
      if (this.current().type !== 'left-paren') {
        return { kind: 'reference', name: token.value };
      }
      if (!(token.value in FUNCTION_ARITY)) {
        throw new Error(`Unsupported function "${token.value}" at position ${token.position}.`);
      }
      this.consume();
      const args: PortableFormulaNode[] = [];
      if (this.current().type !== 'right-paren') {
        do {
          args.push(this.parseAdditive());
          if (this.current().type !== 'comma') {
            break;
          }
          this.consume();
        } while (true);
      }
      this.expect('right-paren');
      const functionName = token.value as PortableFormulaFunction;
      const [min, max] = FUNCTION_ARITY[functionName];
      if (args.length < min || args.length > max) {
        throw new Error(`Function "${functionName}" received ${args.length} arguments; expected ${min}${min === max ? '' : ' or more'}.`);
      }
      return { kind: 'call', functionName, args };
    }
    if (token.type === 'left-paren') {
      this.consume();
      const node = this.parseAdditive();
      this.expect('right-paren');
      return node;
    }
    throw new Error(`Expected a number, reference or "(" at position ${token.position}.`);
  }

  private current(): Token {
    return this.tokens[this.index];
  }

  private consume(): Token {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private expect(type: Token['type']): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(`Expected ${type} at position ${token.position}, received ${token.type}.`);
    }
    return this.consume();
  }

  private matchesOperator(operator: string): boolean {
    return this.current().type === 'operator' && this.current().value === operator;
  }
}
