/**
 * Navigation Commands
 *
 * Commands for moving the cursor through the math AST.
 * Handles 2D navigation (up into numerator, down into denominator, etc.)
 */

import { EditorState, updateSelection } from '../model';
import { Selection, collapsedSelection, extendTo, isCollapsed, getStart, getEnd } from '../selection';
import {
  CursorPosition,
  cursor,
  getNodeAtPath,
  getChildNodes,
  parentPath,
  indexInParent,
  findFirstFocusable,
  findLastFocusable,
  hasDescendantRow,
  compareCursors,
} from '../cursor';
import { MathNode } from '../ast';
import { Command, Direction } from './types';

// =============================================================================
// Basic Navigation
// =============================================================================

/**
 * Move cursor left (backward)
 */
export function moveLeft(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // If there's a selection and not extending, collapse to start
    if (!isCollapsed(selection) && !extend) {
      return updateSelection(state, collapsedSelection(getStart(selection)));
    }

    const pos = selection.focus;
    const newPos = moveCursorLeft(root, pos);

    if (!newPos) return null;

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

/**
 * Move cursor right (forward)
 */
export function moveRight(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // If there's a selection and not extending, collapse to end
    if (!isCollapsed(selection) && !extend) {
      return updateSelection(state, collapsedSelection(getEnd(selection)));
    }

    const pos = selection.focus;
    const newPos = moveCursorRight(root, pos);

    if (!newPos) return null;

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

/**
 * Move cursor up (into superscript, numerator, etc.)
 */
export function moveUp(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const pos = selection.focus;

    const newPos = moveCursorUp(root, pos);

    if (!newPos) return null;

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

/**
 * Move cursor down (into subscript, denominator, etc.)
 */
export function moveDown(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const pos = selection.focus;

    const newPos = moveCursorDown(root, pos);

    if (!newPos) return null;

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

// =============================================================================
// Start/End Navigation
// =============================================================================

/**
 * Move to start of current row/line
 */
export function moveToLineStart(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { selection } = state;
    const pos = selection.focus;

    // Find the row containing the cursor
    const rowPath = findContainingRow(state.root, pos.path);
    const newPos = cursor(rowPath, 0);

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

/**
 * Move to end of current row/line
 */
export function moveToLineEnd(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const pos = selection.focus;

    // Find the row containing the cursor
    const rowPath = findContainingRow(root, pos.path);
    const rowNode = getNodeAtPath(root, rowPath);

    if (!rowNode || rowNode.kind !== 'row') return null;

    const newPos = cursor(rowPath, rowNode.children.length);

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

/**
 * Move to start of document
 */
export function moveToDocumentStart(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    const newPos = findFirstFocusable(root, []);

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

/**
 * Move to end of document
 */
export function moveToDocumentEnd(extend: boolean = false): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    const newPos = findLastFocusable(root, []);

    const newSelection = extend
      ? extendTo(selection, newPos)
      : collapsedSelection(newPos);

    return updateSelection(state, newSelection);
  };
}

// =============================================================================
// Selection Commands
// =============================================================================

/**
 * Select all content
 */
export function selectAll(): Command {
  return (state: EditorState) => {
    const { root } = state;

    const start = findFirstFocusable(root, []);
    const end = findLastFocusable(root, []);

    return updateSelection(state, { anchor: start, focus: end });
  };
}

// =============================================================================
// Placeholder Navigation
// =============================================================================

/**
 * Move to the next placeholder in the document
 */
export function moveToNextPlaceholder(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const currentPos = selection.focus;

    const nextPlaceholder = findNextPlaceholder(root, currentPos, 'forward');
    if (!nextPlaceholder) return null;

    return updateSelection(state, collapsedSelection(nextPlaceholder));
  };
}

/**
 * Move to the previous placeholder in the document
 */
export function moveToPreviousPlaceholder(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const currentPos = selection.focus;

    const prevPlaceholder = findNextPlaceholder(root, currentPos, 'backward');
    if (!prevPlaceholder) return null;

    return updateSelection(state, collapsedSelection(prevPlaceholder));
  };
}

/**
 * Find the next placeholder in the given direction
 */
function findNextPlaceholder(
  root: MathNode,
  currentPos: CursorPosition,
  direction: 'forward' | 'backward'
): CursorPosition | null {
  const placeholders: CursorPosition[] = [];

  // Collect all placeholder positions
  function collectPlaceholders(node: MathNode, path: readonly number[]): void {
    if (node.kind === 'row') {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.kind === 'placeholder') {
          // Position cursor at the start of the placeholder's parent row
          placeholders.push(cursor(path, i));
        } else {
          collectPlaceholders(child, [...path, i]);
        }
      }
    } else {
      // For structures, recurse into children
      const children = getChildNodes(node);
      for (let i = 0; i < children.length; i++) {
        collectPlaceholders(children[i], [...path, i]);
      }
    }
  }

  collectPlaceholders(root, []);

  if (placeholders.length === 0) return null;

  // Find the current position in the list
  const currentIndex = placeholders.findIndex(
    (p) =>
      p.path.length === currentPos.path.length &&
      p.path.every((v, i) => v === currentPos.path[i]) &&
      p.offset === currentPos.offset
  );

  if (direction === 'forward') {
    // If not at a placeholder, find the first one after current position
    if (currentIndex === -1) {
      // Find the first placeholder that comes after current position
      for (const p of placeholders) {
        if (compareCursors(p, currentPos) > 0) {
          return p;
        }
      }
      // Wrap around to the first placeholder
      return placeholders[0];
    }
    // Move to next placeholder, wrapping around
    return placeholders[(currentIndex + 1) % placeholders.length];
  } else {
    // Backward
    if (currentIndex === -1) {
      // Find the last placeholder before current position
      for (let i = placeholders.length - 1; i >= 0; i--) {
        if (compareCursors(placeholders[i], currentPos) < 0) {
          return placeholders[i];
        }
      }
      // Wrap around to the last placeholder
      return placeholders[placeholders.length - 1];
    }
    // Move to previous placeholder, wrapping around
    return placeholders[(currentIndex - 1 + placeholders.length) % placeholders.length];
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Move cursor one position to the left
 * INVARIANT: cursor is always at a row with offset between children
 */
function moveCursorLeft(root: MathNode, pos: CursorPosition): CursorPosition | null {
  const node = getNodeAtPath(root, pos.path);
  if (!node || node.kind !== 'row') return null;

  if (pos.offset > 0) {
    // Check the child to the left
    const prevChild = node.children[pos.offset - 1];

    // If it's a structure (fraction, sqrt, etc.) with focusable rows, enter it
    if (prevChild && isStructure(prevChild) && hasDescendantRow(prevChild)) {
      return findLastFocusable(root, [...pos.path, pos.offset - 1]);
    }

    // For leaf nodes or structures without rows, just move past it
    return cursor(pos.path, pos.offset - 1);
  }

  // At start of row, try to exit to parent
  return exitNodeLeft(root, pos.path);
}

/**
 * Move cursor one position to the right
 * INVARIANT: cursor is always at a row with offset between children
 */
function moveCursorRight(root: MathNode, pos: CursorPosition): CursorPosition | null {
  const node = getNodeAtPath(root, pos.path);
  if (!node || node.kind !== 'row') return null;

  if (pos.offset < node.children.length) {
    // Check the child to the right
    const nextChild = node.children[pos.offset];

    // If it's a structure (fraction, sqrt, etc.) with focusable rows, enter it
    if (nextChild && isStructure(nextChild) && hasDescendantRow(nextChild)) {
      return findFirstFocusable(root, [...pos.path, pos.offset]);
    }

    // For leaf nodes or structures without rows (e.g., function with no argument),
    // just move past it
    return cursor(pos.path, pos.offset + 1);
  }

  // At end of row, try to exit to parent
  return exitNodeRight(root, pos.path);
}

/**
 * Check if a node is a structure that contains rows (can be entered)
 */
function isStructure(node: MathNode): boolean {
  return [
    'fraction', 'power', 'subscript', 'subsup',
    'sqrt', 'parens', 'matrix', 'function'
  ].includes(node.kind);
}

/**
 * Move cursor up (semantic navigation)
 */
function moveCursorUp(root: MathNode, pos: CursorPosition): CursorPosition | null {
  // Find a parent that has an "up" slot
  let currentPath = pos.path;

  while (currentPath.length > 0) {
    const parentP = parentPath(currentPath);
    const parent = getNodeAtPath(root, parentP);
    const childIdx = indexInParent(currentPath);

    if (!parent) break;

    // Check if we can move "up" within this parent
    const upSlot = getUpSlot(parent, childIdx);
    if (upSlot !== null) {
      return findFirstFocusable(root, [...parentP, upSlot]);
    }

    currentPath = parentP;
  }

  return null;
}

/**
 * Move cursor down (semantic navigation)
 */
function moveCursorDown(root: MathNode, pos: CursorPosition): CursorPosition | null {
  // Find a parent that has a "down" slot
  let currentPath = pos.path;

  while (currentPath.length > 0) {
    const parentP = parentPath(currentPath);
    const parent = getNodeAtPath(root, parentP);
    const childIdx = indexInParent(currentPath);

    if (!parent) break;

    // Check if we can move "down" within this parent
    const downSlot = getDownSlot(parent, childIdx);
    if (downSlot !== null) {
      return findFirstFocusable(root, [...parentP, downSlot]);
    }

    currentPath = parentP;
  }

  return null;
}

/**
 * Exit a node to the left (go to parent, position before this child)
 */
function exitNodeLeft(root: MathNode, path: readonly number[]): CursorPosition | null {
  if (path.length === 0) return null;

  const parentP = parentPath(path);
  const parent = getNodeAtPath(root, parentP);
  const childIdx = indexInParent(path);

  if (!parent) return null;

  if (parent.kind === 'row') {
    // In a row, position before this child
    return cursor(parentP, childIdx);
  }

  // Special handling for matrices: move to previous cell
  if (parent.kind === 'matrix') {
    if (childIdx > 0) {
      // Move to the previous cell (enter at end)
      return findLastFocusable(root, [...parentP, childIdx - 1]);
    }
    // At first cell, exit the matrix
    return exitNodeLeft(root, parentP);
  }

  // For structured nodes, exit to the left of the parent
  return exitNodeLeft(root, parentP);
}

/**
 * Exit a node to the right (go to parent, position after this child)
 */
function exitNodeRight(root: MathNode, path: readonly number[]): CursorPosition | null {
  if (path.length === 0) return null;

  const parentP = parentPath(path);
  const parent = getNodeAtPath(root, parentP);
  const childIdx = indexInParent(path);

  if (!parent) return null;

  if (parent.kind === 'row') {
    // In a row, position after this child
    return cursor(parentP, childIdx + 1);
  }

  // Special handling for matrices: move to next cell
  if (parent.kind === 'matrix') {
    const totalCells = parent.rows.length * (parent.rows[0]?.length || 1);
    if (childIdx < totalCells - 1) {
      // Move to the next cell (enter at start)
      return findFirstFocusable(root, [...parentP, childIdx + 1]);
    }
    // At last cell, exit the matrix
    return exitNodeRight(root, parentP);
  }

  // For structured nodes, exit to the right of the parent
  return exitNodeRight(root, parentP);
}

/**
 * Get the slot index to move "up" to from current slot
 */
function getUpSlot(parent: MathNode, currentSlot: number): number | null {
  switch (parent.kind) {
    case 'fraction':
      // In denominator (1), go to numerator (0)
      return currentSlot === 1 ? 0 : null;
    case 'power':
      // In base (0), go to exponent (1)
      return currentSlot === 0 ? 1 : null;
    case 'subscript':
      // No up from subscript
      return null;
    case 'subsup':
      // In subscript (1), go to superscript (2)
      // In base (0), go to superscript (2)
      if (currentSlot === 1) return 2;
      if (currentSlot === 0) return 2;
      return null;
    case 'sqrt':
      // In radicand (0), go to index (1) if exists
      return currentSlot === 0 && getChildNodes(parent).length > 1 ? 1 : null;
    case 'matrix': {
      // Navigate up to the cell in the previous row
      const cols = parent.rows[0]?.length || 1;
      const newSlot = currentSlot - cols;
      return newSlot >= 0 ? newSlot : null;
    }
    default:
      return null;
  }
}

/**
 * Get the slot index to move "down" to from current slot
 */
function getDownSlot(parent: MathNode, currentSlot: number): number | null {
  switch (parent.kind) {
    case 'fraction':
      // In numerator (0), go to denominator (1)
      return currentSlot === 0 ? 1 : null;
    case 'power':
      // In exponent (1), go to base (0)
      return currentSlot === 1 ? 0 : null;
    case 'subscript':
      // In base (0), go to subscript (1)
      return currentSlot === 0 ? 1 : null;
    case 'subsup':
      // In superscript (2), go to subscript (1)
      // In base (0), go to subscript (1)
      if (currentSlot === 2) return 1;
      if (currentSlot === 0) return 1;
      return null;
    case 'sqrt':
      // In index (1), go to radicand (0)
      return currentSlot === 1 ? 0 : null;
    case 'matrix': {
      // Navigate down to the cell in the next row
      const cols = parent.rows[0]?.length || 1;
      const totalCells = parent.rows.length * cols;
      const newSlot = currentSlot + cols;
      return newSlot < totalCells ? newSlot : null;
    }
    default:
      return null;
  }
}

/**
 * Find the path to the row containing this path
 */
function findContainingRow(root: MathNode, path: readonly number[]): readonly number[] {
  let currentPath = path;

  while (currentPath.length >= 0) {
    const node = getNodeAtPath(root, currentPath);
    if (node?.kind === 'row') {
      return currentPath;
    }
    if (currentPath.length === 0) break;
    currentPath = parentPath(currentPath);
  }

  return [];
}
