/**
 * Editor Model - State management for the math editor
 *
 * The model holds:
 * - The AST (math content)
 * - Selection (cursor position)
 * - History (undo/redo stacks)
 *
 * All state is immutable. Updates create new states.
 */

import { MathNode, RowNode, node as nodeBuilder, normalizeForEditor } from './ast';
import { Selection, collapsedSelection, isCollapsed, selectionsEqual } from './selection';
import { CursorPosition, cursorAtStart } from './cursor';

// =============================================================================
// Types
// =============================================================================

/**
 * Editor state snapshot
 */
export interface EditorState {
  /** The math AST */
  readonly root: MathNode;
  /** Current selection */
  readonly selection: Selection;
}

/**
 * History state for undo/redo
 */
export interface History {
  /** Past states (for undo) */
  readonly past: readonly EditorState[];
  /** Current state */
  readonly present: EditorState;
  /** Future states (for redo) */
  readonly future: readonly EditorState[];
}

/**
 * Options for creating history entries
 */
export interface HistoryOptions {
  /** Maximum number of undo steps */
  maxHistory?: number;
  /** Whether this change should be merged with previous (for continuous typing) */
  merge?: boolean;
}

// =============================================================================
// State Creation
// =============================================================================

/**
 * Create an empty editor state
 * Cursor starts at the root row level, offset 0
 */
export function createEmptyState(): EditorState {
  const root = nodeBuilder.row([nodeBuilder.placeholder()]);
  // Cursor at row level, position 0 (before the placeholder)
  const selection = collapsedSelection({ path: [], offset: 0 });
  return { root, selection };
}

/**
 * Create editor state from an AST.
 * The AST is normalized to ensure root is a row and structure slots are rows.
 */
export function createStateFromAST(ast: MathNode): EditorState {
  const root = normalizeForEditor(ast);
  const selection = collapsedSelection(cursorAtStart([]));
  return { root, selection };
}

/**
 * Create initial history
 */
export function createHistory(initial: EditorState): History {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

// =============================================================================
// State Updates
// =============================================================================

/**
 * Update the AST in a state
 */
export function updateRoot(state: EditorState, newRoot: MathNode): EditorState {
  return { ...state, root: newRoot };
}

/**
 * Update the selection in a state
 */
export function updateSelection(state: EditorState, newSelection: Selection): EditorState {
  return { ...state, selection: newSelection };
}

/**
 * Update both root and selection
 */
export function updateState(
  state: EditorState,
  newRoot: MathNode,
  newSelection: Selection
): EditorState {
  return { root: newRoot, selection: newSelection };
}

// =============================================================================
// History Operations
// =============================================================================

const DEFAULT_MAX_HISTORY = 100;

/**
 * Push a new state onto history (for undo)
 */
export function pushHistory(
  history: History,
  newState: EditorState,
  options: HistoryOptions = {}
): History {
  const { maxHistory = DEFAULT_MAX_HISTORY, merge = false } = options;

  // If merge is requested and there's a previous state, replace it
  if (merge && history.past.length > 0) {
    return {
      past: history.past,
      present: newState,
      future: [], // Clear redo stack on new change
    };
  }

  // Add current state to past
  let newPast = [...history.past, history.present];

  // Trim history if too long
  if (newPast.length > maxHistory) {
    newPast = newPast.slice(newPast.length - maxHistory);
  }

  return {
    past: newPast,
    present: newState,
    future: [], // Clear redo stack on new change
  };
}

/**
 * Undo - go back to previous state
 */
export function undo(history: History): History {
  if (history.past.length === 0) {
    return history; // Nothing to undo
  }

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/**
 * Redo - go forward to next state
 */
export function redo(history: History): History {
  if (history.future.length === 0) {
    return history; // Nothing to redo
  }

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

/**
 * Check if undo is available
 */
export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/**
 * Clear history (but keep current state)
 */
export function clearHistory(history: History): History {
  return {
    past: [],
    present: history.present,
    future: [],
  };
}

// =============================================================================
// State Comparison
// =============================================================================

/**
 * Check if two states are equal
 */
export function statesEqual(a: EditorState, b: EditorState): boolean {
  // For now, just compare selections (AST comparison is expensive)
  // In practice, we'd use structural sharing to make this cheap
  return a.root === b.root && selectionsEqual(a.selection, b.selection);
}

/**
 * Check if content has changed between two states
 */
export function contentChanged(a: EditorState, b: EditorState): boolean {
  return a.root !== b.root;
}

/**
 * Check if selection has changed between two states
 */
export function selectionChanged(a: EditorState, b: EditorState): boolean {
  return !selectionsEqual(a.selection, b.selection);
}

// =============================================================================
// State Queries
// =============================================================================

/**
 * Check if the editor is empty (just a placeholder)
 */
export function isEmpty(state: EditorState): boolean {
  const { root } = state;

  if (root.kind === 'placeholder') return true;

  if (root.kind === 'row') {
    return (
      root.children.length === 0 ||
      (root.children.length === 1 && root.children[0].kind === 'placeholder')
    );
  }

  return false;
}

/**
 * Check if there's an active selection (not collapsed)
 */
export function hasSelection(state: EditorState): boolean {
  return !isCollapsed(state.selection);
}

// =============================================================================
// Debugging
// =============================================================================

/**
 * Get a debug representation of the state
 */
export function debugState(state: EditorState): string {
  const selStr = isCollapsed(state.selection)
    ? `cursor at [${state.selection.focus.path}]:${state.selection.focus.offset}`
    : `selection [${state.selection.anchor.path}]:${state.selection.anchor.offset} to [${state.selection.focus.path}]:${state.selection.focus.offset}`;

  return `EditorState { root: ${state.root.kind}, ${selStr} }`;
}
