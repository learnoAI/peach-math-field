/**
 * AST (Abstract Syntax Tree) types for mathematical expressions.
 *
 * Design principles:
 * 1. Immutable - all nodes are readonly, updates create new trees
 * 2. MathJSON-inspired - similar structure for future compatibility
 * 3. LaTeX-primary - optimized for LaTeX serialization
 */

// =============================================================================
// Node Types
// =============================================================================

export type MathNodeKind =
  | 'row' // Horizontal sequence of nodes (implicit grouping)
  | 'number' // Numeric literal: 123, 3.14
  | 'symbol' // Variable or constant: x, y, π, α
  | 'operator' // Binary/unary operator: +, -, ×, ÷, =
  | 'fraction' // Fraction: \frac{num}{den}
  | 'power' // Superscript: base^exponent
  | 'subscript' // Subscript: base_index
  | 'subsup' // Both sub and superscript: base_index^exponent
  | 'sqrt' // Root: \sqrt{x} or \sqrt[n]{x}
  | 'parens' // Delimiters: (), [], {}, ||
  | 'matrix' // Matrix/array: \begin{matrix}...\end{matrix}
  | 'text' // Text mode: \text{...}
  | 'function' // Named function: \sin, \cos, \log
  | 'space' // Explicit spacing: \, \; \quad
  | 'placeholder'; // Empty slot for input (cursor target)

// =============================================================================
// Base Node Interface
// =============================================================================

interface BaseMathNode {
  readonly kind: MathNodeKind;
}

// =============================================================================
// Leaf Nodes (no children)
// =============================================================================

export interface NumberNode extends BaseMathNode {
  readonly kind: 'number';
  readonly value: string; // String to preserve formatting (e.g., "3.14")
}

export interface SymbolNode extends BaseMathNode {
  readonly kind: 'symbol';
  readonly value: string; // Single character or command name (e.g., "x", "alpha")
}

export interface OperatorNode extends BaseMathNode {
  readonly kind: 'operator';
  readonly value: string; // Operator symbol or command (e.g., "+", "times", "=")
}

export interface TextNode extends BaseMathNode {
  readonly kind: 'text';
  readonly value: string; // Plain text content
}

export interface SpaceNode extends BaseMathNode {
  readonly kind: 'space';
  readonly size: 'thin' | 'medium' | 'thick' | 'quad' | 'qquad'; // \, \: \; \quad \qquad
}

export interface PlaceholderNode extends BaseMathNode {
  readonly kind: 'placeholder';
}

// =============================================================================
// Container Nodes (with children)
// =============================================================================

export interface RowNode extends BaseMathNode {
  readonly kind: 'row';
  readonly children: readonly MathNode[];
}

export interface FractionNode extends BaseMathNode {
  readonly kind: 'fraction';
  readonly numerator: MathNode;
  readonly denominator: MathNode;
}

export interface PowerNode extends BaseMathNode {
  readonly kind: 'power';
  readonly base: MathNode;
  readonly exponent: MathNode;
}

export interface SubscriptNode extends BaseMathNode {
  readonly kind: 'subscript';
  readonly base: MathNode;
  readonly subscript: MathNode;
}

export interface SubSupNode extends BaseMathNode {
  readonly kind: 'subsup';
  readonly base: MathNode;
  readonly subscript: MathNode;
  readonly superscript: MathNode;
}

export interface SqrtNode extends BaseMathNode {
  readonly kind: 'sqrt';
  readonly radicand: MathNode;
  readonly index?: MathNode; // Optional: nth root
}

export interface ParensNode extends BaseMathNode {
  readonly kind: 'parens';
  readonly open: '(' | '[' | '{' | '|' | '\\|' | '\\langle'; // Opening delimiter
  readonly close: ')' | ']' | '}' | '|' | '\\|' | '\\rangle'; // Closing delimiter
  readonly content: MathNode;
  readonly size?: 'auto' | 'big' | 'Big' | 'bigg' | 'Bigg'; // \left\right or explicit
}

export interface FunctionNode extends BaseMathNode {
  readonly kind: 'function';
  readonly name: string; // Function name: sin, cos, log, lim, etc.
  readonly argument?: MathNode; // Optional argument
  readonly limits?: {
    // For lim, sum, prod, int
    readonly lower?: MathNode;
    readonly upper?: MathNode;
  };
}

export interface MatrixNode extends BaseMathNode {
  readonly kind: 'matrix';
  readonly rows: readonly (readonly MathNode[])[]; // 2D array of cells
  readonly style: 'matrix' | 'pmatrix' | 'bmatrix' | 'Bmatrix' | 'vmatrix' | 'Vmatrix' | 'array';
  readonly colSpec?: string; // For array: column specification like "cc" or "lcr"
}

// =============================================================================
// Union Type
// =============================================================================

export type MathNode =
  | NumberNode
  | SymbolNode
  | OperatorNode
  | TextNode
  | SpaceNode
  | PlaceholderNode
  | RowNode
  | FractionNode
  | PowerNode
  | SubscriptNode
  | SubSupNode
  | SqrtNode
  | ParensNode
  | FunctionNode
  | MatrixNode;

// =============================================================================
// Node Builders (Factory Functions)
// =============================================================================

export const node = {
  number(value: string): NumberNode {
    return { kind: 'number', value };
  },

  symbol(value: string): SymbolNode {
    return { kind: 'symbol', value };
  },

  operator(value: string): OperatorNode {
    return { kind: 'operator', value };
  },

  text(value: string): TextNode {
    return { kind: 'text', value };
  },

  space(size: SpaceNode['size']): SpaceNode {
    return { kind: 'space', size };
  },

  placeholder(): PlaceholderNode {
    return { kind: 'placeholder' };
  },

  row(children: readonly MathNode[]): RowNode {
    return { kind: 'row', children };
  },

  fraction(numerator: MathNode, denominator: MathNode): FractionNode {
    return { kind: 'fraction', numerator, denominator };
  },

  power(base: MathNode, exponent: MathNode): PowerNode {
    return { kind: 'power', base, exponent };
  },

  subscript(base: MathNode, subscript: MathNode): SubscriptNode {
    return { kind: 'subscript', base, subscript };
  },

  subsup(base: MathNode, subscript: MathNode, superscript: MathNode): SubSupNode {
    return { kind: 'subsup', base, subscript, superscript };
  },

  sqrt(radicand: MathNode, index?: MathNode): SqrtNode {
    return index ? { kind: 'sqrt', radicand, index } : { kind: 'sqrt', radicand };
  },

  parens(
    content: MathNode,
    open: ParensNode['open'] = '(',
    close: ParensNode['close'] = ')',
    size?: ParensNode['size']
  ): ParensNode {
    const base: ParensNode = { kind: 'parens', open, close, content };
    return size ? { ...base, size } : base;
  },

  function(name: string, argument?: MathNode, limits?: FunctionNode['limits']): FunctionNode {
    const base: FunctionNode = { kind: 'function', name };
    if (argument) (base as { argument: MathNode }).argument = argument;
    if (limits) (base as { limits: FunctionNode['limits'] }).limits = limits;
    return base;
  },

  matrix(
    rows: readonly (readonly MathNode[])[],
    style: MatrixNode['style'] = 'matrix',
    colSpec?: string
  ): MatrixNode {
    const base: MatrixNode = { kind: 'matrix', rows, style };
    if (colSpec) (base as { colSpec: string }).colSpec = colSpec;
    return base;
  },
};

// =============================================================================
// Type Guards
// =============================================================================

export function isLeafNode(n: MathNode): n is NumberNode | SymbolNode | OperatorNode | TextNode | SpaceNode | PlaceholderNode {
  return ['number', 'symbol', 'operator', 'text', 'space', 'placeholder'].includes(n.kind);
}

export function isContainerNode(n: MathNode): boolean {
  return !isLeafNode(n);
}

// =============================================================================
// Tree Utilities
// =============================================================================

/**
 * Get all children of a node (for traversal)
 */
export function getChildren(n: MathNode): readonly MathNode[] {
  switch (n.kind) {
    case 'row':
      return n.children;
    case 'fraction':
      return [n.numerator, n.denominator];
    case 'power':
      return [n.base, n.exponent];
    case 'subscript':
      return [n.base, n.subscript];
    case 'subsup':
      return [n.base, n.subscript, n.superscript];
    case 'sqrt':
      return n.index ? [n.radicand, n.index] : [n.radicand];
    case 'parens':
      return [n.content];
    case 'function': {
      const children: MathNode[] = [];
      if (n.argument) children.push(n.argument);
      if (n.limits?.lower) children.push(n.limits.lower);
      if (n.limits?.upper) children.push(n.limits.upper);
      return children;
    }
    case 'matrix':
      return n.rows.flat();
    default:
      return [];
  }
}

/**
 * Map over all children of a node, creating a new node with transformed children
 */
export function mapChildren(n: MathNode, fn: (child: MathNode) => MathNode): MathNode {
  switch (n.kind) {
    case 'row':
      return node.row(n.children.map(fn));
    case 'fraction':
      return node.fraction(fn(n.numerator), fn(n.denominator));
    case 'power':
      return node.power(fn(n.base), fn(n.exponent));
    case 'subscript':
      return node.subscript(fn(n.base), fn(n.subscript));
    case 'subsup':
      return node.subsup(fn(n.base), fn(n.subscript), fn(n.superscript));
    case 'sqrt':
      return node.sqrt(fn(n.radicand), n.index ? fn(n.index) : undefined);
    case 'parens':
      return node.parens(fn(n.content), n.open, n.close, n.size);
    case 'function':
      return node.function(
        n.name,
        n.argument ? fn(n.argument) : undefined,
        n.limits
          ? {
              lower: n.limits.lower ? fn(n.limits.lower) : undefined,
              upper: n.limits.upper ? fn(n.limits.upper) : undefined,
            }
          : undefined
      );
    case 'matrix':
      return node.matrix(
        n.rows.map((row) => row.map(fn)),
        n.style,
        n.colSpec
      );
    default:
      return n;
  }
}

/**
 * Deep equality check for two nodes
 */
export function nodesEqual(a: MathNode, b: MathNode): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'number':
    case 'symbol':
    case 'operator':
    case 'text':
      return a.value === (b as typeof a).value;
    case 'space':
      return a.size === (b as SpaceNode).size;
    case 'placeholder':
      return true;
    case 'row': {
      const bRow = b as RowNode;
      return a.children.length === bRow.children.length && a.children.every((c, i) => nodesEqual(c, bRow.children[i]));
    }
    case 'fraction': {
      const bFrac = b as FractionNode;
      return nodesEqual(a.numerator, bFrac.numerator) && nodesEqual(a.denominator, bFrac.denominator);
    }
    case 'power': {
      const bPow = b as PowerNode;
      return nodesEqual(a.base, bPow.base) && nodesEqual(a.exponent, bPow.exponent);
    }
    case 'subscript': {
      const bSub = b as SubscriptNode;
      return nodesEqual(a.base, bSub.base) && nodesEqual(a.subscript, bSub.subscript);
    }
    case 'subsup': {
      const bSubSup = b as SubSupNode;
      return (
        nodesEqual(a.base, bSubSup.base) &&
        nodesEqual(a.subscript, bSubSup.subscript) &&
        nodesEqual(a.superscript, bSubSup.superscript)
      );
    }
    case 'sqrt': {
      const bSqrt = b as SqrtNode;
      if (!nodesEqual(a.radicand, bSqrt.radicand)) return false;
      if (a.index && bSqrt.index) return nodesEqual(a.index, bSqrt.index);
      return !a.index && !bSqrt.index;
    }
    case 'parens': {
      const bParens = b as ParensNode;
      return (
        a.open === bParens.open &&
        a.close === bParens.close &&
        a.size === bParens.size &&
        nodesEqual(a.content, bParens.content)
      );
    }
    case 'function': {
      const bFunc = b as FunctionNode;
      if (a.name !== bFunc.name) return false;
      if (a.argument && bFunc.argument) {
        if (!nodesEqual(a.argument, bFunc.argument)) return false;
      } else if (a.argument || bFunc.argument) {
        return false;
      }
      // Compare limits
      if (a.limits && bFunc.limits) {
        if (a.limits.lower && bFunc.limits.lower) {
          if (!nodesEqual(a.limits.lower, bFunc.limits.lower)) return false;
        } else if (a.limits.lower || bFunc.limits.lower) {
          return false;
        }
        if (a.limits.upper && bFunc.limits.upper) {
          if (!nodesEqual(a.limits.upper, bFunc.limits.upper)) return false;
        } else if (a.limits.upper || bFunc.limits.upper) {
          return false;
        }
      } else if (a.limits || bFunc.limits) {
        return false;
      }
      return true;
    }
    case 'matrix': {
      const bMatrix = b as MatrixNode;
      if (a.style !== bMatrix.style) return false;
      if (a.colSpec !== bMatrix.colSpec) return false;
      if (a.rows.length !== bMatrix.rows.length) return false;
      return a.rows.every((row, i) => {
        const bRow = bMatrix.rows[i];
        return row.length === bRow.length && row.every((cell, j) => nodesEqual(cell, bRow[j]));
      });
    }
    default:
      return false;
  }
}

// =============================================================================
// Editor Normalization
// =============================================================================

/**
 * Normalize an AST for use in the editor.
 *
 * This ensures:
 * 1. Root is always a row (wraps non-row roots)
 * 2. Empty ASTs become row([placeholder()])
 * 3. Structure slots (fraction num/denom, sqrt radicand, etc.) are rows
 *
 * The raw parser output should be used for display/serialization.
 * This normalized form is for editor state only.
 */
export function normalizeForEditor(ast: MathNode): RowNode {
  // First normalize the structure recursively
  const normalized = normalizeStructureSlots(ast);

  // Then ensure root is a row
  if (normalized.kind === 'row') {
    // Ensure non-empty row
    if (normalized.children.length === 0) {
      return node.row([node.placeholder()]);
    }
    return normalized;
  }

  // Wrap non-row in a row
  return node.row([normalized]);
}

/**
 * Recursively normalize structure slots to be rows.
 * This makes cursor navigation and insertion predictable.
 */
function normalizeStructureSlots(n: MathNode): MathNode {
  switch (n.kind) {
    case 'fraction': {
      const num = ensureRow(normalizeStructureSlots(n.numerator));
      const den = ensureRow(normalizeStructureSlots(n.denominator));
      return node.fraction(num, den);
    }
    case 'power': {
      const base = normalizeStructureSlots(n.base);
      const exp = ensureRow(normalizeStructureSlots(n.exponent));
      return node.power(base, exp);
    }
    case 'subscript': {
      const base = normalizeStructureSlots(n.base);
      const sub = ensureRow(normalizeStructureSlots(n.subscript));
      return node.subscript(base, sub);
    }
    case 'subsup': {
      const base = normalizeStructureSlots(n.base);
      const sub = ensureRow(normalizeStructureSlots(n.subscript));
      const sup = ensureRow(normalizeStructureSlots(n.superscript));
      return node.subsup(base, sub, sup);
    }
    case 'sqrt': {
      const radicand = ensureRow(normalizeStructureSlots(n.radicand));
      const index = n.index ? ensureRow(normalizeStructureSlots(n.index)) : undefined;
      return node.sqrt(radicand, index);
    }
    case 'parens': {
      const content = ensureRow(normalizeStructureSlots(n.content));
      return node.parens(content, n.open, n.close, n.size);
    }
    case 'row': {
      return node.row(n.children.map(normalizeStructureSlots));
    }
    case 'function': {
      const arg = n.argument ? ensureRow(normalizeStructureSlots(n.argument)) : undefined;
      const limits = n.limits ? {
        lower: n.limits.lower ? ensureRow(normalizeStructureSlots(n.limits.lower)) : undefined,
        upper: n.limits.upper ? ensureRow(normalizeStructureSlots(n.limits.upper)) : undefined,
      } : undefined;
      return node.function(n.name, arg, limits);
    }
    case 'matrix': {
      const rows = n.rows.map(row =>
        row.map(cell => ensureRow(normalizeStructureSlots(cell)))
      );
      return node.matrix(rows, n.style, n.colSpec);
    }
    default:
      return n;
  }
}

/**
 * Ensure a node is wrapped in a row.
 * If already a row, returns as-is.
 * If empty row, adds a placeholder.
 */
function ensureRow(n: MathNode): RowNode {
  if (n.kind === 'row') {
    if (n.children.length === 0) {
      return node.row([node.placeholder()]);
    }
    return n;
  }
  return node.row([n]);
}
