/**
 * peach-math-field
 *
 * A shadcn-native, highly customizable math editor.
 */

// Core AST types and utilities
export {
  type MathNode,
  type MathNodeKind,
  type NumberNode,
  type SymbolNode,
  type OperatorNode,
  type TextNode,
  type SpaceNode,
  type PlaceholderNode,
  type RowNode,
  type FractionNode,
  type PowerNode,
  type SubscriptNode,
  type SubSupNode,
  type SqrtNode,
  type ParensNode,
  type FunctionNode,
  type MatrixNode,
  node,
  isLeafNode,
  isContainerNode,
  getChildren,
  mapChildren,
  nodesEqual,
  normalizeForEditor,
} from './core/ast';

// Parser
export { parseLatex } from './parser/latex-to-ast';
export { serializeToLatex, type SerializeOptions } from './parser/ast-to-latex';
export { tokenize, type Token, type TokenType } from './parser/tokens';

// Renderer
export {
  renderToString,
  renderToElement,
  validateLatex,
  commonMacros,
  type RenderOptions,
  type RenderResult,
} from './renderer/katex-renderer';

// Components
export {
  MathDisplay,
  InlineMath,
  BlockMath,
  type MathDisplayProps,
} from './components/math-display';

export {
  MathField,
  type MathFieldProps,
  type MathFieldRef,
} from './components/math-field';

export {
  MathKeyboard,
  type MathKeyboardProps,
} from './components/math-keyboard';

// Editor Model
export {
  type EditorState,
  type History,
  type HistoryOptions,
  createEmptyState,
  createStateFromAST,
  createHistory,
  updateRoot,
  updateSelection,
  updateState,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
  isEmpty,
  hasSelection,
} from './core/model';

// Cursor
export {
  type CursorPosition,
  type SlotName,
  type SlotInfo,
  cursor,
  cursorAtStart,
  cursorAtEnd,
  getNodeAtPath,
  getChildNodes,
  parentPath,
  indexInParent,
  getSlots,
  compareCursors,
  cursorsEqual,
  isValidPath,
  isValidCursor,
  isFocusable,
  findFirstFocusable,
  findLastFocusable,
} from './core/cursor';

// Selection
export {
  type Selection,
  type SelectionDirection,
  collapsedSelection,
  selection,
  selectionAtStart,
  selectionAtEnd,
  isCollapsed,
  getDirection,
  getStart,
  getEnd,
  collapseToFocus,
  collapseToAnchor,
  collapseToStart,
  collapseToEnd,
  extendTo,
  moveTo,
  selectionsEqual,
  getCommonAncestorPath,
  containsPosition,
  normalizeSelection,
  extractSelectedNodes,
} from './core/selection';

// Commands
export {
  type Command,
  type CommandResult,
  type Direction,
  type Unit,
  type MatrixStyle,
  executeCommand,
  chainCommands,
  tryCommands,
  // Navigation
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveToLineStart,
  moveToLineEnd,
  moveToDocumentStart,
  moveToDocumentEnd,
  selectAll,
  moveToNextPlaceholder,
  moveToPreviousPlaceholder,
  // Insert
  insertCharacter,
  insertOperator,
  insertGreek,
  insertFraction,
  insertSqrt,
  insertParens,
  insertSuperscript,
  insertSubscript,
  insertMatrix,
  // Delete
  deleteBackward,
  deleteForward,
  deleteSelection,
} from './core/commands';
