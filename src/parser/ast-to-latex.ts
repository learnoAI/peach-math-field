/**
 * AST to LaTeX Serializer
 *
 * Converts our AST format back to LaTeX strings.
 * Aims for clean, readable output with minimal unnecessary braces.
 */

import {
  MathNode,
  RowNode,
  NumberNode,
  SymbolNode,
  OperatorNode,
  TextNode,
  SpaceNode,
  PlaceholderNode,
  FractionNode,
  PowerNode,
  SubscriptNode,
  SubSupNode,
  SqrtNode,
  ParensNode,
  FunctionNode,
  MatrixNode,
} from '../core/ast';

// =============================================================================
// Greek Letters (need backslash prefix)
// =============================================================================

const GREEK_LETTERS = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi',
  'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
  'varepsilon', 'vartheta', 'varpi', 'varrho', 'varsigma', 'varphi',
]);

// =============================================================================
// Operators that need backslash
// =============================================================================

const COMMAND_OPERATORS = new Set([
  'times', 'div', 'cdot', 'pm', 'mp', 'ast', 'star', 'circ', 'bullet',
  'oplus', 'ominus', 'otimes', 'oslash', 'odot',
  'le', 'leq', 'ge', 'geq', 'neq', 'ne', 'approx', 'equiv', 'sim', 'simeq',
  'll', 'gg', 'subset', 'supset', 'subseteq', 'supseteq', 'in', 'notin', 'ni',
  'cup', 'cap', 'setminus', 'emptyset', 'varnothing',
  'forall', 'exists', 'nexists', 'neg', 'land', 'lor', 'implies', 'iff',
  'to', 'gets', 'leftarrow', 'rightarrow', 'leftrightarrow',
  'Leftarrow', 'Rightarrow', 'Leftrightarrow',
  'infty', 'partial', 'nabla', 'degree',
  'ldots', 'cdots', 'vdots', 'ddots',
  'langle', 'rangle', 'lvert', 'rvert', 'lVert', 'rVert',
  'lfloor', 'rfloor', 'lceil', 'rceil',
  // Arrows
  'mapsto', 'longmapsto',
  'uparrow', 'downarrow', 'updownarrow',
  'Uparrow', 'Downarrow', 'Updownarrow',
  'nearrow', 'searrow', 'swarrow', 'nwarrow',
  // Additional comparison/relation
  'propto', 'cong', 'mid',
  // Percent
  '%',
]);

// =============================================================================
// Functions
// =============================================================================

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'arccot',
  'sinh', 'cosh', 'tanh', 'coth',
  'log', 'ln', 'lg', 'exp',
  'lim', 'limsup', 'liminf',
  'min', 'max', 'sup', 'inf',
  'det', 'dim', 'ker', 'hom', 'arg',
  'deg', 'gcd', 'lcm', 'mod', 'bmod', 'pmod',
  'Pr',
  // Large operators
  'sum', 'prod', 'coprod', 'int', 'oint', 'iint', 'iiint',
  'bigcup', 'bigcap', 'bigoplus', 'bigotimes', 'bigvee', 'bigwedge',
]);

// =============================================================================
// Space sizes
// =============================================================================

const SPACE_COMMANDS: Record<string, string> = {
  thin: '\\,',
  medium: '\\:',
  thick: '\\;',
  quad: '\\quad',
  qquad: '\\qquad',
};

// =============================================================================
// Serializer
// =============================================================================

export interface SerializeOptions {
  /** Add spaces around operators for readability */
  prettyPrint?: boolean;
  /** Include placeholders in output (default: true). Set false for external/UI output */
  includePlaceholders?: boolean;
}

/**
 * Serialize an AST node to LaTeX
 */
export function serializeToLatex(ast: MathNode, options: SerializeOptions = {}): string {
  return serializeNode(ast, options);
}

function serializeNode(n: MathNode, options: SerializeOptions): string {
  switch (n.kind) {
    case 'number':
      return serializeNumber(n);
    case 'symbol':
      return serializeSymbol(n);
    case 'operator':
      return serializeOperator(n, options);
    case 'text':
      return serializeText(n);
    case 'space':
      return serializeSpace(n);
    case 'placeholder':
      return serializePlaceholder(n, options);
    case 'row':
      return serializeRow(n, options);
    case 'fraction':
      return serializeFraction(n, options);
    case 'power':
      return serializePower(n, options);
    case 'subscript':
      return serializeSubscript(n, options);
    case 'subsup':
      return serializeSubSup(n, options);
    case 'sqrt':
      return serializeSqrt(n, options);
    case 'parens':
      return serializeParens(n, options);
    case 'function':
      return serializeFunction(n, options);
    case 'matrix':
      return serializeMatrix(n, options);
    default:
      return '';
  }
}

function serializeNumber(n: NumberNode): string {
  return n.value;
}

function serializeSymbol(n: SymbolNode): string {
  if (GREEK_LETTERS.has(n.value)) {
    return '\\' + n.value;
  }
  // Single letter symbols don't need special treatment
  return n.value;
}

function serializeOperator(n: OperatorNode, options: SerializeOptions): string {
  const space = options.prettyPrint ? ' ' : '';

  if (COMMAND_OPERATORS.has(n.value)) {
    // Command operators always need a trailing space to prevent merging with next token
    // e.g., \times followed by 'y' should be '\times y' not '\timesy'
    return space + '\\' + n.value + ' ';
  }

  // Simple operators
  switch (n.value) {
    case '+':
    case '-':
    case '=':
    case '<':
    case '>':
      return space + n.value + space;
    default:
      return n.value;
  }
}

function serializeText(n: TextNode): string {
  return `\\text{${n.value}}`;
}

function serializeSpace(n: SpaceNode): string {
  return SPACE_COMMANDS[n.size] || '';
}

function serializePlaceholder(_n: PlaceholderNode, options: SerializeOptions): string {
  // When includePlaceholders is false (for external output), emit empty string
  if (options.includePlaceholders === false) {
    return '';
  }
  // Default: represent placeholder as empty braces for internal use
  return '{}';
}

function serializeRow(n: RowNode, options: SerializeOptions): string {
  return n.children.map((child) => serializeNode(child, options)).join('');
}

function serializeFraction(n: FractionNode, options: SerializeOptions): string {
  const num = serializeNode(n.numerator, options);
  const den = serializeNode(n.denominator, options);
  return `\\frac{${num}}{${den}}`;
}

function serializePower(n: PowerNode, options: SerializeOptions): string {
  const base = serializeBase(n.base, options);
  const exp = serializeNode(n.exponent, options);

  // Single character/digit exponents don't need braces
  if (needsBraces(n.exponent)) {
    return `${base}^{${exp}}`;
  }
  return `${base}^${exp}`;
}

function serializeSubscript(n: SubscriptNode, options: SerializeOptions): string {
  const base = serializeBase(n.base, options);
  const sub = serializeNode(n.subscript, options);

  if (needsBraces(n.subscript)) {
    return `${base}_{${sub}}`;
  }
  return `${base}_${sub}`;
}

function serializeSubSup(n: SubSupNode, options: SerializeOptions): string {
  const base = serializeBase(n.base, options);
  const sub = serializeNode(n.subscript, options);
  const sup = serializeNode(n.superscript, options);

  const subPart = needsBraces(n.subscript) ? `_{${sub}}` : `_${sub}`;
  const supPart = needsBraces(n.superscript) ? `^{${sup}}` : `^${sup}`;

  return `${base}${subPart}${supPart}`;
}

/**
 * Serialize a base that might need braces if it's complex
 * Unwraps single-child rows to avoid unnecessary {x} output
 */
function serializeBase(n: MathNode, options: SerializeOptions): string {
  // Unwrap single-child rows to get cleaner output
  // e.g., a row containing just 'x' should serialize as 'x', not '{x}'
  if (n.kind === 'row' && n.children.length === 1) {
    const child = n.children[0];
    // If the single child is simple (symbol, number), just serialize it directly
    if (child.kind === 'symbol' || child.kind === 'number') {
      return serializeNode(child, options);
    }
    // If the single child is complex, serialize the row (which will add braces if needed)
  }

  const serialized = serializeNode(n, options);

  // Complex bases need braces
  if (n.kind === 'row' || n.kind === 'fraction' || n.kind === 'power' ||
      n.kind === 'subscript' || n.kind === 'subsup') {
    return `{${serialized}}`;
  }

  return serialized;
}

/**
 * Check if a node needs braces when used as exponent/subscript
 */
function needsBraces(n: MathNode): boolean {
  if (n.kind === 'row') return true;
  if (n.kind === 'number' && n.value.length > 1) return true;
  if (n.kind === 'symbol' && n.value.length > 1 && !GREEK_LETTERS.has(n.value)) return true;
  if (n.kind === 'placeholder') return true;
  if (n.kind === 'fraction' || n.kind === 'sqrt' || n.kind === 'parens') return true;
  // Nested powers/subscripts need braces to avoid ambiguity
  if (n.kind === 'power' || n.kind === 'subscript' || n.kind === 'subsup') return true;
  return false;
}

function serializeSqrt(n: SqrtNode, options: SerializeOptions): string {
  const radicand = serializeNode(n.radicand, options);

  if (n.index) {
    const index = serializeNode(n.index, options);
    return `\\sqrt[${index}]{${radicand}}`;
  }

  return `\\sqrt{${radicand}}`;
}

function serializeParens(n: ParensNode, options: SerializeOptions): string {
  const content = serializeNode(n.content, options);

  if (n.size === 'auto') {
    // Use \left \right
    const open = serializeDelimiter(n.open, 'left');
    const close = serializeDelimiter(n.close, 'right');
    return `\\left${open}${content}\\right${close}`;
  }

  // Simple delimiters
  const open = n.open === '{' ? '\\{' : n.open;
  const close = n.close === '}' ? '\\}' : n.close;

  return `${open}${content}${close}`;
}

function serializeDelimiter(delim: string, side: 'left' | 'right'): string {
  switch (delim) {
    case '(':
    case ')':
    case '[':
    case ']':
    case '|':
      return delim;
    case '{':
      return '\\{';
    case '}':
      return '\\}';
    case '\\|':
      return '\\|';
    case '\\langle':
      return '\\langle';
    case '\\rangle':
      return '\\rangle';
    case '.':
      return '.'; // Invisible delimiter
    default:
      return delim;
  }
}

function serializeFunction(n: FunctionNode, options: SerializeOptions): string {
  let result = '';

  if (FUNCTIONS.has(n.name)) {
    result = '\\' + n.name;
  } else {
    result = n.name;
  }

  // Add limits if present
  if (n.limits) {
    if (n.limits.lower) {
      const lower = serializeNode(n.limits.lower, options);
      result += needsBraces(n.limits.lower) ? `_{${lower}}` : `_${lower}`;
    }
    if (n.limits.upper) {
      const upper = serializeNode(n.limits.upper, options);
      result += needsBraces(n.limits.upper) ? `^{${upper}}` : `^${upper}`;
    }
  }

  // Add argument if present
  if (n.argument) {
    const argStr = serializeNode(n.argument, options);
    // Add space or braces between function name and argument
    // If argument starts with delimiter or brace, no space needed
    if (argStr.startsWith('{') || argStr.startsWith('(') || argStr.startsWith('[') || argStr.startsWith('\\left')) {
      result += argStr;
    } else if (needsBraces(n.argument)) {
      // Multi-character argument needs braces
      result += `{${argStr}}`;
    } else {
      // Single character argument needs space
      result += ' ' + argStr;
    }
  }

  return result;
}

function serializeMatrix(n: MatrixNode, options: SerializeOptions): string {
  const envName = n.style;
  let result = `\\begin{${envName}}`;

  if (n.style === 'array' && n.colSpec) {
    result += `{${n.colSpec}}`;
  }

  const rowStrings = n.rows.map((row) =>
    row.map((cell) => serializeNode(cell, options)).join(' & ')
  );

  result += rowStrings.join(' \\\\ ');
  result += `\\end{${envName}}`;

  return result;
}
