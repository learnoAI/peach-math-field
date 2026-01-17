/**
 * Selection - Range selection in the AST
 *
 * A selection is defined by two cursor positions:
 * - anchor: where the selection started (doesn't move when extending)
 * - focus: where the selection ends (moves when extending)
 *
 * When anchor === focus, it's a collapsed selection (just a cursor).
 */

import { MathNode, node as nodeBuilder } from './ast';
import {
  CursorPosition,
  compareCursors,
  cursorsEqual,
  getNodeAtPath,
  getChildNodes,
  parentPath,
  indexInParent,
  cursorAtStart,
  cursorAtEnd,
  coerceToRowCursor,
} from './cursor';

// =============================================================================
// Types
// =============================================================================

/**
 * A selection in the AST
 */
export interface Selection {
  /** Where selection started */
  anchor: CursorPosition;
  /** Where selection ends (current cursor position) */
  focus: CursorPosition;
}

/**
 * Direction of selection
 */
export type SelectionDirection = 'forward' | 'backward' | 'none';

// =============================================================================
// Selection Creation
// =============================================================================

/**
 * Create a collapsed selection (cursor) at a position
 */
export function collapsedSelection(pos: CursorPosition): Selection {
  return { anchor: pos, focus: pos };
}

/**
 * Create a selection from anchor to focus
 */
export function selection(anchor: CursorPosition, focus: CursorPosition): Selection {
  return { anchor, focus };
}

/**
 * Create a selection at the start of the document
 */
export function selectionAtStart(root: MathNode): Selection {
  const pos = cursorAtStart([]);
  return collapsedSelection(pos);
}

/**
 * Create a selection at the end of the document
 */
export function selectionAtEnd(root: MathNode): Selection {
  const pos = cursorAtEnd(root, []);
  return collapsedSelection(pos);
}

// =============================================================================
// Selection Properties
// =============================================================================

/**
 * Check if selection is collapsed (cursor, no range)
 */
export function isCollapsed(sel: Selection): boolean {
  return cursorsEqual(sel.anchor, sel.focus);
}

/**
 * Get the direction of the selection
 */
export function getDirection(sel: Selection): SelectionDirection {
  if (isCollapsed(sel)) return 'none';
  return compareCursors(sel.anchor, sel.focus) < 0 ? 'forward' : 'backward';
}

/**
 * Get the start (leftmost) position of the selection
 */
export function getStart(sel: Selection): CursorPosition {
  return compareCursors(sel.anchor, sel.focus) <= 0 ? sel.anchor : sel.focus;
}

/**
 * Get the end (rightmost) position of the selection
 */
export function getEnd(sel: Selection): CursorPosition {
  return compareCursors(sel.anchor, sel.focus) >= 0 ? sel.anchor : sel.focus;
}

// =============================================================================
// Selection Manipulation
// =============================================================================

/**
 * Collapse selection to the focus position
 */
export function collapseToFocus(sel: Selection): Selection {
  return collapsedSelection(sel.focus);
}

/**
 * Collapse selection to the anchor position
 */
export function collapseToAnchor(sel: Selection): Selection {
  return collapsedSelection(sel.anchor);
}

/**
 * Collapse selection to the start
 */
export function collapseToStart(sel: Selection): Selection {
  return collapsedSelection(getStart(sel));
}

/**
 * Collapse selection to the end
 */
export function collapseToEnd(sel: Selection): Selection {
  return collapsedSelection(getEnd(sel));
}

/**
 * Extend selection to a new focus position (keeps anchor)
 */
export function extendTo(sel: Selection, newFocus: CursorPosition): Selection {
  return { anchor: sel.anchor, focus: newFocus };
}

/**
 * Move selection to a new position (moves both anchor and focus)
 */
export function moveTo(newPos: CursorPosition): Selection {
  return collapsedSelection(newPos);
}

// =============================================================================
// Selection Comparison
// =============================================================================

/**
 * Check if two selections are equal
 */
export function selectionsEqual(a: Selection, b: Selection): boolean {
  return cursorsEqual(a.anchor, b.anchor) && cursorsEqual(a.focus, b.focus);
}

// =============================================================================
// Selection Range Operations
// =============================================================================

/**
 * Get the common ancestor path of a selection
 * Returns the deepest path that contains both anchor and focus
 */
export function getCommonAncestorPath(sel: Selection): readonly number[] {
  const anchorPath = sel.anchor.path;
  const focusPath = sel.focus.path;

  const common: number[] = [];
  const minLen = Math.min(anchorPath.length, focusPath.length);

  for (let i = 0; i < minLen; i++) {
    if (anchorPath[i] === focusPath[i]) {
      common.push(anchorPath[i]);
    } else {
      break;
    }
  }

  return common;
}

/**
 * Check if a cursor position is within a selection range
 */
export function containsPosition(sel: Selection, pos: CursorPosition): boolean {
  const start = getStart(sel);
  const end = getEnd(sel);

  return compareCursors(pos, start) >= 0 && compareCursors(pos, end) <= 0;
}

/**
 * Check if a path is within the selection
 */
export function containsPath(sel: Selection, path: readonly number[]): boolean {
  // A path is within selection if it starts with the common ancestor
  // and its index falls between start and end
  const commonPath = getCommonAncestorPath(sel);

  // Path must be at least as long as common ancestor
  if (path.length < commonPath.length) return false;

  // Path must match common ancestor
  for (let i = 0; i < commonPath.length; i++) {
    if (path[i] !== commonPath[i]) return false;
  }

  // If path is exactly common ancestor, it's contained
  if (path.length === commonPath.length) return true;

  // Check if the next index is within range
  const start = getStart(sel);
  const end = getEnd(sel);
  const nextIndex = path[commonPath.length];

  const startIndex = start.path.length > commonPath.length
    ? start.path[commonPath.length]
    : 0;
  const endIndex = end.path.length > commonPath.length
    ? end.path[commonPath.length]
    : Infinity;

  return nextIndex >= startIndex && nextIndex <= endIndex;
}

// =============================================================================
// Selection Normalization
// =============================================================================

/**
 * Normalize a selection to ensure it's valid within the tree
 * INVARIANT: Both anchor and focus must point to row nodes
 * Returns null if selection cannot be normalized
 */
export function normalizeSelection(root: MathNode, sel: Selection): Selection | null {
  // Coerce both positions to point to rows (enforces invariant)
  const normalizedAnchor = coerceToRowCursor(root, sel.anchor);
  const normalizedFocus = coerceToRowCursor(root, sel.focus);

  // Verify the coerced positions are valid
  const anchorNode = getNodeAtPath(root, normalizedAnchor.path);
  const focusNode = getNodeAtPath(root, normalizedFocus.path);

  if (!anchorNode || !focusNode) {
    return null;
  }

  // Both should now be rows (coerceToRowCursor guarantees this)
  if (anchorNode.kind !== 'row' || focusNode.kind !== 'row') {
    return null;
  }

  return {
    anchor: normalizedAnchor,
    focus: normalizedFocus,
  };
}

// =============================================================================
// Selection Text
// =============================================================================

/**
 * Get a human-readable description of the selection (for debugging/accessibility)
 */
export function describeSelection(sel: Selection): string {
  if (isCollapsed(sel)) {
    return `Cursor at path [${sel.focus.path.join(', ')}], offset ${sel.focus.offset}`;
  }

  const dir = getDirection(sel);
  return `Selection from [${sel.anchor.path.join(', ')}]:${sel.anchor.offset} to [${sel.focus.path.join(', ')}]:${sel.focus.offset} (${dir})`;
}

// =============================================================================
// Selection Extraction
// =============================================================================

/**
 * Check if two paths are equal
 */
function pathsEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Extract the selected portion of the AST as a new node
 * Returns null if selection is collapsed or extraction fails
 */
export function extractSelectedNodes(root: MathNode, sel: Selection): MathNode | null {
  if (isCollapsed(sel)) return null;

  const { anchor, focus } = sel;

  // Normalize: start should come before end
  const comparison = compareCursors(anchor, focus);
  const [start, end] = comparison <= 0 ? [anchor, focus] : [focus, anchor];

  // Case 1: Both in the same row (same path)
  if (pathsEqual(start.path, end.path)) {
    const row = getNodeAtPath(root, start.path);
    if (!row || row.kind !== 'row') return null;

    // Extract children from start.offset to end.offset
    const selectedChildren = row.children.slice(start.offset, end.offset);
    if (selectedChildren.length === 0) return null;

    return nodeBuilder.row(selectedChildren);
  }

  // Case 2: Different rows - find common ancestor
  // Determine the common ancestor path
  const commonPath: number[] = [];
  for (let i = 0; i < Math.min(start.path.length, end.path.length); i++) {
    if (start.path[i] === end.path[i]) {
      commonPath.push(start.path[i]);
    } else {
      break;
    }
  }

  // Get the node at common path
  const commonAncestor = getNodeAtPath(root, commonPath);
  if (!commonAncestor) return null;

  // If common ancestor is a row, extract relevant children
  if (commonAncestor.kind === 'row') {
    // Determine which children are fully or partially selected
    // For simplicity, include all children between the start and end indices
    const startIdx = start.path.length > commonPath.length
      ? start.path[commonPath.length]
      : start.offset;
    const endIdx = end.path.length > commonPath.length
      ? end.path[commonPath.length] + 1  // +1 to include the end child
      : end.offset;

    const selectedChildren = commonAncestor.children.slice(startIdx, endIdx);
    if (selectedChildren.length === 0) return null;

    return nodeBuilder.row(selectedChildren);
  }

  // For non-row common ancestors (fraction, sqrt, etc.), return the whole structure
  // This is a simplification - user selected across structure boundaries
  return commonAncestor;
}
