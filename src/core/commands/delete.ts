/**
 * Delete Commands
 *
 * Commands for deleting content from the math AST.
 */

import { MathNode, node as nodeBuilder } from '../ast';
import { EditorState, updateState } from '../model';
import { Selection, collapsedSelection, isCollapsed, getStart, getEnd } from '../selection';
import {
  CursorPosition,
  cursor,
  getNodeAtPath,
  parentPath,
  indexInParent,
  getChildNodes,
} from '../cursor';
import { Command } from './types';
import { moveLeft } from './navigate';

// =============================================================================
// Delete Commands
// =============================================================================

/**
 * Delete backward (backspace)
 */
export function deleteBackward(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // If there's a selection, delete it
    if (!isCollapsed(selection)) {
      return deleteSelection()(state);
    }

    const pos = selection.focus;
    const result = deleteAtPosition(root, pos, 'backward');

    if (!result) {
      // Try to move left instead (exit structure)
      return moveLeft(false)(state);
    }

    const [newRoot, newPos] = result;
    return updateState(state, newRoot, collapsedSelection(newPos));
  };
}

/**
 * Delete forward (delete key)
 */
export function deleteForward(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // If there's a selection, delete it
    if (!isCollapsed(selection)) {
      return deleteSelection()(state);
    }

    const pos = selection.focus;
    const result = deleteAtPosition(root, pos, 'forward');

    if (!result) return null;

    const [newRoot, newPos] = result;
    return updateState(state, newRoot, collapsedSelection(newPos));
  };
}

/**
 * Delete the current selection
 */
export function deleteSelection(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    if (isCollapsed(selection)) return null;

    const result = deleteRange(root, selection);
    if (!result) return null;

    const [newRoot, newPos] = result;
    return updateState(state, newRoot, collapsedSelection(newPos));
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Delete at a cursor position in the given direction
 */
function deleteAtPosition(
  root: MathNode,
  pos: CursorPosition,
  direction: 'forward' | 'backward'
): [MathNode, CursorPosition] | null {
  const node = getNodeAtPath(root, pos.path);
  if (!node) return null;

  // In a row, delete adjacent child
  if (node.kind === 'row') {
    const children = node.children;

    if (direction === 'backward') {
      // Delete the child before cursor
      if (pos.offset === 0) {
        // At start of a NESTED row - return null to trigger "exit structure" behavior
        // This allows deleteBackward to fall back to moveLeft, which exits the structure
        // This is the expected UX: backspace at start of a nested row should exit, not delete
        if (pos.path.length > 0) {
          return null;
        }

        // At start of ROOT row - delete first element if there's content
        if (children.length > 0 && !(children.length === 1 && children[0].kind === 'placeholder')) {
          const targetChild = children[0];
          if (isStructuredNode(targetChild)) {
            return flattenStructureForward(root, pos.path, 0, targetChild);
          }
          const newChildren = children.slice(1);
          const finalChildren = newChildren.length === 0 ? [nodeBuilder.placeholder()] : newChildren;
          const newRow = nodeBuilder.row(finalChildren);
          const newRoot = replaceNodeAtPath(root, pos.path, newRow);
          return [newRoot, cursor(pos.path, 0)];
        }
        return null;
      }

      const targetIdx = pos.offset - 1;
      const targetChild = children[targetIdx];

      // If target is a structure, try to flatten it
      if (isStructuredNode(targetChild)) {
        return flattenStructureBackward(root, pos.path, targetIdx, targetChild);
      }

      // Simple deletion
      const newChildren = [...children.slice(0, targetIdx), ...children.slice(targetIdx + 1)];

      // Ensure at least one placeholder
      const finalChildren = newChildren.length === 0 ? [nodeBuilder.placeholder()] : newChildren;

      const newRow = nodeBuilder.row(finalChildren);
      const newRoot = replaceNodeAtPath(root, pos.path, newRow);
      const newPos = cursor(pos.path, Math.max(0, targetIdx));

      return [newRoot, newPos];
    } else {
      // Delete the child after cursor
      if (pos.offset >= children.length) return null; // At end, nothing to delete

      const targetIdx = pos.offset;
      const targetChild = children[targetIdx];

      // If target is a structure, try to flatten it
      if (isStructuredNode(targetChild)) {
        return flattenStructureForward(root, pos.path, targetIdx, targetChild);
      }

      // Simple deletion
      const newChildren = [...children.slice(0, targetIdx), ...children.slice(targetIdx + 1)];

      // Ensure at least one placeholder
      const finalChildren = newChildren.length === 0 ? [nodeBuilder.placeholder()] : newChildren;

      const newRow = nodeBuilder.row(finalChildren);
      const newRoot = replaceNodeAtPath(root, pos.path, newRow);
      const newPos = cursor(pos.path, targetIdx);

      return [newRoot, newPos];
    }
  }

  // At a placeholder - try to exit and delete
  if (node.kind === 'placeholder') {
    return deleteContainingStructure(root, pos.path);
  }

  return null;
}

/**
 * Delete a range (selection)
 */
function deleteRange(
  root: MathNode,
  selection: Selection
): [MathNode, CursorPosition] | null {
  const start = getStart(selection);
  const end = getEnd(selection);

  // Simple case: same path, different offsets (within same row)
  if (
    start.path.length === end.path.length &&
    start.path.every((p, i) => p === end.path[i])
  ) {
    const node = getNodeAtPath(root, start.path);
    if (!node || node.kind !== 'row') return null;

    const children = node.children;
    const newChildren = [
      ...children.slice(0, start.offset),
      ...children.slice(end.offset),
    ];

    // Ensure at least one placeholder
    const finalChildren = newChildren.length === 0 ? [nodeBuilder.placeholder()] : newChildren;

    const newRow = nodeBuilder.row(finalChildren);
    const newRoot = replaceNodeAtPath(root, start.path, newRow);

    return [newRoot, start];
  }

  // Complex case: different paths (cross-structure selection)
  // Find the common ancestor and work upward to find a row
  const commonPath = findCommonAncestorPath(start.path, end.path);
  let rowPath = commonPath;
  let rowNode = getNodeAtPath(root, rowPath);

  // Walk up until we find a row ancestor
  while (rowNode && rowNode.kind !== 'row' && rowPath.length > 0) {
    rowPath = parentPath(rowPath);
    rowNode = getNodeAtPath(root, rowPath);
  }

  // If we found a row ancestor (or root is a row)
  if (rowNode && rowNode.kind === 'row') {
    // Compute the child indices relative to this row
    // Start index: if start.path goes deeper than rowPath, use that index
    // Otherwise, use start.offset
    let startIdx: number;
    if (start.path.length > rowPath.length) {
      startIdx = start.path[rowPath.length];
    } else if (start.path.length === rowPath.length) {
      startIdx = start.offset;
    } else {
      // start.path is shorter than rowPath - shouldn't happen, fallback
      startIdx = 0;
    }

    // End index: similar logic but add 1 to include the ending child
    let endIdx: number;
    if (end.path.length > rowPath.length) {
      endIdx = end.path[rowPath.length] + 1;
    } else if (end.path.length === rowPath.length) {
      endIdx = end.offset;
    } else {
      // end.path is shorter than rowPath - shouldn't happen, fallback
      endIdx = rowNode.children.length;
    }

    // Clamp indices to valid range
    startIdx = Math.max(0, Math.min(startIdx, rowNode.children.length));
    endIdx = Math.max(startIdx, Math.min(endIdx, rowNode.children.length));

    const children = rowNode.children;
    const newChildren = [
      ...children.slice(0, startIdx),
      ...children.slice(endIdx),
    ];

    const finalChildren = newChildren.length === 0 ? [nodeBuilder.placeholder()] : newChildren;
    const newRow = nodeBuilder.row(finalChildren);
    const newRoot = replaceNodeAtPath(root, rowPath, newRow);

    return [newRoot, cursor(rowPath, startIdx)];
  }

  // Fallback: just collapse to start without deleting
  // This should rarely happen if the tree is well-formed
  return [root, start];
}

/**
 * Find the common ancestor path of two paths
 */
function findCommonAncestorPath(a: readonly number[], b: readonly number[]): readonly number[] {
  const common: number[] = [];
  const minLen = Math.min(a.length, b.length);

  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      common.push(a[i]);
    } else {
      break;
    }
  }

  return common;
}

/**
 * Check if a node is a structured node (fraction, power, etc.)
 */
function isStructuredNode(node: MathNode): boolean {
  return ['fraction', 'power', 'subscript', 'subsup', 'sqrt', 'parens', 'matrix'].includes(node.kind);
}

/**
 * Flatten a structure when backspacing into it
 * (e.g., backspace at fraction replaces it with numerator content)
 */
function flattenStructureBackward(
  root: MathNode,
  rowPath: readonly number[],
  targetIdx: number,
  structure: MathNode
): [MathNode, CursorPosition] | null {
  const row = getNodeAtPath(root, rowPath);
  if (!row || row.kind !== 'row') return null;

  // Extract the "main" content of the structure
  const mainContent = getMainContent(structure);
  if (!mainContent) return null;

  const contentNodes = mainContent.kind === 'row' ? mainContent.children : [mainContent];

  // Replace structure with its content
  const children = row.children;
  const newChildren = [
    ...children.slice(0, targetIdx),
    ...contentNodes,
    ...children.slice(targetIdx + 1),
  ];

  const newRow = nodeBuilder.row(newChildren);
  const newRoot = replaceNodeAtPath(root, rowPath, newRow);

  // Position cursor at the start of inserted content
  const newPos = cursor(rowPath, targetIdx);

  return [newRoot, newPos];
}

/**
 * Flatten a structure when deleting forward into it
 */
function flattenStructureForward(
  root: MathNode,
  rowPath: readonly number[],
  targetIdx: number,
  structure: MathNode
): [MathNode, CursorPosition] | null {
  // Same as backward for now
  return flattenStructureBackward(root, rowPath, targetIdx, structure);
}

/**
 * Delete the structure containing a placeholder
 */
function deleteContainingStructure(
  root: MathNode,
  placeholderPath: readonly number[]
): [MathNode, CursorPosition] | null {
  if (placeholderPath.length < 2) return null;

  // Go up to find the containing structure
  const structurePath = parentPath(placeholderPath);
  const structure = getNodeAtPath(root, structurePath);

  if (!structure || !isStructuredNode(structure)) return null;

  // Go up more to find the row containing the structure
  const rowPath = parentPath(structurePath);
  const row = getNodeAtPath(root, rowPath);

  if (!row || row.kind !== 'row') return null;

  const structureIdx = indexInParent(structurePath);

  // Remove the structure, leaving a placeholder
  const children = [...row.children];
  children[structureIdx] = nodeBuilder.placeholder();

  const newRow = nodeBuilder.row(children);
  const newRoot = replaceNodeAtPath(root, rowPath, newRow);

  // Position cursor at the placeholder
  const newPos = cursor([...rowPath, structureIdx], 0);

  return [newRoot, newPos];
}

/**
 * Get the "main" content of a structure
 */
function getMainContent(node: MathNode): MathNode | null {
  switch (node.kind) {
    case 'fraction':
      return node.numerator; // Keep numerator when flattening
    case 'power':
      return node.base;
    case 'subscript':
      return node.base;
    case 'subsup':
      return node.base;
    case 'sqrt':
      return node.radicand;
    case 'parens':
      return node.content;
    default:
      return null;
  }
}

/**
 * Replace a node at a path with a new node
 */
function replaceNodeAtPath(
  root: MathNode,
  path: readonly number[],
  newNode: MathNode
): MathNode {
  if (path.length === 0) {
    return newNode;
  }

  const parentP = parentPath(path);
  const childIdx = indexInParent(path);
  const parent = getNodeAtPath(root, parentP);

  if (!parent) return root;

  const newParent = replaceChild(parent, childIdx, newNode);
  return replaceNodeAtPath(root, parentP, newParent);
}

/**
 * Replace a child in a parent node
 */
function replaceChild(parent: MathNode, index: number, newChild: MathNode): MathNode {
  switch (parent.kind) {
    case 'row':
      const newChildren = [...parent.children];
      newChildren[index] = newChild;
      return nodeBuilder.row(newChildren);

    case 'fraction':
      return index === 0
        ? nodeBuilder.fraction(newChild, parent.denominator)
        : nodeBuilder.fraction(parent.numerator, newChild);

    case 'power':
      return index === 0
        ? nodeBuilder.power(newChild, parent.exponent)
        : nodeBuilder.power(parent.base, newChild);

    case 'subscript':
      return index === 0
        ? nodeBuilder.subscript(newChild, parent.subscript)
        : nodeBuilder.subscript(parent.base, newChild);

    case 'subsup':
      if (index === 0) return nodeBuilder.subsup(newChild, parent.subscript, parent.superscript);
      if (index === 1) return nodeBuilder.subsup(parent.base, newChild, parent.superscript);
      return nodeBuilder.subsup(parent.base, parent.subscript, newChild);

    case 'sqrt':
      return index === 0
        ? nodeBuilder.sqrt(newChild, parent.index)
        : nodeBuilder.sqrt(parent.radicand, newChild);

    case 'parens':
      return nodeBuilder.parens(newChild, parent.open, parent.close, parent.size);

    default:
      return parent;
  }
}
