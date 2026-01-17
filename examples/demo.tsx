/**
 * Demo - Test the MathDisplay component
 *
 * This is a simple demo to test the rendering.
 * For a real app, you'd import from 'peach-math-field'.
 */

import * as React from 'react';
import { renderToString } from '../src/renderer/katex-renderer';

// Since we can't run a full React app easily, let's just test the renderer
console.log('=== MathDisplay Demo ===\n');

const examples = [
  { latex: 'x^2 + y^2 = z^2', label: 'Pythagorean theorem' },
  { latex: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', label: 'Quadratic formula' },
  { latex: 'e^{i\\pi} + 1 = 0', label: 'Euler identity' },
  { latex: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}', label: 'Basel problem' },
  { latex: '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}', label: 'Gaussian integral' },
  {
    latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    label: '2x2 matrix',
  },
  { latex: '\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}', label: 'Maxwell equation' },
];

for (const { latex, label } of examples) {
  console.log(`${label}:`);
  console.log(`  LaTeX: ${latex}`);

  const result = renderToString(latex, { displayMode: true });
  if (result.error) {
    console.log(`  Error: ${result.error.message}`);
  } else {
    console.log(`  HTML length: ${result.html.length} chars`);
  }
  console.log('');
}

// Test error handling
console.log('=== Error Handling ===\n');
const invalidLatex = '\\frac{1}{';
const errorResult = renderToString(invalidLatex);
console.log(`Invalid LaTeX: ${invalidLatex}`);
console.log(`Error: ${errorResult.error?.message}`);
console.log(`Fallback HTML: ${errorResult.html}`);
