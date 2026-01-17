/**
 * MathField - Interactive math editor component
 *
 * Uses a hybrid approach:
 * - Renders math via KaTeX (read-only DOM)
 * - Captures keyboard input via hidden input
 * - Custom cursor/selection rendering
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useId,
} from 'react';
import { renderToString, RenderOptions } from '../renderer/katex-renderer';
import { parseLatex } from '../parser/latex-to-ast';
import { serializeToLatex } from '../parser/ast-to-latex';
import {
  createEmptyState,
  createStateFromAST,
  EditorState,
  History,
  createHistory,
  pushHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
  isEmpty,
  updateSelection,
} from '../core/model';
import {
  insertCharacter,
  insertOperator,
  insertFraction,
  insertSqrt,
  insertParens,
  insertSuperscript,
  insertSubscript,
  insertMatrix,
  MatrixStyle,
} from '../core/commands/insert';
import {
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveToLineStart,
  moveToLineEnd,
  selectAll,
  moveToNextPlaceholder,
  moveToPreviousPlaceholder,
} from '../core/commands/navigate';
import { deleteBackward, deleteForward } from '../core/commands/delete';
import { isCollapsed, collapsedSelection, extractSelectedNodes } from '../core/selection';
import { cursor } from '../core/cursor';
import { MathNode, node as nodeBuilder } from '../core/ast';
import '../styles/math-field.css';

// =============================================================================
// Types
// =============================================================================

export interface MathFieldProps {
  /** Controlled LaTeX value */
  value?: string;
  /** Callback when value changes */
  onChange?: (latex: string) => void;
  /** Callback when selection changes */
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** KaTeX render options */
  katexOptions?: RenderOptions;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Accessible label */
  'aria-label'?: string;
}

export interface MathFieldRef {
  /** Focus the field */
  focus: () => void;
  /** Blur the field */
  blur: () => void;
  /** Insert text/latex at cursor position */
  insert: (text: string) => void;
  /** Insert a command (fraction, sqrt, etc.) */
  insertCommand: (command: string) => void;
  /** Delete backward (backspace) */
  deleteBackward: () => void;
  /** Get current LaTeX */
  getLatex: () => string;
  /** Set LaTeX value */
  setLatex: (latex: string) => void;
  /** Undo last action */
  undo: () => void;
  /** Redo last undone action */
  redo: () => void;
  /** Check if can undo */
  canUndo: () => boolean;
  /** Check if can redo */
  canRedo: () => boolean;
}

// =============================================================================
// Component
// =============================================================================

export const MathField = forwardRef<MathFieldRef, MathFieldProps>(
  function MathField(props, ref) {
    const {
      value: controlledValue,
      onChange,
      onSelectionChange,
      placeholder = 'Enter math...',
      readOnly = false,
      disabled = false,
      autoFocus = false,
      katexOptions,
      className = '',
      style,
      'aria-label': ariaLabel = 'Math input field',
    } = props;

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const mathContainerRef = useRef<HTMLSpanElement>(null);

    // Generate unique IDs for accessibility
    const uniqueId = useId();
    const descriptionId = `pmf-description-${uniqueId}`;

    // State
    const [focused, setFocused] = useState(false);
    const [history, setHistory] = useState<History>(() => {
      const initialState = controlledValue
        ? createStateFromAST(parseLatex(controlledValue))
        : createEmptyState();
      return createHistory(initialState);
    });

    const state = history.present;

    // Derived state
    // Internal latex (with placeholders) for controlled value sync
    const internalLatex = serializeToLatex(state.root);
    // External latex (without placeholders) for onChange and getLatex
    const latex = serializeToLatex(state.root, { includePlaceholders: false });
    const isFieldEmpty = isEmpty(state);
    const cursorPos = state.selection.focus;
    const hasSelection = !isCollapsed(state.selection);

    // Sync with controlled value - only when parent explicitly sets a new value
    // Uses a ref to avoid stale closure issues while not triggering on internal changes
    const latexRef = useRef(latex);
    latexRef.current = latex;

    useEffect(() => {
      if (controlledValue !== undefined && controlledValue !== latexRef.current) {
        try {
          const ast = parseLatex(controlledValue);
          const newState = createStateFromAST(ast);
          setHistory(createHistory(newState));
        } catch (e) {
          // Invalid LaTeX, ignore
        }
      }
    }, [controlledValue]);

    // Notify parent of changes
    useEffect(() => {
      onChange?.(latex);
    }, [latex, onChange]);

    // Helper to compute linearized position (count of atoms before cursor)
    const computeLinearPosition = useCallback(
      (pos: { path: readonly number[]; offset: number }): number => {
        const countAtomsInNode = (node: MathNode): number => {
          switch (node.kind) {
            case 'row':
              return node.children.reduce((sum, child) => sum + countAtomsInNode(child), 0);
            case 'number':
            case 'symbol':
            case 'operator':
            case 'placeholder':
              return 1;
            case 'fraction':
              return 1 + countAtomsInNode(node.numerator) + countAtomsInNode(node.denominator);
            case 'power':
              return countAtomsInNode(node.base) + countAtomsInNode(node.exponent);
            case 'subscript':
              return countAtomsInNode(node.base) + countAtomsInNode(node.subscript);
            case 'subsup':
              return countAtomsInNode(node.base) + countAtomsInNode(node.subscript) + countAtomsInNode(node.superscript);
            case 'sqrt':
              return 1 + countAtomsInNode(node.radicand) + (node.index ? countAtomsInNode(node.index) : 0);
            case 'parens':
              return 2 + countAtomsInNode(node.content); // 2 for delimiters
            default:
              return 1;
          }
        };

        const countBeforePosition = (node: MathNode, path: readonly number[], offset: number, depth: number): number => {
          if (depth === path.length) {
            // We've reached the target - only rows have an offset within them
            if (node.kind === 'row') {
              let sum = 0;
              for (let i = 0; i < offset && i < node.children.length; i++) {
                sum += countAtomsInNode(node.children[i]);
              }
              return sum;
            }
            return 0;
          }

          const childIdx = path[depth];

          switch (node.kind) {
            case 'row': {
              // Count children before the one we're descending into
              let sum = 0;
              for (let i = 0; i < childIdx && i < node.children.length; i++) {
                sum += countAtomsInNode(node.children[i]);
              }
              if (childIdx < node.children.length) {
                sum += countBeforePosition(node.children[childIdx], path, offset, depth + 1);
              }
              return sum;
            }

            case 'fraction': {
              // childIdx 0 = numerator, childIdx 1 = denominator
              // Count 1 for the fraction itself (conceptually entering it)
              let sum = 0;
              if (childIdx === 0) {
                // In numerator
                sum += countBeforePosition(node.numerator, path, offset, depth + 1);
              } else if (childIdx === 1) {
                // In denominator - count numerator first
                sum += countAtomsInNode(node.numerator);
                sum += countBeforePosition(node.denominator, path, offset, depth + 1);
              }
              return sum;
            }

            case 'power': {
              // childIdx 0 = base, childIdx 1 = exponent
              let sum = 0;
              if (childIdx === 0) {
                sum += countBeforePosition(node.base, path, offset, depth + 1);
              } else if (childIdx === 1) {
                sum += countAtomsInNode(node.base);
                sum += countBeforePosition(node.exponent, path, offset, depth + 1);
              }
              return sum;
            }

            case 'subscript': {
              let sum = 0;
              if (childIdx === 0) {
                sum += countBeforePosition(node.base, path, offset, depth + 1);
              } else if (childIdx === 1) {
                sum += countAtomsInNode(node.base);
                sum += countBeforePosition(node.subscript, path, offset, depth + 1);
              }
              return sum;
            }

            case 'subsup': {
              // childIdx 0 = base, childIdx 1 = subscript, childIdx 2 = superscript
              let sum = 0;
              if (childIdx === 0) {
                sum += countBeforePosition(node.base, path, offset, depth + 1);
              } else if (childIdx === 1) {
                sum += countAtomsInNode(node.base);
                sum += countBeforePosition(node.subscript, path, offset, depth + 1);
              } else if (childIdx === 2) {
                sum += countAtomsInNode(node.base);
                sum += countAtomsInNode(node.subscript);
                sum += countBeforePosition(node.superscript, path, offset, depth + 1);
              }
              return sum;
            }

            case 'sqrt': {
              // childIdx 0 = radicand, childIdx 1 = index (if present)
              let sum = 0;
              if (childIdx === 0) {
                sum += countBeforePosition(node.radicand, path, offset, depth + 1);
              } else if (childIdx === 1 && node.index) {
                sum += countAtomsInNode(node.radicand);
                sum += countBeforePosition(node.index, path, offset, depth + 1);
              }
              return sum;
            }

            case 'parens': {
              // childIdx 0 = content
              // Count 1 for opening delimiter
              let sum = 1;
              if (childIdx === 0) {
                sum += countBeforePosition(node.content, path, offset, depth + 1);
              }
              return sum;
            }

            case 'matrix': {
              // Matrix cells are accessed by flat index
              // childIdx is the cell index (row * cols + col)
              let sum = 0;
              const cols = node.rows[0]?.length || 1;
              for (let i = 0; i < childIdx; i++) {
                const r = Math.floor(i / cols);
                const c = i % cols;
                if (r < node.rows.length && c < node.rows[r].length) {
                  sum += countAtomsInNode(node.rows[r][c]);
                }
              }
              const targetRow = Math.floor(childIdx / cols);
              const targetCol = childIdx % cols;
              if (targetRow < node.rows.length && targetCol < node.rows[targetRow].length) {
                sum += countBeforePosition(node.rows[targetRow][targetCol], path, offset, depth + 1);
              }
              return sum;
            }

            default:
              return 0;
          }
        };

        return countBeforePosition(state.root, pos.path, pos.offset, 0);
      },
      [state.root]
    );

    // Notify parent of selection changes
    useEffect(() => {
      if (onSelectionChange) {
        const { anchor, focus } = state.selection;
        const start = computeLinearPosition(anchor);
        const end = computeLinearPosition(focus);
        onSelectionChange({ start, end });
      }
    }, [state.selection, onSelectionChange, computeLinearPosition]);

    // Auto focus
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    // ==========================================================================
    // Command Execution
    // ==========================================================================

    const executeCommand = useCallback(
      (command: (state: EditorState) => EditorState | null, merge = false) => {
        if (readOnly || disabled) return;

        setHistory((h) => {
          const newState = command(h.present);
          if (newState) {
            return pushHistory(h, newState, { merge });
          }
          return h;
        });
      },
      [readOnly, disabled]
    );

    const undo = useCallback(() => {
      setHistory((h) => undoHistory(h));
    }, []);

    const redo = useCallback(() => {
      setHistory((h) => redoHistory(h));
    }, []);

    // ==========================================================================
    // Keyboard Handling
    // ==========================================================================

    // Copy LaTeX to clipboard
    const handleCopy = useCallback(() => {
      const { root, selection } = state;

      // If there's a selection, copy only the selected portion
      if (!isCollapsed(selection)) {
        const selectedNode = extractSelectedNodes(root, selection);
        if (selectedNode) {
          const selectedLatex = serializeToLatex(selectedNode, { includePlaceholders: false });
          if (selectedLatex) {
            navigator.clipboard.writeText(selectedLatex).catch(() => {
              // Fallback: do nothing on error
            });
            return;
          }
        }
      }

      // Otherwise copy the entire expression
      if (latex) {
        navigator.clipboard.writeText(latex).catch(() => {
          // Fallback: do nothing on error
        });
      }
    }, [state, latex]);

    // Paste from clipboard
    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (readOnly || disabled) return;

        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;

        // Insert each character (this handles LaTeX commands)
        for (const char of text) {
          if ('+-=<>'.includes(char)) {
            executeCommand(insertOperator(char), true);
          } else if (char === '*') {
            executeCommand(insertOperator('\\times'), true);
          } else if (char === '/') {
            executeCommand(insertFraction());
          } else if (char === '^') {
            executeCommand(insertSuperscript());
          } else if (char === '_') {
            executeCommand(insertSubscript());
          } else if ('([{'.includes(char)) {
            executeCommand(insertParens(char as '(' | '[' | '{'));
          } else if (char !== '\n' && char !== '\r') {
            executeCommand(insertCharacter(char), true);
          }
        }
      },
      [executeCommand, readOnly, disabled]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readOnly || disabled) return;

        const { key, ctrlKey, metaKey, shiftKey, altKey } = e;
        const cmd = ctrlKey || metaKey;

        // Prevent default for most keys
        let preventDefault = true;

        // Tab navigation between placeholders
        if (key === 'Tab' && !cmd && !altKey) {
          if (shiftKey) {
            executeCommand(moveToPreviousPlaceholder());
          } else {
            executeCommand(moveToNextPlaceholder());
          }

        // Copy
        } else if (cmd && key === 'c') {
          handleCopy();

        // Navigation
        } else if (key === 'ArrowLeft') {
          executeCommand(moveLeft(shiftKey));
        } else if (key === 'ArrowRight') {
          executeCommand(moveRight(shiftKey));
        } else if (key === 'ArrowUp') {
          executeCommand(moveUp(shiftKey));
        } else if (key === 'ArrowDown') {
          executeCommand(moveDown(shiftKey));
        } else if (key === 'Home') {
          executeCommand(moveToLineStart(shiftKey));
        } else if (key === 'End') {
          executeCommand(moveToLineEnd(shiftKey));

        // Deletion
        } else if (key === 'Backspace') {
          executeCommand(deleteBackward());
        } else if (key === 'Delete') {
          executeCommand(deleteForward());

        // Undo/Redo
        } else if (cmd && key === 'z' && !shiftKey) {
          undo();
        } else if (cmd && key === 'z' && shiftKey) {
          redo();
        } else if (cmd && key === 'y') {
          redo();

        // Select all
        } else if (cmd && key === 'a') {
          executeCommand(selectAll());

        // Structure commands
        } else if (key === '/' && !cmd) {
          executeCommand(insertFraction());
        } else if (key === '(' || key === '[' || key === '{') {
          executeCommand(insertParens(key as '(' | '[' | '{'));
        } else if (key === '^') {
          executeCommand(insertSuperscript());
        } else if (key === '_') {
          executeCommand(insertSubscript());

        // Special operators
        } else if (key === '*') {
          executeCommand(insertOperator('\\times'));
        } else if (key === '-' && altKey) {
          executeCommand(insertOperator('\\pm'));

        // Regular characters
        } else if (key.length === 1 && !cmd && !altKey) {
          // Merge continuous character input
          executeCommand(insertCharacter(key), true);

        } else {
          preventDefault = false;
        }

        if (preventDefault) {
          e.preventDefault();
        }
      },
      [executeCommand, undo, redo, readOnly, disabled, handleCopy]
    );

    // ==========================================================================
    // Focus Handling
    // ==========================================================================

    const handleFocus = useCallback(() => {
      setFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setFocused(false);
    }, []);

    const handleContainerClick = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    // Handle mousedown on the container for clicks in empty space
    // Child elements call stopPropagation, so this only fires for unhandled clicks
    const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || disabled) return;

      // Prevent default to avoid blur when focused
      e.preventDefault();

      if (focused) {
        // When focused and clicking on empty space, position cursor at end
        setHistory((h) => {
          const rootRow = h.present.root;
          if (rootRow.kind === 'row') {
            const newSelection = collapsedSelection(cursor([], rootRow.children.length));
            return pushHistory(h, updateSelection(h.present, newSelection));
          }
          return h;
        });
      } else {
        // When not focused, focus the input
        inputRef.current?.focus();
      }
    }, [focused, readOnly, disabled]);

    // ==========================================================================
    // Imperative Handle
    // ==========================================================================

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      insert: (text: string) => {
        // Insert text at cursor position
        // Check for LaTeX commands first (e.g., \alpha, \sin, \times)
        if (text.startsWith('\\')) {
          // It's a LaTeX command
          const cmd = text.slice(1); // Remove backslash

          // Check if it's an operator
          const OPERATORS = [
            'times', 'div', 'cdot', 'pm', 'mp', 'ast', 'circ', 'bullet',
            'leq', 'le', 'geq', 'ge', 'neq', 'ne', 'approx', 'equiv', 'sim', 'simeq',
            'll', 'gg', 'subset', 'supset', 'subseteq', 'supseteq', 'in', 'notin', 'ni',
            'cup', 'cap', 'setminus', 'emptyset',
            'forall', 'exists', 'nexists', 'neg', 'land', 'lor', 'implies', 'iff',
            'to', 'gets', 'leftarrow', 'rightarrow', 'leftrightarrow',
            'Leftarrow', 'Rightarrow', 'Leftrightarrow',
            'infty', 'partial', 'nabla',
            'ldots', 'cdots', 'vdots', 'ddots',
            'oplus', 'ominus', 'otimes', 'oslash', 'odot',
            'mapsto', 'longmapsto',
            'uparrow', 'downarrow', 'updownarrow',
            'Uparrow', 'Downarrow', 'Updownarrow',
            'nearrow', 'searrow', 'swarrow', 'nwarrow',
            'propto', 'cong', 'mid',
          ];

          // Check if it's a Greek letter
          const GREEK = [
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
            'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi',
            'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
            'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
            'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
            'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
            'varepsilon', 'vartheta', 'varpi', 'varrho', 'varsigma', 'varphi',
          ];

          // Check if it's a function
          const FUNCTIONS = [
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan', 'arccot',
            'sinh', 'cosh', 'tanh', 'coth',
            'log', 'ln', 'lg', 'exp',
            'lim', 'limsup', 'liminf',
            'min', 'max', 'sup', 'inf',
            'det', 'dim', 'ker', 'hom', 'arg',
            'deg', 'gcd', 'lcm', 'mod', 'bmod', 'pmod',
            'sum', 'prod', 'coprod', 'int', 'oint', 'iint', 'iiint',
            'bigcup', 'bigcap', 'bigoplus', 'bigotimes', 'bigvee', 'bigwedge',
          ];

          if (OPERATORS.includes(cmd)) {
            executeCommand(insertOperator(text));
          } else if (GREEK.includes(cmd)) {
            // Greek letters are symbols
            executeCommand(insertCharacter(cmd), true);
          } else if (FUNCTIONS.includes(cmd)) {
            // Functions - insert as text for now (could be improved)
            executeCommand(insertCharacter(cmd), true);
          } else {
            // Unknown command - try inserting as character
            executeCommand(insertCharacter(cmd), true);
          }
        } else {
          // Check for special patterns
          // Pattern: something followed by ^ (e.g., "e^", "10^")
          const caretIdx = text.indexOf('^');
          if (caretIdx > 0) {
            // Insert the part before ^, then superscript, then the rest
            const before = text.slice(0, caretIdx);
            const after = text.slice(caretIdx + 1).replace(/^\{|\}$/g, ''); // Remove braces if present

            // Insert before part
            for (const char of before) {
              executeCommand(insertCharacter(char), true);
            }
            // Insert superscript
            executeCommand(insertSuperscript());
            // Insert after part (if any)
            if (after) {
              for (const char of after) {
                if (char === '-') {
                  executeCommand(insertOperator('-'), true);
                } else {
                  executeCommand(insertCharacter(char), true);
                }
              }
            }
          } else if (text.startsWith('^')) {
            // Just superscript with content
            const content = text.slice(1).replace(/^\{|\}$/g, '');
            executeCommand(insertSuperscript());
            if (content) {
              for (const char of content) {
                if (char === '-') {
                  executeCommand(insertOperator('-'), true);
                } else {
                  executeCommand(insertCharacter(char), true);
                }
              }
            }
          } else {
            // Regular text - handle character by character
            for (const char of text) {
              if ('+-=<>'.includes(char)) {
                executeCommand(insertOperator(char), true);
              } else if (char === '*') {
                executeCommand(insertOperator('\\times'), true);
              } else if (char === '/') {
                executeCommand(insertFraction());
              } else if (char === '^') {
                executeCommand(insertSuperscript());
              } else if (char === '_') {
                executeCommand(insertSubscript());
              } else if ('([{'.includes(char)) {
                executeCommand(insertParens(char as '(' | '[' | '{'));
              } else {
                executeCommand(insertCharacter(char), true);
              }
            }
          }
        }
      },
      insertCommand: (command: string) => {
        // Parse matrix commands with dimensions (e.g., "matrix:2x3:pmatrix")
        if (command.startsWith('matrix')) {
          const parts = command.split(':');
          let rows = 2, cols = 2;
          let style: MatrixStyle = 'pmatrix';

          if (parts.length >= 2) {
            const dims = parts[1].split('x');
            rows = parseInt(dims[0], 10) || 2;
            cols = parseInt(dims[1], 10) || 2;
          }
          if (parts.length >= 3 && ['matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix'].includes(parts[2])) {
            style = parts[2] as MatrixStyle;
          }

          executeCommand(insertMatrix(rows, cols, style));
          return;
        }

        switch (command) {
          case 'fraction':
            executeCommand(insertFraction());
            break;
          case 'sqrt':
            executeCommand(insertSqrt());
            break;
          case 'parens':
            executeCommand(insertParens('('));
            break;
          case 'brackets':
            executeCommand(insertParens('['));
            break;
          case 'braces':
            executeCommand(insertParens('{'));
            break;
          case 'superscript':
            executeCommand(insertSuperscript());
            break;
          case 'subscript':
            executeCommand(insertSubscript());
            break;
        }
      },
      deleteBackward: () => {
        executeCommand(deleteBackward());
      },
      getLatex: () => latex,
      setLatex: (newLatex: string) => {
        try {
          const ast = parseLatex(newLatex);
          const newState = createStateFromAST(ast);
          setHistory(createHistory(newState));
        } catch (e) {
          // Invalid LaTeX, ignore
        }
      },
      undo,
      redo,
      canUndo: () => canUndo(history),
      canRedo: () => canRedo(history),
    }));

    // ==========================================================================
    // Render
    // ==========================================================================

    // Helper to check if two paths are equal
    const pathsEqual = (a: readonly number[], b: readonly number[]): boolean => {
      if (a.length !== b.length) return false;
      return a.every((v, i) => v === b[i]);
    };

    // Render cursor element
    const renderCursor = () => (
      <span className="pmf-cursor" aria-hidden="true" />
    );

    // Handle mousedown on a leaf element to position cursor
    // We use mousedown instead of click because mousedown fires BEFORE blur,
    // so we can prevent the blur from happening with e.preventDefault()
    const handleElementMouseDown = (
      e: React.MouseEvent<HTMLSpanElement>,
      rowPath: readonly number[],
      indexInRow: number
    ) => {
      // Prevent the default mousedown behavior which would blur the textarea
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX;
      const midpoint = rect.left + rect.width / 2;

      // If clicked on left half, position cursor before; right half, position after
      const offset = clickX < midpoint ? indexInRow : indexInRow + 1;

      const newSelection = collapsedSelection(cursor(rowPath, offset));
      setHistory((h) => pushHistory(h, updateSelection(h.present, newSelection)));
    };

    // Handle mousedown on a row (for clicking on empty space or between elements)
    const handleRowMouseDown = (
      e: React.MouseEvent<HTMLSpanElement>,
      rowPath: readonly number[],
      childCount: number
    ) => {
      // Only handle if clicking directly on the row, not on a child
      if (e.target === e.currentTarget) {
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX;

        // Position cursor at end if clicked past midpoint, else at start
        const offset = clickX > rect.left + rect.width / 2 ? childCount : 0;

        const newSelection = collapsedSelection(cursor(rowPath, offset));
        setHistory((h) => pushHistory(h, updateSelection(h.present, newSelection)));
      }
    };

    // Recursively render AST node with cursor positioning
    const renderNode = (
      node: MathNode,
      path: readonly number[],
      showCursor: boolean
    ): React.ReactNode => {
      const isCursorAtThisPath = showCursor && pathsEqual(cursorPos.path, path);

      // Get the parent row path and index for leaf nodes
      const parentRowPath = path.slice(0, -1);
      const indexInParent = path.length > 0 ? path[path.length - 1] : 0;

      switch (node.kind) {
        case 'row': {
          const children: React.ReactNode[] = [];
          for (let i = 0; i < node.children.length; i++) {
            // Insert cursor before this child if cursor offset matches
            if (isCursorAtThisPath && cursorPos.offset === i) {
              children.push(<React.Fragment key={`cursor-${i}`}>{renderCursor()}</React.Fragment>);
            }
            children.push(
              <React.Fragment key={i}>
                {renderNode(node.children[i], [...path, i], showCursor)}
              </React.Fragment>
            );
          }
          // Cursor at end of row
          if (isCursorAtThisPath && cursorPos.offset === node.children.length) {
            children.push(<React.Fragment key="cursor-end">{renderCursor()}</React.Fragment>);
          }
          return (
            <span
              className="pmf-row"
              onMouseDown={(e) => handleRowMouseDown(e, path, node.children.length)}
            >
              {children}
            </span>
          );
        }

        case 'number':
          return (
            <span
              className="pmf-number"
              onMouseDown={(e) => handleElementMouseDown(e, parentRowPath, indexInParent)}
            >
              {node.value}
            </span>
          );

        case 'symbol': {
          // Map Greek letters and other special symbols to Unicode
          const symbolMap: Record<string, string> = {
            // Lowercase Greek
            'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
            'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'iota': 'ι', 'kappa': 'κ',
            'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'omicron': 'ο',
            'pi': 'π', 'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'upsilon': 'υ',
            'phi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
            // Uppercase Greek
            'Alpha': 'Α', 'Beta': 'Β', 'Gamma': 'Γ', 'Delta': 'Δ', 'Epsilon': 'Ε',
            'Zeta': 'Ζ', 'Eta': 'Η', 'Theta': 'Θ', 'Iota': 'Ι', 'Kappa': 'Κ',
            'Lambda': 'Λ', 'Mu': 'Μ', 'Nu': 'Ν', 'Xi': 'Ξ', 'Omicron': 'Ο',
            'Pi': 'Π', 'Rho': 'Ρ', 'Sigma': 'Σ', 'Tau': 'Τ', 'Upsilon': 'Υ',
            'Phi': 'Φ', 'Chi': 'Χ', 'Psi': 'Ψ', 'Omega': 'Ω',
            // Variant forms
            'varepsilon': 'ε', 'vartheta': 'ϑ', 'varpi': 'ϖ', 'varrho': 'ϱ',
            'varsigma': 'ς', 'varphi': 'ϕ',
          };
          return (
            <span
              className="pmf-symbol"
              onMouseDown={(e) => handleElementMouseDown(e, parentRowPath, indexInParent)}
            >
              {symbolMap[node.value] || node.value}
            </span>
          );
        }

        case 'operator': {
          // Map common operators to their display forms
          // Note: operator values are stored without backslash (e.g., 'times' not '\\times')
          const opMap: Record<string, string> = {
            '+': '+', '-': '−', '*': '×',
            'times': '×', 'cdot': '·', 'div': '÷',
            '=': '=', '<': '<', '>': '>',
            'leq': '≤', 'le': '≤', 'geq': '≥', 'ge': '≥',
            'pm': '±', 'mp': '∓',
            'neq': '≠', 'ne': '≠', 'approx': '≈', 'equiv': '≡', 'sim': '∼',
            'simeq': '≃', 'll': '≪', 'gg': '≫',
            'in': '∈', 'notin': '∉', 'ni': '∋', 'subset': '⊂', 'supset': '⊃',
            'subseteq': '⊆', 'supseteq': '⊇',
            'cup': '∪', 'cap': '∩', 'setminus': '∖', 'emptyset': '∅',
            'infty': '∞', 'partial': '∂', 'nabla': '∇',
            'forall': '∀', 'exists': '∃', 'nexists': '∄', 'neg': '¬',
            'land': '∧', 'lor': '∨', 'implies': '⟹', 'iff': '⟺',
            'to': '→', 'rightarrow': '→', 'leftarrow': '←', 'leftrightarrow': '↔',
            'Rightarrow': '⇒', 'Leftarrow': '⇐', 'Leftrightarrow': '⇔',
            // Additional arrows
            'mapsto': '↦', 'longmapsto': '⟼',
            'uparrow': '↑', 'downarrow': '↓', 'updownarrow': '↕',
            'Uparrow': '⇑', 'Downarrow': '⇓', 'Updownarrow': '⇕',
            'nearrow': '↗', 'searrow': '↘', 'swarrow': '↙', 'nwarrow': '↖',
            // Additional relations
            'propto': '∝', 'cong': '≅', 'mid': '∣',
            // Other
            'ast': '∗', 'star': '⋆', 'circ': '∘', 'bullet': '•',
            'oplus': '⊕', 'ominus': '⊖', 'otimes': '⊗', 'oslash': '⊘', 'odot': '⊙',
            'ldots': '…', 'cdots': '⋯', 'vdots': '⋮', 'ddots': '⋱',
            '%': '%',
          };
          return (
            <span
              className="pmf-operator"
              onMouseDown={(e) => handleElementMouseDown(e, parentRowPath, indexInParent)}
            >
              {opMap[node.value] || node.value}
            </span>
          );
        }

        case 'placeholder':
          return (
            <span
              className="pmf-placeholder-box"
              onMouseDown={(e) => handleElementMouseDown(e, parentRowPath, indexInParent)}
            >
              □
            </span>
          );

        case 'fraction':
          return (
            <span className="pmf-fraction">
              <span className="pmf-numerator">
                {renderNode(node.numerator, [...path, 0], showCursor)}
              </span>
              <span className="pmf-frac-line" />
              <span className="pmf-denominator">
                {renderNode(node.denominator, [...path, 1], showCursor)}
              </span>
            </span>
          );

        case 'sqrt':
          return (
            <span className="pmf-sqrt">
              <span className="pmf-sqrt-symbol">√</span>
              <span className="pmf-sqrt-content">
                {renderNode(node.radicand, [...path, 0], showCursor)}
              </span>
            </span>
          );

        case 'power':
          return (
            <span className="pmf-power">
              {renderNode(node.base, [...path, 0], showCursor)}
              <sup className="pmf-superscript">
                {renderNode(node.exponent, [...path, 1], showCursor)}
              </sup>
            </span>
          );

        case 'subscript':
          return (
            <span className="pmf-subscript-container">
              {renderNode(node.base, [...path, 0], showCursor)}
              <sub className="pmf-subscript">
                {renderNode(node.subscript, [...path, 1], showCursor)}
              </sub>
            </span>
          );

        case 'subsup':
          return (
            <span className="pmf-subsup">
              {renderNode(node.base, [...path, 0], showCursor)}
              <sub className="pmf-subscript">
                {renderNode(node.subscript, [...path, 1], showCursor)}
              </sub>
              <sup className="pmf-superscript">
                {renderNode(node.superscript, [...path, 2], showCursor)}
              </sup>
            </span>
          );

        case 'parens': {
          // Map open delimiters to their display forms
          const openMap: Record<string, string> = {
            '(': '(', '[': '[', '{': '{', '|': '|', '\\|': '‖', '\\langle': '⟨',
          };
          const closeMap: Record<string, string> = {
            ')': ')', ']': ']', '}': '}', '|': '|', '\\|': '‖', '\\rangle': '⟩',
          };
          const left = openMap[node.open] || node.open;
          const right = closeMap[node.close] || node.close;
          return (
            <span className="pmf-parens">
              <span className="pmf-paren-left">{left}</span>
              {renderNode(node.content, [...path, 0], showCursor)}
              <span className="pmf-paren-right">{right}</span>
            </span>
          );
        }

        case 'function':
          return (
            <span className="pmf-function">
              <span className="pmf-function-name">{node.name}</span>
              {node.argument && renderNode(node.argument, [...path, 0], showCursor)}
            </span>
          );

        case 'matrix': {
          // Determine the delimiter based on matrix style
          const matrixDelimiters: Record<string, [string, string]> = {
            'matrix': ['', ''],       // No delimiters
            'pmatrix': ['(', ')'],    // Parentheses
            'bmatrix': ['[', ']'],    // Square brackets
            'Bmatrix': ['{', '}'],    // Curly braces
            'vmatrix': ['|', '|'],    // Single vertical bars
            'Vmatrix': ['‖', '‖'],    // Double vertical bars
          };
          const [leftDelim, rightDelim] = matrixDelimiters[node.style] || ['(', ')'];

          // Flatten the rows for child indexing (getChildren returns flat array)
          let cellIndex = 0;

          return (
            <span className="pmf-matrix">
              {leftDelim && <span className="pmf-matrix-delim pmf-matrix-delim-left">{leftDelim}</span>}
              <span className="pmf-matrix-table">
                {node.rows.map((row, rowIdx) => (
                  <span key={rowIdx} className="pmf-matrix-row">
                    {row.map((cell, colIdx) => {
                      const currentCellIndex = cellIndex++;
                      return (
                        <span key={colIdx} className="pmf-matrix-cell">
                          {renderNode(cell, [...path, currentCellIndex], showCursor)}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </span>
              {rightDelim && <span className="pmf-matrix-delim pmf-matrix-delim-right">{rightDelim}</span>}
            </span>
          );
        }

        case 'text':
          return <span className="pmf-text">{node.value}</span>;

        case 'space':
          return <span className="pmf-space">&nbsp;</span>;

        default:
          return <span className="pmf-unknown">[{(node as MathNode).kind}]</span>;
      }
    };

    // Render math content with cursor
    const renderMathContent = () => {
      if (isFieldEmpty) {
        return (
          <span className="pmf-placeholder">{placeholder}</span>
        );
      }

      // Use custom renderer when focused (for cursor positioning)
      // Use KaTeX when not focused (for prettier display)
      if (focused) {
        return (
          <span ref={mathContainerRef} className="pmf-math pmf-editing">
            {renderNode(state.root, [], true)}
          </span>
        );
      }

      // Not focused: use KaTeX for pretty rendering
      const result = renderToString(latex, {
        ...katexOptions,
        displayMode: false,
        throwOnError: false,
      });

      return (
        <span
          ref={mathContainerRef}
          className="pmf-math"
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
      );
    };

    const containerClasses = [
      'pmf-container',
      focused && 'pmf-focused',
      disabled && 'pmf-disabled',
      readOnly && 'pmf-readonly',
      hasSelection && 'pmf-has-selection',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Generate an accessible description of the current content
    const accessibleDescription = latex
      ? `Current expression: ${latex}`
      : 'Empty math field';

    return (
      <div
        ref={containerRef}
        className={containerClasses}
        style={{ ...style, position: 'relative' }}
        onClick={handleContainerClick}
        onMouseDown={handleContainerMouseDown}
        role="textbox"
        aria-label={ariaLabel}
        aria-readonly={readOnly}
        aria-disabled={disabled}
        aria-multiline="false"
        aria-describedby={descriptionId}
      >
        {/* Screen reader description */}
        <span id={descriptionId} className="pmf-sr-only">
          {accessibleDescription}. Use Tab to move between placeholders. Use arrow keys to navigate.
        </span>

        {/* Live region for announcements */}
        <span aria-live="polite" aria-atomic="true" className="pmf-sr-only">
          {focused && latex ? `Editing: ${latex}` : ''}
        </span>

        {/* Hidden textarea for keyboard input */}
        <textarea
          ref={inputRef}
          className="pmf-input"
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          readOnly={readOnly}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={disabled ? -1 : 0}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Math content display */}
        <span className="pmf-content" aria-hidden="true">
          {renderMathContent()}
        </span>
      </div>
    );
  }
);

export default MathField;
