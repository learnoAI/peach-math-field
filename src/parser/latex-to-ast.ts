/**
 * LaTeX to AST Parser
 *
 * Recursive descent parser that converts LaTeX strings to our AST format.
 * Handles the common subset of LaTeX math notation.
 */

import {
  MathNode,
  node,
  ParensNode,
  MatrixNode,
} from '../core/ast';
import { tokenize, TokenStream, Token } from './tokens';

// =============================================================================
// Greek Letters and Symbols
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

const OPERATORS = new Set([
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
]);

const LARGE_OPERATORS = new Set([
  'sum', 'prod', 'coprod', 'int', 'oint', 'iint', 'iiint',
  'bigcup', 'bigcap', 'bigoplus', 'bigotimes', 'bigvee', 'bigwedge',
]);

const SPACE_COMMANDS: Record<string, 'thin' | 'medium' | 'thick' | 'quad' | 'qquad'> = {
  '\\,': 'thin',
  '\\:': 'medium',
  '\\;': 'thick',
  '\\quad': 'quad',
  '\\qquad': 'qquad',
};

const MATRIX_ENVIRONMENTS = new Set([
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'array',
]);

// =============================================================================
// Parser Class
// =============================================================================

export class Parser {
  private stream: TokenStream;

  constructor(tokens: Token[]) {
    this.stream = new TokenStream(tokens);
  }

  /**
   * Parse the entire token stream into an AST
   */
  parse(): MathNode {
    const result = this.parseRow();
    if (!this.stream.isEof()) {
      throw new Error(`Unexpected token at position ${this.stream.getPosition()}`);
    }
    return result;
  }

  /**
   * Parse a row of atoms (main parsing entry point)
   */
  private parseRow(stopTokens: Set<string> = new Set()): MathNode {
    const children: MathNode[] = [];

    while (!this.stream.isEof()) {
      this.stream.skipWhitespace();

      const token = this.stream.peek();

      // Check for stop tokens
      if (stopTokens.has(token.value) || stopTokens.has(token.type)) {
        break;
      }

      // Stop at closing braces/brackets
      if (token.type === 'closeBrace' || token.type === 'closeBracket' || token.type === 'closeParen') {
        break;
      }

      // Stop at ampersand and newline (for matrices)
      if (token.type === 'ampersand' || token.type === 'newline') {
        break;
      }

      const atom = this.parseAtom();
      if (atom) {
        children.push(atom);
      }
    }

    // Simplify: single child doesn't need a row wrapper
    if (children.length === 0) {
      return node.placeholder();
    }
    if (children.length === 1) {
      return children[0];
    }
    return node.row(children);
  }

  /**
   * Parse a single atom (number, symbol, command, or group)
   */
  private parseAtom(): MathNode | null {
    this.stream.skipWhitespace();

    const token = this.stream.peek();

    switch (token.type) {
      case 'number':
        return this.parseNumber();
      case 'text':
        return this.parseSymbol();
      case 'operator':
        return this.parseOperator();
      case 'command':
        return this.parseCommand();
      case 'openBrace':
        return this.parseGroup();
      case 'openParen':
      case 'openBracket':
      case 'pipe':
        return this.parseDelimitedGroup();
      case 'superscript':
      case 'subscript':
        // Handle orphan super/subscript (attach to previous or empty)
        return this.parseScript(node.placeholder());
      default:
        return null;
    }
  }

  /**
   * Parse a number
   */
  private parseNumber(): MathNode {
    const token = this.stream.next();
    const numNode = node.number(token.value);
    return this.parseScript(numNode);
  }

  /**
   * Parse a single-letter symbol
   */
  private parseSymbol(): MathNode {
    const token = this.stream.next();
    const symNode = node.symbol(token.value);
    return this.parseScript(symNode);
  }

  /**
   * Parse an operator
   */
  private parseOperator(): MathNode {
    const token = this.stream.next();
    return node.operator(token.value);
  }

  /**
   * Parse a LaTeX command
   */
  private parseCommand(): MathNode {
    const token = this.stream.next();
    const cmd = token.value.slice(1); // Remove backslash

    // Space commands
    if (token.value in SPACE_COMMANDS) {
      return node.space(SPACE_COMMANDS[token.value]);
    }

    // Greek letters
    if (GREEK_LETTERS.has(cmd)) {
      const symNode = node.symbol(cmd);
      return this.parseScript(symNode);
    }

    // Operators
    if (OPERATORS.has(cmd)) {
      return node.operator(cmd);
    }

    // Functions (sin, cos, log, etc.)
    if (FUNCTIONS.has(cmd)) {
      return this.parseFunction(cmd);
    }

    // Large operators (sum, prod, int)
    if (LARGE_OPERATORS.has(cmd)) {
      return this.parseLargeOperator(cmd);
    }

    // Fraction
    if (cmd === 'frac') {
      return this.parseFraction();
    }

    // Square root
    if (cmd === 'sqrt') {
      return this.parseSqrt();
    }

    // Text
    if (cmd === 'text' || cmd === 'textit' || cmd === 'textbf' || cmd === 'mathrm') {
      return this.parseText();
    }

    // Left/right delimiters
    if (cmd === 'left') {
      return this.parseLeftRight();
    }

    // Begin environment (matrix, array, etc.)
    if (cmd === 'begin') {
      return this.parseEnvironment();
    }

    // Delimiter commands
    if (cmd === 'langle' || cmd === 'rangle' || cmd === 'lvert' || cmd === 'rvert' ||
        cmd === 'lVert' || cmd === 'rVert' || cmd === 'lfloor' || cmd === 'rfloor' ||
        cmd === 'lceil' || cmd === 'rceil') {
      return node.operator(cmd);
    }

    // Unknown command - treat as symbol
    const symNode = node.symbol(cmd);
    return this.parseScript(symNode);
  }

  /**
   * Parse superscript and/or subscript after a base
   */
  private parseScript(base: MathNode): MathNode {
    this.stream.skipWhitespace();

    let hasSuper = false;
    let hasSub = false;
    let superscript: MathNode | null = null;
    let subscript: MathNode | null = null;

    // Check for ^ or _
    while (this.stream.is('superscript') || this.stream.is('subscript')) {
      if (this.stream.is('superscript')) {
        if (hasSuper) break; // Already have superscript
        this.stream.next();
        hasSuper = true;
        superscript = this.parseScriptArg();
      } else if (this.stream.is('subscript')) {
        if (hasSub) break; // Already have subscript
        this.stream.next();
        hasSub = true;
        subscript = this.parseScriptArg();
      }
      this.stream.skipWhitespace();
    }

    if (hasSuper && hasSub) {
      return node.subsup(base, subscript!, superscript!);
    } else if (hasSuper) {
      return node.power(base, superscript!);
    } else if (hasSub) {
      return node.subscript(base, subscript!);
    }

    return base;
  }

  /**
   * Parse argument for super/subscript (single char or braced group)
   */
  private parseScriptArg(): MathNode {
    this.stream.skipWhitespace();

    if (this.stream.is('openBrace')) {
      return this.parseGroup();
    }

    // Single token
    const token = this.stream.peek();
    if (token.type === 'number') {
      this.stream.next();
      return node.number(token.value);
    } else if (token.type === 'text') {
      this.stream.next();
      return node.symbol(token.value);
    } else if (token.type === 'command') {
      return this.parseCommand();
    }

    return node.placeholder();
  }

  /**
   * Parse a braced group { ... }
   */
  private parseGroup(): MathNode {
    this.stream.expect('openBrace');
    const content = this.parseRow();
    this.stream.expect('closeBrace');
    return content;
  }

  /**
   * Parse delimited group with simple delimiters: (...), [...], |...|
   */
  private parseDelimitedGroup(): MathNode {
    const token = this.stream.next();
    let open: ParensNode['open'];
    let close: ParensNode['close'];

    switch (token.type) {
      case 'openParen':
        open = '(';
        close = ')';
        break;
      case 'openBracket':
        open = '[';
        close = ']';
        break;
      case 'pipe':
        open = '|';
        close = '|';
        break;
      default:
        throw new Error(`Unexpected delimiter: ${token.value}`);
    }

    const content = this.parseRow(new Set([close]));

    // Consume closing delimiter
    if (token.type === 'openParen') {
      this.stream.expect('closeParen');
    } else if (token.type === 'openBracket') {
      this.stream.expect('closeBracket');
    } else if (token.type === 'pipe') {
      this.stream.expect('pipe');
    }

    const parensNode = node.parens(content, open, close);
    return this.parseScript(parensNode);
  }

  /**
   * Parse \frac{num}{den}
   */
  private parseFraction(): MathNode {
    this.stream.skipWhitespace();
    const numerator = this.parseGroup();
    this.stream.skipWhitespace();
    const denominator = this.parseGroup();
    const fracNode = node.fraction(numerator, denominator);
    return this.parseScript(fracNode);
  }

  /**
   * Parse \sqrt[n]{x} or \sqrt{x}
   */
  private parseSqrt(): MathNode {
    this.stream.skipWhitespace();

    let index: MathNode | undefined;

    // Check for optional index [n]
    if (this.stream.is('openBracket')) {
      this.stream.next();
      index = this.parseRow(new Set([']']));
      this.stream.expect('closeBracket');
    }

    this.stream.skipWhitespace();
    const radicand = this.parseGroup();

    const sqrtNode = node.sqrt(radicand, index);
    return this.parseScript(sqrtNode);
  }

  /**
   * Parse \text{...}
   */
  private parseText(): MathNode {
    this.stream.skipWhitespace();
    this.stream.expect('openBrace');

    // Collect all tokens as text until closing brace
    let text = '';
    while (!this.stream.is('closeBrace') && !this.stream.isEof()) {
      const token = this.stream.next();
      text += token.value;
    }

    this.stream.expect('closeBrace');
    return node.text(text);
  }

  /**
   * Parse named function like \sin, \cos, \log
   */
  private parseFunction(name: string): MathNode {
    const funcNode = node.function(name);
    return this.parseScript(funcNode);
  }

  /**
   * Parse large operators like \sum, \int with limits
   */
  private parseLargeOperator(name: string): MathNode {
    this.stream.skipWhitespace();

    let lower: MathNode | undefined;
    let upper: MathNode | undefined;

    // Check for subscript (lower limit)
    if (this.stream.is('subscript')) {
      this.stream.next();
      lower = this.parseScriptArg();
      this.stream.skipWhitespace();
    }

    // Check for superscript (upper limit)
    if (this.stream.is('superscript')) {
      this.stream.next();
      upper = this.parseScriptArg();
      this.stream.skipWhitespace();
    }

    // Could be in reverse order
    if (!lower && this.stream.is('subscript')) {
      this.stream.next();
      lower = this.parseScriptArg();
    }

    const limits = lower || upper ? { lower, upper } : undefined;
    return node.function(name, undefined, limits);
  }

  /**
   * Parse \left...\right delimiters
   */
  private parseLeftRight(): MathNode {
    const openDelim = this.parseDelimiter();
    const content = this.parseRow(new Set(['\\right']));

    // Expect \right
    this.stream.expectValue('command', '\\right');
    const closeDelim = this.parseDelimiter();

    const parensNode = node.parens(content, openDelim as ParensNode['open'], closeDelim as ParensNode['close'], 'auto');
    return this.parseScript(parensNode);
  }

  /**
   * Parse a delimiter after \left or \right
   */
  private parseDelimiter(): string {
    this.stream.skipWhitespace();
    const token = this.stream.next();

    if (token.type === 'openParen') return '(';
    if (token.type === 'closeParen') return ')';
    if (token.type === 'openBracket') return '[';
    if (token.type === 'closeBracket') return ']';
    if (token.type === 'pipe') return '|';
    if (token.type === 'operator' && token.value === '.') return '.'; // Invisible delimiter

    if (token.type === 'command') {
      const cmd = token.value.slice(1);
      if (cmd === 'langle') return '\\langle';
      if (cmd === 'rangle') return '\\rangle';
      if (cmd === '{' || cmd === 'lbrace') return '{';
      if (cmd === '}' || cmd === 'rbrace') return '}';
      if (cmd === '|' || cmd === 'vert') return '|';
      if (cmd === 'Vert' || cmd === '|') return '\\|';
    }

    throw new Error(`Invalid delimiter: ${token.value}`);
  }

  /**
   * Parse \begin{env}...\end{env}
   */
  private parseEnvironment(): MathNode {
    this.stream.skipWhitespace();
    this.stream.expect('openBrace');

    // Read environment name
    let envName = '';
    while (!this.stream.is('closeBrace') && !this.stream.isEof()) {
      envName += this.stream.next().value;
    }
    this.stream.expect('closeBrace');

    if (MATRIX_ENVIRONMENTS.has(envName)) {
      return this.parseMatrix(envName as MatrixNode['style']);
    }

    throw new Error(`Unknown environment: ${envName}`);
  }

  /**
   * Parse matrix environment
   */
  private parseMatrix(style: MatrixNode['style']): MathNode {
    let colSpec: string | undefined;

    // For 'array', parse column specification
    if (style === 'array') {
      this.stream.skipWhitespace();
      this.stream.expect('openBrace');
      colSpec = '';
      while (!this.stream.is('closeBrace') && !this.stream.isEof()) {
        colSpec += this.stream.next().value;
      }
      this.stream.expect('closeBrace');
    }

    const rows: MathNode[][] = [];
    let currentRow: MathNode[] = [];

    while (!this.stream.isEof()) {
      this.stream.skipWhitespace();

      // Check for \end
      if (this.stream.isValue('command', '\\end')) {
        break;
      }

      // Check for row separator \\
      if (this.stream.is('newline')) {
        this.stream.next();
        rows.push(currentRow);
        currentRow = [];
        continue;
      }

      // Check for column separator &
      if (this.stream.is('ampersand')) {
        this.stream.next();
        continue;
      }

      // Parse cell content
      const cell = this.parseRow(new Set(['&', '\\\\', '\\end']));
      currentRow.push(cell);
    }

    // Push last row if non-empty
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Consume \end{envName} and validate it matches
    this.stream.expectValue('command', '\\end');
    this.stream.skipWhitespace();
    this.stream.expect('openBrace');
    let endEnvName = '';
    while (!this.stream.is('closeBrace') && !this.stream.isEof()) {
      endEnvName += this.stream.next().value;
    }
    this.stream.expect('closeBrace');

    if (endEnvName !== style) {
      throw new Error(`Environment mismatch: \\begin{${style}} ended with \\end{${endEnvName}}`);
    }

    const matrixNode = node.matrix(rows, style, colSpec);
    return this.parseScript(matrixNode);
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse a LaTeX string into an AST
 */
export function parseLatex(latex: string): MathNode {
  const tokens = tokenize(latex);
  const parser = new Parser(tokens);
  return parser.parse();
}
