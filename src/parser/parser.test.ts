/**
 * Parser and Serializer Tests
 *
 * Tests round-trip parsing: LaTeX → AST → LaTeX
 * The output LaTeX doesn't need to be identical to input,
 * but must be semantically equivalent.
 */

import { describe, it, expect } from 'vitest';
import { parseLatex } from './latex-to-ast';
import { serializeToLatex } from './ast-to-latex';
import { node, nodesEqual } from '../core/ast';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse and re-serialize, then compare ASTs
 * This tests semantic equivalence, not string equality
 */
function roundTrip(latex: string): string {
  const ast = parseLatex(latex);
  return serializeToLatex(ast);
}

/**
 * Parse two LaTeX strings and compare their ASTs
 */
function astEqual(a: string, b: string): boolean {
  const astA = parseLatex(a);
  const astB = parseLatex(b);
  return nodesEqual(astA, astB);
}

// =============================================================================
// Basic Tests
// =============================================================================

describe('Parser: Numbers', () => {
  it('parses single digit', () => {
    expect(roundTrip('5')).toBe('5');
  });

  it('parses multi-digit number', () => {
    expect(roundTrip('123')).toBe('123');
  });

  it('parses decimal number', () => {
    expect(roundTrip('3.14')).toBe('3.14');
  });
});

describe('Parser: Symbols', () => {
  it('parses single letter', () => {
    expect(roundTrip('x')).toBe('x');
  });

  it('parses multiple letters as separate symbols', () => {
    const ast = parseLatex('xy');
    expect(ast.kind).toBe('row');
  });

  it('parses Greek letters', () => {
    expect(roundTrip('\\alpha')).toBe('\\alpha');
    expect(roundTrip('\\beta')).toBe('\\beta');
    expect(roundTrip('\\Gamma')).toBe('\\Gamma');
  });
});

describe('Parser: Operators', () => {
  it('parses simple operators', () => {
    expect(astEqual('x+y', 'x+y')).toBe(true);
    expect(astEqual('x-y', 'x-y')).toBe(true);
    expect(astEqual('x=y', 'x=y')).toBe(true);
  });

  it('parses command operators', () => {
    expect(roundTrip('x\\times y')).toContain('\\times');
    expect(roundTrip('x\\div y')).toContain('\\div');
    expect(roundTrip('x\\cdot y')).toContain('\\cdot');
  });

  it('parses comparison operators', () => {
    expect(roundTrip('x\\leq y')).toContain('\\leq');
    expect(roundTrip('x\\geq y')).toContain('\\geq');
    expect(roundTrip('x\\neq y')).toContain('\\neq');
  });
});

// =============================================================================
// Structure Tests
// =============================================================================

describe('Parser: Fractions', () => {
  it('parses simple fraction', () => {
    const result = roundTrip('\\frac{1}{2}');
    expect(result).toBe('\\frac{1}{2}');
  });

  it('parses fraction with expressions', () => {
    const result = roundTrip('\\frac{x+1}{y-1}');
    expect(result).toContain('\\frac');
    expect(result).toContain('x+1');
    expect(result).toContain('y-1');
  });

  it('parses nested fractions', () => {
    const result = roundTrip('\\frac{\\frac{1}{2}}{3}');
    expect(result).toContain('\\frac{\\frac{1}{2}}{3}');
  });
});

describe('Parser: Powers and Subscripts', () => {
  it('parses simple power', () => {
    expect(roundTrip('x^2')).toBe('x^2');
  });

  it('parses power with braces', () => {
    expect(roundTrip('x^{10}')).toBe('x^{10}');
  });

  it('parses simple subscript', () => {
    expect(roundTrip('x_1')).toBe('x_1');
  });

  it('parses subscript with braces', () => {
    expect(roundTrip('x_{ij}')).toBe('x_{ij}');
  });

  it('parses combined sub and superscript', () => {
    const result = roundTrip('x_1^2');
    expect(result).toContain('_');
    expect(result).toContain('^');
  });

  it('parses nested powers', () => {
    const result = roundTrip('x^{y^2}');
    expect(result).toContain('^{y^2}');
  });
});

describe('Parser: Square Roots', () => {
  it('parses simple sqrt', () => {
    expect(roundTrip('\\sqrt{x}')).toBe('\\sqrt{x}');
  });

  it('parses sqrt with expression', () => {
    const result = roundTrip('\\sqrt{x+1}');
    expect(result).toContain('\\sqrt');
  });

  it('parses nth root', () => {
    const result = roundTrip('\\sqrt[3]{x}');
    expect(result).toBe('\\sqrt[3]{x}');
  });

  it('parses nested sqrt', () => {
    const result = roundTrip('\\sqrt{\\sqrt{x}}');
    expect(result).toContain('\\sqrt{\\sqrt{x}}');
  });
});

describe('Parser: Parentheses', () => {
  it('parses simple parentheses', () => {
    const result = roundTrip('(x+1)');
    expect(result).toContain('(');
    expect(result).toContain(')');
  });

  it('parses brackets', () => {
    const result = roundTrip('[x+1]');
    expect(result).toContain('[');
    expect(result).toContain(']');
  });

  it('parses left/right parentheses', () => {
    const result = roundTrip('\\left(x+1\\right)');
    expect(result).toContain('\\left');
    expect(result).toContain('\\right');
  });

  it('parses left/right brackets', () => {
    const result = roundTrip('\\left[x+1\\right]');
    expect(result).toContain('\\left');
    expect(result).toContain('\\right');
  });
});

// =============================================================================
// Function Tests
// =============================================================================

describe('Parser: Functions', () => {
  it('parses trig functions', () => {
    expect(roundTrip('\\sin x')).toContain('\\sin');
    expect(roundTrip('\\cos x')).toContain('\\cos');
    expect(roundTrip('\\tan x')).toContain('\\tan');
  });

  it('parses log functions', () => {
    expect(roundTrip('\\log x')).toContain('\\log');
    expect(roundTrip('\\ln x')).toContain('\\ln');
  });

  it('parses limit', () => {
    expect(roundTrip('\\lim')).toContain('\\lim');
  });
});

describe('Parser: Large Operators', () => {
  it('parses sum', () => {
    const result = roundTrip('\\sum');
    expect(result).toContain('\\sum');
  });

  it('parses sum with limits', () => {
    const result = roundTrip('\\sum_{i=1}^{n}');
    expect(result).toContain('\\sum');
    expect(result).toContain('_');
    expect(result).toContain('^');
  });

  it('parses integral', () => {
    const result = roundTrip('\\int');
    expect(result).toContain('\\int');
  });

  it('parses integral with limits', () => {
    const result = roundTrip('\\int_0^1');
    expect(result).toContain('\\int');
  });

  it('parses product', () => {
    const result = roundTrip('\\prod_{i=1}^{n}');
    expect(result).toContain('\\prod');
  });
});

// =============================================================================
// Matrix Tests
// =============================================================================

describe('Parser: Matrices', () => {
  it('parses simple matrix', () => {
    const latex = '\\begin{matrix}a & b \\\\ c & d\\end{matrix}';
    const result = roundTrip(latex);
    expect(result).toContain('\\begin{matrix}');
    expect(result).toContain('\\end{matrix}');
    expect(result).toContain('&');
    expect(result).toContain('\\\\');
  });

  it('parses pmatrix (parenthesized)', () => {
    const latex = '\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}';
    const result = roundTrip(latex);
    expect(result).toContain('\\begin{pmatrix}');
  });

  it('parses bmatrix (bracketed)', () => {
    const latex = '\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}';
    const result = roundTrip(latex);
    expect(result).toContain('\\begin{bmatrix}');
  });

  it('parses vmatrix (vertical bars)', () => {
    const latex = '\\begin{vmatrix}a & b \\\\ c & d\\end{vmatrix}';
    const result = roundTrip(latex);
    expect(result).toContain('\\begin{vmatrix}');
  });

  it('parses array with column spec', () => {
    const latex = '\\begin{array}{cc}1 & 2 \\\\ 3 & 4\\end{array}';
    const result = roundTrip(latex);
    expect(result).toContain('\\begin{array}');
    expect(result).toContain('{cc}');
  });

  it('parses 3x3 matrix', () => {
    const latex = '\\begin{matrix}1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9\\end{matrix}';
    const ast = parseLatex(latex);
    expect(ast.kind).toBe('matrix');
    if (ast.kind === 'matrix') {
      expect(ast.rows.length).toBe(3);
      expect(ast.rows[0].length).toBe(3);
    }
  });
});

// =============================================================================
// Text Tests
// =============================================================================

describe('Parser: Text', () => {
  it('parses text command', () => {
    const result = roundTrip('\\text{hello}');
    expect(result).toBe('\\text{hello}');
  });

  it('parses text with spaces', () => {
    const result = roundTrip('\\text{hello world}');
    expect(result).toContain('hello world');
  });
});

// =============================================================================
// Complex Expression Tests
// =============================================================================

describe('Parser: Complex Expressions', () => {
  it('parses quadratic formula', () => {
    const latex = '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}';
    const ast = parseLatex(latex);
    expect(ast.kind).toBe('fraction');
  });

  it('parses Pythagorean theorem', () => {
    const latex = 'a^2+b^2=c^2';
    const ast = parseLatex(latex);
    expect(ast.kind).toBe('row');
  });

  it('parses Euler identity', () => {
    const latex = 'e^{i\\pi}+1=0';
    const ast = parseLatex(latex);
    expect(ast.kind).toBe('row');
  });

  it('parses summation formula', () => {
    const latex = '\\sum_{i=1}^{n}i=\\frac{n(n+1)}{2}';
    const ast = parseLatex(latex);
    expect(ast.kind).toBe('row');
  });

  it('parses integral', () => {
    const latex = '\\int_0^\\infty e^{-x}dx';
    const ast = parseLatex(latex);
    expect(ast.kind).toBe('row');
  });
});

// =============================================================================
// AST Builder Tests
// =============================================================================

describe('AST Builders', () => {
  it('creates number node', () => {
    const n = node.number('42');
    expect(n.kind).toBe('number');
    expect(n.value).toBe('42');
  });

  it('creates symbol node', () => {
    const n = node.symbol('x');
    expect(n.kind).toBe('symbol');
    expect(n.value).toBe('x');
  });

  it('creates fraction node', () => {
    const n = node.fraction(node.number('1'), node.number('2'));
    expect(n.kind).toBe('fraction');
    expect(n.numerator.kind).toBe('number');
    expect(n.denominator.kind).toBe('number');
  });

  it('creates power node', () => {
    const n = node.power(node.symbol('x'), node.number('2'));
    expect(n.kind).toBe('power');
  });

  it('creates matrix node', () => {
    const n = node.matrix(
      [
        [node.number('1'), node.number('2')],
        [node.number('3'), node.number('4')],
      ],
      'pmatrix'
    );
    expect(n.kind).toBe('matrix');
    expect(n.style).toBe('pmatrix');
    expect(n.rows.length).toBe(2);
  });
});

// =============================================================================
// Node Equality Tests
// =============================================================================

describe('Node Equality', () => {
  it('compares equal numbers', () => {
    expect(nodesEqual(node.number('5'), node.number('5'))).toBe(true);
    expect(nodesEqual(node.number('5'), node.number('6'))).toBe(false);
  });

  it('compares equal symbols', () => {
    expect(nodesEqual(node.symbol('x'), node.symbol('x'))).toBe(true);
    expect(nodesEqual(node.symbol('x'), node.symbol('y'))).toBe(false);
  });

  it('compares equal fractions', () => {
    const f1 = node.fraction(node.number('1'), node.number('2'));
    const f2 = node.fraction(node.number('1'), node.number('2'));
    const f3 = node.fraction(node.number('1'), node.number('3'));
    expect(nodesEqual(f1, f2)).toBe(true);
    expect(nodesEqual(f1, f3)).toBe(false);
  });

  it('compares parsed expressions', () => {
    const a = parseLatex('x^2');
    const b = parseLatex('x^2');
    const c = parseLatex('x^3');
    expect(nodesEqual(a, b)).toBe(true);
    expect(nodesEqual(a, c)).toBe(false);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Parser: Edge Cases', () => {
  it('handles empty input', () => {
    const ast = parseLatex('');
    expect(ast.kind).toBe('placeholder');
  });

  it('handles whitespace only', () => {
    const ast = parseLatex('   ');
    expect(ast.kind).toBe('placeholder');
  });

  it('handles nested braces', () => {
    const result = roundTrip('{{x}}');
    // Should simplify to just x
    expect(result).toBe('x');
  });

  it('handles consecutive operators', () => {
    const ast = parseLatex('x+-y');
    expect(ast.kind).toBe('row');
  });
});
