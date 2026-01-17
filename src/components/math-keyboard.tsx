/**
 * MathKeyboard - Virtual keyboard for math input
 *
 * A full-featured virtual keyboard for entering mathematical expressions,
 * similar to MathLive's keyboard. Includes tabs for different symbol categories.
 */

import React, { useState, useCallback } from 'react';
import type { MathFieldRef } from './math-field';

// =============================================================================
// Types
// =============================================================================

export interface MathKeyboardProps {
  /** Reference to the MathField to send input to */
  mathFieldRef: React.RefObject<MathFieldRef>;
  /** Whether the keyboard is visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Additional CSS class */
  className?: string;
}

type KeyboardTab = 'basic' | 'greek' | 'operators' | 'structures' | 'matrices' | 'arrows' | 'sets';

interface KeyDefinition {
  /** Display label (can be LaTeX rendered or text) */
  label: string;
  /** What to insert (latex command or character) */
  insert?: string;
  /** Command to execute (for structures) */
  command?: string;
  /** Tooltip/title */
  title?: string;
  /** Width multiplier (1 = normal, 2 = double, etc.) */
  width?: number;
  /** Custom class for styling */
  className?: string;
}

// =============================================================================
// Key Definitions
// =============================================================================

const BASIC_KEYS: KeyDefinition[][] = [
  // Structure buttons row
  [
    { label: '⬚/⬚', command: 'fraction', title: 'Fraction', className: 'key-action' },
    { label: '√⬚', command: 'sqrt', title: 'Square root', className: 'key-action' },
    { label: 'xⁿ', command: 'superscript', title: 'Superscript/Power', className: 'key-action' },
    { label: 'xₙ', command: 'subscript', title: 'Subscript', className: 'key-action' },
    { label: '⌫', command: 'backspace', title: 'Backspace', className: 'key-action' },
  ],
  [
    { label: '7', insert: '7' },
    { label: '8', insert: '8' },
    { label: '9', insert: '9' },
    { label: '÷', insert: '\\div', title: 'Division' },
    { label: '(', insert: '(' },
  ],
  [
    { label: '4', insert: '4' },
    { label: '5', insert: '5' },
    { label: '6', insert: '6' },
    { label: '×', insert: '\\times', title: 'Multiplication' },
    { label: ')', insert: ')' },
  ],
  [
    { label: '1', insert: '1' },
    { label: '2', insert: '2' },
    { label: '3', insert: '3' },
    { label: '−', insert: '-', title: 'Minus' },
    { label: '[', insert: '[' },
  ],
  [
    { label: '0', insert: '0' },
    { label: '.', insert: '.' },
    { label: '=', insert: '=' },
    { label: '+', insert: '+' },
    { label: ']', insert: ']' },
  ],
  [
    { label: 'x', insert: 'x' },
    { label: 'y', insert: 'y' },
    { label: 'z', insert: 'z' },
    { label: 'n', insert: 'n' },
    { label: '±', insert: '\\pm', title: 'Plus-minus' },
  ],
];

const GREEK_KEYS: KeyDefinition[][] = [
  [
    { label: 'α', insert: '\\alpha', title: 'alpha' },
    { label: 'β', insert: '\\beta', title: 'beta' },
    { label: 'γ', insert: '\\gamma', title: 'gamma' },
    { label: 'δ', insert: '\\delta', title: 'delta' },
    { label: 'ε', insert: '\\epsilon', title: 'epsilon' },
    { label: 'ζ', insert: '\\zeta', title: 'zeta' },
  ],
  [
    { label: 'η', insert: '\\eta', title: 'eta' },
    { label: 'θ', insert: '\\theta', title: 'theta' },
    { label: 'ι', insert: '\\iota', title: 'iota' },
    { label: 'κ', insert: '\\kappa', title: 'kappa' },
    { label: 'λ', insert: '\\lambda', title: 'lambda' },
    { label: 'μ', insert: '\\mu', title: 'mu' },
  ],
  [
    { label: 'ν', insert: '\\nu', title: 'nu' },
    { label: 'ξ', insert: '\\xi', title: 'xi' },
    { label: 'π', insert: '\\pi', title: 'pi' },
    { label: 'ρ', insert: '\\rho', title: 'rho' },
    { label: 'σ', insert: '\\sigma', title: 'sigma' },
    { label: 'τ', insert: '\\tau', title: 'tau' },
  ],
  [
    { label: 'υ', insert: '\\upsilon', title: 'upsilon' },
    { label: 'φ', insert: '\\phi', title: 'phi' },
    { label: 'χ', insert: '\\chi', title: 'chi' },
    { label: 'ψ', insert: '\\psi', title: 'psi' },
    { label: 'ω', insert: '\\omega', title: 'omega' },
    { label: 'ϕ', insert: '\\varphi', title: 'varphi' },
  ],
  [
    { label: 'Γ', insert: '\\Gamma', title: 'Gamma' },
    { label: 'Δ', insert: '\\Delta', title: 'Delta' },
    { label: 'Θ', insert: '\\Theta', title: 'Theta' },
    { label: 'Λ', insert: '\\Lambda', title: 'Lambda' },
    { label: 'Π', insert: '\\Pi', title: 'Pi' },
    { label: 'Σ', insert: '\\Sigma', title: 'Sigma' },
  ],
  [
    { label: 'Φ', insert: '\\Phi', title: 'Phi' },
    { label: 'Ψ', insert: '\\Psi', title: 'Psi' },
    { label: 'Ω', insert: '\\Omega', title: 'Omega' },
    { label: 'ϑ', insert: '\\vartheta', title: 'vartheta' },
    { label: 'ϵ', insert: '\\varepsilon', title: 'varepsilon' },
    { label: 'ς', insert: '\\varsigma', title: 'varsigma' },
  ],
];

const OPERATOR_KEYS: KeyDefinition[][] = [
  [
    { label: '≤', insert: '\\leq', title: 'Less than or equal' },
    { label: '≥', insert: '\\geq', title: 'Greater than or equal' },
    { label: '≠', insert: '\\neq', title: 'Not equal' },
    { label: '≈', insert: '\\approx', title: 'Approximately' },
    { label: '≡', insert: '\\equiv', title: 'Equivalent' },
    { label: '∼', insert: '\\sim', title: 'Similar' },
  ],
  [
    { label: '<', insert: '<' },
    { label: '>', insert: '>' },
    { label: '≪', insert: '\\ll', title: 'Much less than' },
    { label: '≫', insert: '\\gg', title: 'Much greater than' },
    { label: '∝', insert: '\\propto', title: 'Proportional to' },
    { label: '≅', insert: '\\cong', title: 'Congruent' },
  ],
  [
    { label: '·', insert: '\\cdot', title: 'Center dot' },
    { label: '∗', insert: '\\ast', title: 'Asterisk' },
    { label: '∘', insert: '\\circ', title: 'Circle' },
    { label: '•', insert: '\\bullet', title: 'Bullet' },
    { label: '⊕', insert: '\\oplus', title: 'Direct sum' },
    { label: '⊗', insert: '\\otimes', title: 'Tensor product' },
  ],
  [
    { label: '∞', insert: '\\infty', title: 'Infinity' },
    { label: '∂', insert: '\\partial', title: 'Partial derivative' },
    { label: '∇', insert: '\\nabla', title: 'Nabla/Del' },
    { label: '′', insert: "'", title: 'Prime' },
    { label: '″', insert: "''", title: 'Double prime' },
    { label: '°', insert: '^\\circ', title: 'Degree' },
  ],
  [
    { label: '!', insert: '!' },
    { label: '%', insert: '\\%', title: 'Percent' },
    { label: '|', insert: '|', title: 'Vertical bar' },
    { label: '‖', insert: '\\|', title: 'Double vertical bar' },
    { label: '…', insert: '\\ldots', title: 'Ellipsis' },
    { label: '⋯', insert: '\\cdots', title: 'Center dots' },
  ],
];

const STRUCTURE_KEYS: KeyDefinition[][] = [
  [
    { label: 'a/b', command: 'fraction', title: 'Fraction' },
    { label: '√', command: 'sqrt', title: 'Square root' },
    { label: 'xⁿ', command: 'superscript', title: 'Superscript/Power' },
    { label: 'xₙ', command: 'subscript', title: 'Subscript' },
    { label: '( )', command: 'parens', title: 'Parentheses' },
    { label: '[ ]', command: 'brackets', title: 'Brackets' },
  ],
  [
    { label: 'x²', insert: '^2', title: 'Square' },
    { label: 'x³', insert: '^3', title: 'Cube' },
    { label: 'xⁿ', insert: '^n', title: 'Power of n' },
    { label: 'x⁻¹', insert: '^{-1}', title: 'Inverse' },
    { label: 'eˣ', insert: 'e^', title: 'Exponential' },
    { label: '10ˣ', insert: '10^', title: 'Power of 10' },
  ],
  [
    { label: 'sin', insert: '\\sin', title: 'Sine' },
    { label: 'cos', insert: '\\cos', title: 'Cosine' },
    { label: 'tan', insert: '\\tan', title: 'Tangent' },
    { label: 'cot', insert: '\\cot', title: 'Cotangent' },
    { label: 'sec', insert: '\\sec', title: 'Secant' },
    { label: 'csc', insert: '\\csc', title: 'Cosecant' },
  ],
  [
    { label: 'sin⁻¹', insert: '\\arcsin', title: 'Arc sine' },
    { label: 'cos⁻¹', insert: '\\arccos', title: 'Arc cosine' },
    { label: 'tan⁻¹', insert: '\\arctan', title: 'Arc tangent' },
    { label: 'ln', insert: '\\ln', title: 'Natural log' },
    { label: 'log', insert: '\\log', title: 'Logarithm' },
    { label: 'exp', insert: '\\exp', title: 'Exponential' },
  ],
  [
    { label: '∑', insert: '\\sum', title: 'Sum' },
    { label: '∏', insert: '\\prod', title: 'Product' },
    { label: '∫', insert: '\\int', title: 'Integral' },
    { label: '∬', insert: '\\iint', title: 'Double integral' },
    { label: '∮', insert: '\\oint', title: 'Contour integral' },
    { label: 'lim', insert: '\\lim', title: 'Limit' },
  ],
];

const ARROW_KEYS: KeyDefinition[][] = [
  [
    { label: '→', insert: '\\rightarrow', title: 'Right arrow' },
    { label: '←', insert: '\\leftarrow', title: 'Left arrow' },
    { label: '↔', insert: '\\leftrightarrow', title: 'Left-right arrow' },
    { label: '↑', insert: '\\uparrow', title: 'Up arrow' },
    { label: '↓', insert: '\\downarrow', title: 'Down arrow' },
    { label: '↕', insert: '\\updownarrow', title: 'Up-down arrow' },
  ],
  [
    { label: '⇒', insert: '\\Rightarrow', title: 'Double right arrow' },
    { label: '⇐', insert: '\\Leftarrow', title: 'Double left arrow' },
    { label: '⇔', insert: '\\Leftrightarrow', title: 'Double left-right arrow' },
    { label: '⇑', insert: '\\Uparrow', title: 'Double up arrow' },
    { label: '⇓', insert: '\\Downarrow', title: 'Double down arrow' },
    { label: '⇕', insert: '\\Updownarrow', title: 'Double up-down arrow' },
  ],
  [
    { label: '↦', insert: '\\mapsto', title: 'Maps to' },
    { label: '⟼', insert: '\\longmapsto', title: 'Long maps to' },
    { label: '⟹', insert: '\\implies', title: 'Implies' },
    { label: '⟺', insert: '\\iff', title: 'If and only if' },
    { label: '↗', insert: '\\nearrow', title: 'Northeast arrow' },
    { label: '↘', insert: '\\searrow', title: 'Southeast arrow' },
  ],
];

const SET_KEYS: KeyDefinition[][] = [
  [
    { label: '∈', insert: '\\in', title: 'Element of' },
    { label: '∉', insert: '\\notin', title: 'Not element of' },
    { label: '∋', insert: '\\ni', title: 'Contains' },
    { label: '⊂', insert: '\\subset', title: 'Subset' },
    { label: '⊃', insert: '\\supset', title: 'Superset' },
    { label: '⊆', insert: '\\subseteq', title: 'Subset or equal' },
  ],
  [
    { label: '⊇', insert: '\\supseteq', title: 'Superset or equal' },
    { label: '∪', insert: '\\cup', title: 'Union' },
    { label: '∩', insert: '\\cap', title: 'Intersection' },
    { label: '∅', insert: '\\emptyset', title: 'Empty set' },
    { label: '\\', insert: '\\setminus', title: 'Set minus' },
    { label: '|', insert: '\\mid', title: 'Divides' },
  ],
  [
    { label: '∀', insert: '\\forall', title: 'For all' },
    { label: '∃', insert: '\\exists', title: 'Exists' },
    { label: '∄', insert: '\\nexists', title: 'Does not exist' },
    { label: '¬', insert: '\\neg', title: 'Negation' },
    { label: '∧', insert: '\\land', title: 'Logical and' },
    { label: '∨', insert: '\\lor', title: 'Logical or' },
  ],
  [
    { label: 'ℕ', insert: '\\mathbb{N}', title: 'Natural numbers' },
    { label: 'ℤ', insert: '\\mathbb{Z}', title: 'Integers' },
    { label: 'ℚ', insert: '\\mathbb{Q}', title: 'Rationals' },
    { label: 'ℝ', insert: '\\mathbb{R}', title: 'Real numbers' },
    { label: 'ℂ', insert: '\\mathbb{C}', title: 'Complex numbers' },
    { label: '∈', insert: '\\in', title: 'Element of' },
  ],
];

const MATRIX_KEYS: KeyDefinition[][] = [
  // 2x2 matrices with different bracket styles
  [
    { label: '(2×2)', command: 'matrix:2x2:pmatrix', title: '2×2 matrix with parentheses' },
    { label: '[2×2]', command: 'matrix:2x2:bmatrix', title: '2×2 matrix with brackets' },
    { label: '{2×2}', command: 'matrix:2x2:Bmatrix', title: '2×2 matrix with braces' },
    { label: '|2×2|', command: 'matrix:2x2:vmatrix', title: '2×2 determinant' },
    { label: '‖2×2‖', command: 'matrix:2x2:Vmatrix', title: '2×2 norm matrix' },
  ],
  // 3x3 matrices
  [
    { label: '(3×3)', command: 'matrix:3x3:pmatrix', title: '3×3 matrix with parentheses' },
    { label: '[3×3]', command: 'matrix:3x3:bmatrix', title: '3×3 matrix with brackets' },
    { label: '{3×3}', command: 'matrix:3x3:Bmatrix', title: '3×3 matrix with braces' },
    { label: '|3×3|', command: 'matrix:3x3:vmatrix', title: '3×3 determinant' },
    { label: '‖3×3‖', command: 'matrix:3x3:Vmatrix', title: '3×3 norm matrix' },
  ],
  // Common matrix sizes
  [
    { label: '(2×3)', command: 'matrix:2x3:pmatrix', title: '2×3 matrix' },
    { label: '(3×2)', command: 'matrix:3x2:pmatrix', title: '3×2 matrix' },
    { label: '(1×3)', command: 'matrix:1x3:pmatrix', title: 'Row vector (1×3)' },
    { label: '(3×1)', command: 'matrix:3x1:pmatrix', title: 'Column vector (3×1)' },
    { label: '(4×4)', command: 'matrix:4x4:pmatrix', title: '4×4 matrix' },
  ],
  // Plain matrices (no delimiters)
  [
    { label: '2×2', command: 'matrix:2x2:matrix', title: '2×2 matrix (no delimiters)' },
    { label: '3×3', command: 'matrix:3x3:matrix', title: '3×3 matrix (no delimiters)' },
    { label: '2×3', command: 'matrix:2x3:matrix', title: '2×3 matrix (no delimiters)' },
    { label: '3×2', command: 'matrix:3x2:matrix', title: '3×2 matrix (no delimiters)' },
    { label: '1×4', command: 'matrix:1x4:matrix', title: 'Row vector (1×4, no delimiters)' },
  ],
  // Vectors with brackets
  [
    { label: '[1×2]', command: 'matrix:1x2:bmatrix', title: 'Row vector [1×2]' },
    { label: '[2×1]', command: 'matrix:2x1:bmatrix', title: 'Column vector [2×1]' },
    { label: '[1×4]', command: 'matrix:1x4:bmatrix', title: 'Row vector [1×4]' },
    { label: '[4×1]', command: 'matrix:4x1:bmatrix', title: 'Column vector [4×1]' },
    { label: '⋮⋯', insert: '\\vdots', title: 'Vertical dots' },
  ],
];

const TAB_DEFINITIONS: Record<KeyboardTab, { label: string; keys: KeyDefinition[][] }> = {
  basic: { label: '123', keys: BASIC_KEYS },
  greek: { label: 'αβγ', keys: GREEK_KEYS },
  operators: { label: '≤≥', keys: OPERATOR_KEYS },
  structures: { label: '∑∫', keys: STRUCTURE_KEYS },
  matrices: { label: '[ ]', keys: MATRIX_KEYS },
  arrows: { label: '→⇒', keys: ARROW_KEYS },
  sets: { label: '∈∪', keys: SET_KEYS },
};

// =============================================================================
// Component
// =============================================================================

export const MathKeyboard: React.FC<MathKeyboardProps> = ({
  mathFieldRef,
  visible = true,
  onVisibilityChange,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<KeyboardTab>('basic');

  const handleKeyPress = useCallback(
    (key: KeyDefinition) => {
      const mathField = mathFieldRef.current;
      if (!mathField) return;

      // Focus the math field first
      mathField.focus();

      if (key.command) {
        // Execute a command (like fraction, sqrt, etc.)
        if (key.command === 'backspace') {
          mathField.deleteBackward();
        } else {
          mathField.insertCommand(key.command);
        }
      } else if (key.insert) {
        // Insert text/latex at cursor position
        mathField.insert(key.insert);
      }
    },
    [mathFieldRef]
  );

  if (!visible) return null;

  const currentKeys = TAB_DEFINITIONS[activeTab].keys;

  // Prevent mousedown from stealing focus from the math field
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className={`math-keyboard ${className}`} onMouseDown={preventFocusLoss}>
      {/* Tab bar */}
      <div className="math-keyboard-tabs">
        {(Object.keys(TAB_DEFINITIONS) as KeyboardTab[]).map((tab) => (
          <button
            key={tab}
            className={`math-keyboard-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            title={tab}
          >
            {TAB_DEFINITIONS[tab].label}
          </button>
        ))}
        {onVisibilityChange && (
          <button
            className="math-keyboard-tab math-keyboard-close"
            onClick={() => onVisibilityChange(false)}
            title="Close keyboard"
          >
            ✕
          </button>
        )}
      </div>

      {/* Key grid */}
      <div className="math-keyboard-keys">
        {currentKeys.map((row, rowIndex) => (
          <div key={rowIndex} className="math-keyboard-row">
            {row.map((key, keyIndex) => (
              <button
                key={keyIndex}
                className={`math-keyboard-key ${key.className || ''}`}
                onClick={() => handleKeyPress(key)}
                title={key.title}
                style={key.width ? { flex: key.width } : undefined}
              >
                {key.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MathKeyboard;
