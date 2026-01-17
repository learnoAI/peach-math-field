/**
 * Playground - test the parser interactively
 * Run with: npx tsx playground.ts
 */

import { parseLatex, serializeToLatex, node } from './src/index';

console.log('=== peach-math-field Playground ===\n');

// Test some expressions
const testCases = [
  'x^2 + y^2 = z^2',
  '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
  '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
  '\\int_0^\\infty e^{-x} dx',
  '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
  '\\sqrt[3]{x^2 + 1}',
];

for (const latex of testCases) {
  console.log(`Input:  ${latex}`);
  try {
    const ast = parseLatex(latex);
    const output = serializeToLatex(ast);
    console.log(`Output: ${output}`);
    console.log(`AST:    ${ast.kind}`);
  } catch (e) {
    console.log(`Error:  ${e}`);
  }
  console.log('');
}

// Build AST programmatically
console.log('=== Programmatic AST Building ===\n');

const quadratic = node.fraction(
  node.row([
    node.operator('-'),
    node.symbol('b'),
    node.operator('pm'),
    node.sqrt(
      node.row([
        node.power(node.symbol('b'), node.number('2')),
        node.operator('-'),
        node.number('4'),
        node.symbol('a'),
        node.symbol('c'),
      ])
    ),
  ]),
  node.row([node.number('2'), node.symbol('a')])
);

console.log('Quadratic formula (built programmatically):');
console.log(serializeToLatex(quadratic));
console.log('');

// Matrix example
const matrix = node.matrix(
  [
    [node.number('1'), node.number('0')],
    [node.number('0'), node.number('1')],
  ],
  'bmatrix'
);

console.log('Identity matrix:');
console.log(serializeToLatex(matrix));
