/**
 * Cursor - Path-based cursor positioning (MathLive-style atom-level)
 *
 * INVARIANT: Cursor path always points to a RowNode.
 * Offset is position between children (0 to children.length).
 *
 * This is simpler than leaf-level cursors because:
 * - insert/delete/navigate work on row offsets only
 * - More predictable behavior for selections and history
 * - Matches user expectations from MathLive/MathQuill
 *
 * Path format: [childIndex, childIndex, ...]
 * - Empty path [] means "at root row"
 * - [2, 0] means "in first slot of third child of root" (e.g., fraction numerator)
 */

import { MathNode, RowNode, FractionNode, PowerNode, SubscriptNode, SubSupNode, SqrtNode, ParensNode, MatrixNode, FunctionNode } from './ast';

// =============================================================================
// Types
// =============================================================================

/**
 * A cursor position in the AST
 */
export interface CursorPosition {
  /** Path through the tree (indices) */
  path: readonly number[];
  /** Offset within the target node (for row nodes, position between children) */
  offset: number;
}

/**
 * Named slots within structured nodes
 */
export type SlotName =
  | 'numerator' | 'denominator'  // Fraction
  | 'base' | 'exponent' | 'subscript' | 'superscript'  // Power/Sub/Sup
  | 'radicand' | 'index'  // Sqrt
  | 'content'  // Parens
  | 'argument' | 'lower' | 'upper'  // Function with limits
  | 'cell';  // Matrix

/**
 * Information about a focusable slot
 */
export interface SlotInfo {
  name: SlotName;
  path: readonly number[];
  node: MathNode;
}

// =============================================================================
// Cursor Creation
// =============================================================================

/**
 * Create a cursor at the start of a node
 */
export function cursorAtStart(path: readonly number[] = []): CursorPosition {
  return { path, offset: 0 };
}

/**
 * Create a cursor at the end of a row
 * INVARIANT: path must point to a row node
 */
export function cursorAtEnd(root: MathNode, path: readonly number[] = []): CursorPosition {
  const node = getNodeAtPath(root, path);
  if (!node) return { path, offset: 0 };

  if (node.kind === 'row') {
    return { path, offset: node.children.length };
  }

  // If not a row, find the last focusable row within
  return findLastFocusable(root, path);
}

/**
 * Create a cursor at a specific position
 */
export function cursor(path: readonly number[], offset: number): CursorPosition {
  return { path, offset };
}

/**
 * Coerce a cursor position to point to a row node
 * INVARIANT ENFORCER: Walk up to nearest row ancestor and compute offset
 *
 * If the cursor already points to a row, returns it unchanged.
 * If pointing to a non-row node, walks up to find the nearest row ancestor
 * and positions the cursor after the child that contained the original position.
 */
export function coerceToRowCursor(root: MathNode, pos: CursorPosition): CursorPosition {
  const node = getNodeAtPath(root, pos.path);

  // Already at a row - validate offset and return
  if (node?.kind === 'row') {
    const clampedOffset = Math.max(0, Math.min(pos.offset, node.children.length));
    return { path: pos.path, offset: clampedOffset };
  }

  // Not at a row - walk up to find nearest row ancestor
  let currentPath = pos.path;
  while (currentPath.length > 0) {
    const parentP = parentPath(currentPath);
    const parent = getNodeAtPath(root, parentP);

    if (parent?.kind === 'row') {
      // Found a row ancestor - position cursor after the child we came from
      const childIdx = indexInParent(currentPath);
      // Position after the child (childIdx + 1) to place cursor after the structure
      return { path: parentP, offset: childIdx + 1 };
    }

    currentPath = parentP;
  }

  // Root is a row - position at start
  if (root.kind === 'row') {
    return { path: [], offset: 0 };
  }

  // Last resort: find first focusable position
  return findFirstFocusable(root, []);
}

// =============================================================================
// Path Navigation
// =============================================================================

/**
 * Get the node at a given path
 */
export function getNodeAtPath(root: MathNode, path: readonly number[]): MathNode | null {
  let current: MathNode = root;

  for (const index of path) {
    const children = getChildNodes(current);
    if (index < 0 || index >= children.length) {
      return null;
    }
    current = children[index];
  }

  return current;
}

/**
 * Get direct child nodes of a node (for navigation)
 */
export function getChildNodes(node: MathNode): readonly MathNode[] {
  switch (node.kind) {
    case 'row':
      return node.children;
    case 'fraction':
      return [node.numerator, node.denominator];
    case 'power':
      return [node.base, node.exponent];
    case 'subscript':
      return [node.base, node.subscript];
    case 'subsup':
      return [node.base, node.subscript, node.superscript];
    case 'sqrt':
      return node.index ? [node.radicand, node.index] : [node.radicand];
    case 'parens':
      return [node.content];
    case 'function':
      const children: MathNode[] = [];
      if (node.argument) children.push(node.argument);
      if (node.limits?.lower) children.push(node.limits.lower);
      if (node.limits?.upper) children.push(node.limits.upper);
      return children;
    case 'matrix':
      return node.rows.flat();
    default:
      return [];
  }
}

/**
 * Get the parent path (one level up)
 */
export function parentPath(path: readonly number[]): readonly number[] {
  if (path.length === 0) return [];
  return path.slice(0, -1);
}

/**
 * Get the index within parent (last element of path)
 */
export function indexInParent(path: readonly number[]): number {
  if (path.length === 0) return -1;
  return path[path.length - 1];
}

// =============================================================================
// Slot Information
// =============================================================================

/**
 * Get named slots for a node (for semantic navigation)
 */
export function getSlots(node: MathNode, basePath: readonly number[] = []): SlotInfo[] {
  switch (node.kind) {
    case 'fraction':
      return [
        { name: 'numerator', path: [...basePath, 0], node: node.numerator },
        { name: 'denominator', path: [...basePath, 1], node: node.denominator },
      ];
    case 'power':
      return [
        { name: 'base', path: [...basePath, 0], node: node.base },
        { name: 'exponent', path: [...basePath, 1], node: node.exponent },
      ];
    case 'subscript':
      return [
        { name: 'base', path: [...basePath, 0], node: node.base },
        { name: 'subscript', path: [...basePath, 1], node: node.subscript },
      ];
    case 'subsup':
      return [
        { name: 'base', path: [...basePath, 0], node: node.base },
        { name: 'subscript', path: [...basePath, 1], node: node.subscript },
        { name: 'superscript', path: [...basePath, 2], node: node.superscript },
      ];
    case 'sqrt':
      const sqrtSlots: SlotInfo[] = [
        { name: 'radicand', path: [...basePath, 0], node: node.radicand },
      ];
      if (node.index) {
        sqrtSlots.push({ name: 'index', path: [...basePath, 1], node: node.index });
      }
      return sqrtSlots;
    case 'parens':
      return [
        { name: 'content', path: [...basePath, 0], node: node.content },
      ];
    case 'matrix': {
      // Calculate cumulative offset for each row to handle ragged arrays
      let offset = 0;
      const slots: SlotInfo[] = [];
      for (let rowIdx = 0; rowIdx < node.rows.length; rowIdx++) {
        const row = node.rows[rowIdx];
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          slots.push({
            name: 'cell' as SlotName,
            path: [...basePath, offset + colIdx],
            node: row[colIdx],
          });
        }
        offset += row.length;
      }
      return slots;
    }
    default:
      return [];
  }
}

/**
 * Get slot name for a child index
 */
export function getSlotName(parent: MathNode, childIndex: number): SlotName | null {
  switch (parent.kind) {
    case 'fraction':
      return childIndex === 0 ? 'numerator' : 'denominator';
    case 'power':
      return childIndex === 0 ? 'base' : 'exponent';
    case 'subscript':
      return childIndex === 0 ? 'base' : 'subscript';
    case 'subsup':
      return childIndex === 0 ? 'base' : childIndex === 1 ? 'subscript' : 'superscript';
    case 'sqrt':
      return childIndex === 0 ? 'radicand' : 'index';
    case 'parens':
      return 'content';
    case 'matrix':
      return 'cell';
    default:
      return null;
  }
}

// =============================================================================
// Cursor Comparison
// =============================================================================

/**
 * Compare two cursor positions in document order
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 *
 * Key insight: When one path is a prefix of the other, we must compare
 * the offset to the nested path's index to determine document order.
 *
 * Example: cursor at {path:[], offset:1} (after child 0) should be AFTER
 * cursor at {path:[0], offset:5} (inside child 0).
 */
export function compareCursors(a: CursorPosition, b: CursorPosition): -1 | 0 | 1 {
  const minLen = Math.min(a.path.length, b.path.length);

  // Compare common path elements
  for (let i = 0; i < minLen; i++) {
    if (a.path[i] < b.path[i]) return -1;
    if (a.path[i] > b.path[i]) return 1;
  }

  // Paths match up to minLen
  if (a.path.length === b.path.length) {
    // Same path, compare offsets
    if (a.offset < b.offset) return -1;
    if (a.offset > b.offset) return 1;
    return 0;
  }

  if (a.path.length < b.path.length) {
    // A is prefix of B: compare A.offset to B's next path index
    // If A.offset <= nextIdx: A is at or before the child containing B => A < B
    // If A.offset > nextIdx: A is after the child containing B => A > B
    const nextIdx = b.path[a.path.length];
    if (a.offset <= nextIdx) return -1;
    return 1;
  } else {
    // B is prefix of A: compare B.offset to A's next path index
    // If B.offset <= nextIdx: B is at or before the child containing A => B < A
    // If B.offset > nextIdx: B is after the child containing A => B > A
    const nextIdx = a.path[b.path.length];
    if (b.offset <= nextIdx) return 1;
    return -1;
  }
}

/**
 * Check if two cursors are equal
 */
export function cursorsEqual(a: CursorPosition, b: CursorPosition): boolean {
  return compareCursors(a, b) === 0;
}

/**
 * Check if cursor a is before cursor b
 */
export function isBefore(a: CursorPosition, b: CursorPosition): boolean {
  return compareCursors(a, b) === -1;
}

// =============================================================================
// Path Validation
// =============================================================================

/**
 * Check if a path is valid for the given tree
 */
export function isValidPath(root: MathNode, path: readonly number[]): boolean {
  return getNodeAtPath(root, path) !== null;
}

/**
 * Check if a cursor position is valid
 * INVARIANT: Cursor must point to a row with valid offset
 */
export function isValidCursor(root: MathNode, pos: CursorPosition): boolean {
  const node = getNodeAtPath(root, pos.path);
  if (!node) return false;

  // Cursor must be at a row node (MathLive-style invariant)
  if (node.kind !== 'row') return false;

  return pos.offset >= 0 && pos.offset <= node.children.length;
}

// =============================================================================
// Focusable Detection
// =============================================================================

/**
 * Check if a node can receive cursor focus
 * Only rows are focusable (MathLive-style invariant)
 */
export function isFocusable(node: MathNode): boolean {
  return node.kind === 'row';
}

/**
 * Check if a node is or contains a focusable row
 * Used to determine if we can descend into a structure
 */
export function hasDescendantRow(node: MathNode): boolean {
  if (node.kind === 'row') return true;

  // Check children recursively
  const children = getChildNodes(node);
  return children.some((child) => hasDescendantRow(child));
}

/**
 * Find the first focusable position within a node
 * Returns cursor at start of the first row found
 * INVARIANT: Always returns a cursor pointing to a row
 */
export function findFirstFocusable(root: MathNode, basePath: readonly number[] = []): CursorPosition {
  const node = getNodeAtPath(root, basePath) ?? root;

  // Row: cursor at start (offset 0)
  if (node.kind === 'row') {
    return { path: basePath, offset: 0 };
  }

  // Container (fraction, sqrt, etc.): find the first child that is or contains a row
  const children = getChildNodes(node);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    // If child is a row, go there
    if (child.kind === 'row') {
      return { path: [...basePath, i], offset: 0 };
    }
    // If child is a container that might have rows, recurse
    if (hasDescendantRow(child)) {
      return findFirstFocusable(root, [...basePath, i]);
    }
  }

  // Fallback: coerce to row cursor (uses parent row)
  // This handles cases where we're at a leaf node (symbol, number, etc.)
  return coerceToRowCursor(root, { path: basePath, offset: 0 });
}

/**
 * Find the last focusable position within a node
 * Returns cursor at end of the last row found
 * INVARIANT: Always returns a cursor pointing to a row
 */
export function findLastFocusable(root: MathNode, basePath: readonly number[] = []): CursorPosition {
  const node = getNodeAtPath(root, basePath) ?? root;

  // Row: cursor at end (after last child)
  if (node.kind === 'row') {
    return { path: basePath, offset: node.children.length };
  }

  // Container (fraction, sqrt, etc.): find the last child that is or contains a row
  const children = getChildNodes(node);
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    // If child is a row, go there
    if (child.kind === 'row') {
      return { path: [...basePath, i], offset: child.children.length };
    }
    // If child is a container that might have rows, recurse
    if (hasDescendantRow(child)) {
      return findLastFocusable(root, [...basePath, i]);
    }
  }

  // Fallback: coerce to row cursor (uses parent row)
  return coerceToRowCursor(root, { path: basePath, offset: 0 });
}
