/**
 * Insert Commands
 *
 * Commands for inserting content into the math AST.
 */

import { MathNode, node as nodeBuilder, RowNode } from '../ast';
import { EditorState, updateState } from '../model';
import { Selection, collapsedSelection, isCollapsed, getStart, getEnd, extractSelectedNodes } from '../selection';
import {
  CursorPosition,
  cursor,
  getNodeAtPath,
  parentPath,
  indexInParent,
} from '../cursor';
import { Command } from './types';

// =============================================================================
// Helper: Find containing row
// =============================================================================

/**
 * Find the nearest ancestor row that contains the cursor position.
 * Returns [rowPath, indexInRow] or null if not found.
 * If cursor is already at a row, returns [pos.path, pos.offset].
 */
function findContainingRow(
  root: MathNode,
  pos: CursorPosition
): [readonly number[], number] | null {
  const node = getNodeAtPath(root, pos.path);
  if (!node) return null;

  // If we're at a row, return it directly
  if (node.kind === 'row') {
    return [pos.path, pos.offset];
  }

  // Walk up the tree to find the nearest row
  let currentPath = pos.path;
  while (currentPath.length > 0) {
    const parentP = parentPath(currentPath);
    const parent = getNodeAtPath(root, parentP);
    if (parent && parent.kind === 'row') {
      const idx = indexInParent(currentPath);
      // Position cursor after the current element if we were past it
      return [parentP, idx + (pos.offset > 0 ? 1 : 0)];
    }
    currentPath = parentP;
  }

  // Root is a row
  if (root.kind === 'row') {
    return [[], 0];
  }

  return null;
}

// =============================================================================
// Basic Insert Commands
// =============================================================================

/**
 * Insert a character (number or letter)
 */
export function insertCharacter(char: string): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // Delete selection first if any
    const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

    // Determine what kind of node to create
    let newNode: MathNode;
    if (/^[0-9]$/.test(char)) {
      newNode = nodeBuilder.number(char);
    } else if (/^[a-zA-Z]$/.test(char)) {
      newNode = nodeBuilder.symbol(char);
    } else if (/^[+\-=<>*\/!',.:;]$/.test(char)) {
      newNode = nodeBuilder.operator(char);
    } else {
      // Unknown character, treat as symbol
      newNode = nodeBuilder.symbol(char);
    }

    const result = insertNodeAtPosition(cleanRoot, cleanPos, newNode);
    if (!result) return null;

    const [newRoot, newPos] = result;
    return updateState(state, newRoot, collapsedSelection(newPos));
  };
}

/**
 * Insert an operator
 * Accepts operators with or without leading backslash (e.g., 'times' or '\\times')
 */
export function insertOperator(op: string): Command {
  // Normalize: strip leading backslash if present for consistency
  // The serializer expects command operators without backslash (e.g., 'times' not '\\times')
  const normalizedOp = op.startsWith('\\') ? op.slice(1) : op;

  return (state: EditorState) => {
    const { root, selection } = state;

    const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

    const newNode = nodeBuilder.operator(normalizedOp);
    const result = insertNodeAtPosition(cleanRoot, cleanPos, newNode);
    if (!result) return null;

    const [newRoot, newPos] = result;
    return updateState(state, newRoot, collapsedSelection(newPos));
  };
}

/**
 * Insert a Greek letter
 */
export function insertGreek(name: string): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

    const newNode = nodeBuilder.symbol(name);
    const result = insertNodeAtPosition(cleanRoot, cleanPos, newNode);
    if (!result) return null;

    const [newRoot, newPos] = result;
    return updateState(state, newRoot, collapsedSelection(newPos));
  };
}

// =============================================================================
// Structure Insert Commands
// =============================================================================

/**
 * Insert a fraction, wrapping selection as numerator
 */
export function insertFraction(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // If there's a selection, use it as numerator
    if (!isCollapsed(selection)) {
      return wrapSelectionInFraction(state);
    }

    // Insert empty fraction with cursor in numerator
    // Numerator and denominator are rows so they can contain multiple elements
    const pos = selection.focus;
    const fraction = nodeBuilder.fraction(
      nodeBuilder.row([nodeBuilder.placeholder()]),
      nodeBuilder.row([nodeBuilder.placeholder()])
    );

    const result = insertNodeAtPosition(root, pos, fraction);
    if (!result) return null;

    const [newRoot, insertPos] = result;

    // Move cursor into the numerator (first placeholder)
    // The fraction was inserted at insertPos.path with index insertPos.offset - 1
    // Numerator is child 0 of the fraction
    const fracPath = [...insertPos.path, insertPos.offset - 1];
    const cursorPos = cursor([...fracPath, 0], 0); // numerator row

    return updateState(state, newRoot, collapsedSelection(cursorPos));
  };
}

/**
 * Insert a square root
 */
export function insertSqrt(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // If there's a selection, wrap it
    if (!isCollapsed(selection)) {
      return wrapSelectionInSqrt(state);
    }

    // Insert empty sqrt with cursor in radicand
    // Radicand is a row so it can contain multiple elements
    const pos = selection.focus;
    const sqrt = nodeBuilder.sqrt(nodeBuilder.row([nodeBuilder.placeholder()]));

    const result = insertNodeAtPosition(root, pos, sqrt);
    if (!result) return null;

    const [newRoot, insertPos] = result;

    // Move cursor into radicand
    // The sqrt was inserted at insertPos.path with index insertPos.offset - 1
    // Radicand is child 0 of the sqrt
    const sqrtPath = [...insertPos.path, insertPos.offset - 1];
    const cursorPos = cursor([...sqrtPath, 0], 0); // radicand row

    return updateState(state, newRoot, collapsedSelection(cursorPos));
  };
}

/**
 * Insert parentheses, wrapping selection
 */
export function insertParens(open: '(' | '[' | '{' = '('): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    const close = open === '(' ? ')' : open === '[' ? ']' : '}';

    // If there's a selection, wrap it
    if (!isCollapsed(selection)) {
      return wrapSelectionInParens(state, open, close);
    }

    // Insert empty parens with cursor inside
    // Content is a row so it can contain multiple elements
    const pos = selection.focus;
    const parens = nodeBuilder.parens(nodeBuilder.row([nodeBuilder.placeholder()]), open, close);

    const result = insertNodeAtPosition(root, pos, parens);
    if (!result) return null;

    const [newRoot, insertPos] = result;

    // Move cursor into content
    // The parens was inserted at insertPos.path with index insertPos.offset - 1
    // Content is child 0 of the parens
    const parensPath = [...insertPos.path, insertPos.offset - 1];
    const cursorPos = cursor([...parensPath, 0], 0); // content row

    return updateState(state, newRoot, collapsedSelection(cursorPos));
  };
}

/**
 * Insert superscript (power)
 */
export function insertSuperscript(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const pos = selection.focus;

    // Find the containing row and position within it
    const rowInfo = findContainingRow(root, pos);
    if (!rowInfo) return null;

    const [rowPath, offset] = rowInfo;
    const row = getNodeAtPath(root, rowPath);
    if (!row || row.kind !== 'row') return null;

    const children = row.children;
    const childIdx = offset > 0 ? offset - 1 : 0;

    if (childIdx >= children.length) return null;

    const base = children[childIdx];

    // Create power node with row for exponent
    const power = nodeBuilder.power(base, nodeBuilder.row([nodeBuilder.placeholder()]));

    // Replace base with power
    const newChildren = [...children.slice(0, childIdx), power, ...children.slice(childIdx + 1)];
    const newRow = nodeBuilder.row(newChildren);
    const newRoot = replaceNodeAtPath(root, rowPath, newRow);

    // Move cursor into exponent
    const cursorPos = cursor([...rowPath, childIdx, 1], 0);

    return updateState(state, newRoot, collapsedSelection(cursorPos));
  };
}

/**
 * Insert subscript
 */
export function insertSubscript(): Command {
  return (state: EditorState) => {
    const { root, selection } = state;
    const pos = selection.focus;

    // Find the containing row and position within it
    const rowInfo = findContainingRow(root, pos);
    if (!rowInfo) return null;

    const [rowPath, offset] = rowInfo;
    const row = getNodeAtPath(root, rowPath);
    if (!row || row.kind !== 'row') return null;

    const children = row.children;
    const childIdx = offset > 0 ? offset - 1 : 0;

    if (childIdx >= children.length) return null;

    const base = children[childIdx];

    // Create subscript node with row for subscript
    const sub = nodeBuilder.subscript(base, nodeBuilder.row([nodeBuilder.placeholder()]));

    // Replace base with subscript
    const newChildren = [...children.slice(0, childIdx), sub, ...children.slice(childIdx + 1)];
    const newRow = nodeBuilder.row(newChildren);
    const newRoot = replaceNodeAtPath(root, rowPath, newRow);

    // Move cursor into subscript
    const cursorPos = cursor([...rowPath, childIdx, 1], 0);

    return updateState(state, newRoot, collapsedSelection(cursorPos));
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Delete the content of a selection, return cleaned tree and cursor position
 */
function deleteSelectionContent(
  root: MathNode,
  selection: Selection
): [MathNode, CursorPosition] {
  if (isCollapsed(selection)) {
    return [root, selection.focus];
  }

  const start = getStart(selection);
  const end = getEnd(selection);

  // Simple case: same path (within same row)
  if (
    start.path.length === end.path.length &&
    start.path.every((p, i) => p === end.path[i])
  ) {
    const node = getNodeAtPath(root, start.path);
    if (!node || node.kind !== 'row') {
      // Can't delete within non-row nodes, just collapse to start
      return [root, start];
    }

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
  // Find the common ancestor and delete the range
  const commonPath = findCommonAncestorPath(start.path, end.path);
  const commonNode = getNodeAtPath(root, commonPath);

  if (commonNode && commonNode.kind === 'row') {
    // Both endpoints are within the same row (possibly via nested paths)
    // Determine which children to delete
    const startIdx = start.path.length > commonPath.length
      ? start.path[commonPath.length]
      : start.offset;
    const endIdx = end.path.length > commonPath.length
      ? end.path[commonPath.length] + 1
      : end.offset;

    const children = commonNode.children;
    const newChildren = [
      ...children.slice(0, startIdx),
      ...children.slice(endIdx),
    ];

    const finalChildren = newChildren.length === 0 ? [nodeBuilder.placeholder()] : newChildren;
    const newRow = nodeBuilder.row(finalChildren);
    const newRoot = replaceNodeAtPath(root, commonPath, newRow);

    return [newRoot, cursor(commonPath, startIdx)];
  }

  // Fallback: just collapse to start
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
 * Insert a node at a cursor position
 * Returns [newRoot, newCursorPosition] or null if failed
 *
 * INVARIANT: pos.path must point to a RowNode (MathLive-style cursor)
 */
function insertNodeAtPosition(
  root: MathNode,
  pos: CursorPosition,
  newNode: MathNode
): [MathNode, CursorPosition] | null {
  const targetNode = getNodeAtPath(root, pos.path);
  if (!targetNode || targetNode.kind !== 'row') return null;

  const children = [...targetNode.children];

  // Replace placeholder if we're inserting at a single placeholder row
  if (children.length === 1 && children[0].kind === 'placeholder') {
    children[0] = newNode;
    const newRow = nodeBuilder.row(children);
    const newRoot = replaceNodeAtPath(root, pos.path, newRow);
    return [newRoot, cursor(pos.path, 1)];
  }

  // Standard insertion: splice at offset
  children.splice(pos.offset, 0, newNode);

  const newRow = nodeBuilder.row(children);
  const newRoot = replaceNodeAtPath(root, pos.path, newRow);
  const newPos = cursor(pos.path, pos.offset + 1);

  return [newRoot, newPos];
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

    case 'matrix': {
      // Convert flat index back to row/col indices
      const cols = parent.rows[0]?.length || 1;
      const rowIdx = Math.floor(index / cols);
      const colIdx = index % cols;

      // Create new rows array with the updated cell
      const newRows = parent.rows.map((row, r) =>
        r === rowIdx
          ? row.map((cell, c) => (c === colIdx ? newChild : cell))
          : row
      );

      return nodeBuilder.matrix(newRows, parent.style, parent.colSpec);
    }

    default:
      return parent;
  }
}

/**
 * Wrap selection in a fraction (selection becomes numerator)
 */
function wrapSelectionInFraction(state: EditorState): EditorState | null {
  const { root, selection } = state;

  // Extract the selected content
  const selectedNode = extractSelectedNodes(root, selection);
  if (!selectedNode) {
    // Fallback: just insert empty fraction
    return insertFraction()(updateState(state, root, collapsedSelection(getStart(selection))));
  }

  // Delete the selection content first
  const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

  // Wrap in a row if not already a row
  const numeratorContent = selectedNode.kind === 'row'
    ? selectedNode
    : nodeBuilder.row([selectedNode]);

  // Create fraction with selected content as numerator
  const fraction = nodeBuilder.fraction(
    numeratorContent,
    nodeBuilder.row([nodeBuilder.placeholder()])
  );

  // Insert the fraction at the cleaned position
  const result = insertNodeAtPosition(cleanRoot, cleanPos, fraction);
  if (!result) return null;

  const [newRoot, insertPos] = result;

  // Position cursor in the denominator (second child of fraction)
  const fracPath = [...insertPos.path, insertPos.offset - 1];
  const cursorPos = cursor([...fracPath, 1], 0); // denominator row

  return updateState(state, newRoot, collapsedSelection(cursorPos));
}

/**
 * Wrap selection in sqrt
 */
function wrapSelectionInSqrt(state: EditorState): EditorState | null {
  const { root, selection } = state;

  // Extract the selected content
  const selectedNode = extractSelectedNodes(root, selection);
  if (!selectedNode) {
    // Fallback: just insert empty sqrt
    return insertSqrt()(updateState(state, root, collapsedSelection(getStart(selection))));
  }

  // Delete the selection content first
  const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

  // Wrap in a row if not already a row
  const radicandContent = selectedNode.kind === 'row'
    ? selectedNode
    : nodeBuilder.row([selectedNode]);

  // Create sqrt with selected content as radicand
  const sqrt = nodeBuilder.sqrt(radicandContent);

  // Insert the sqrt at the cleaned position
  const result = insertNodeAtPosition(cleanRoot, cleanPos, sqrt);
  if (!result) return null;

  const [newRoot, insertPos] = result;

  // Position cursor at the end of the radicand content
  const sqrtPath = [...insertPos.path, insertPos.offset - 1];
  const radicandPath = [...sqrtPath, 0];
  const radicandNode = getNodeAtPath(newRoot, radicandPath);
  const endOffset = radicandNode?.kind === 'row' ? radicandNode.children.length : 0;
  const cursorPos = cursor(radicandPath, endOffset);

  return updateState(state, newRoot, collapsedSelection(cursorPos));
}

/**
 * Wrap selection in parentheses
 */
function wrapSelectionInParens(
  state: EditorState,
  open: string,
  close: string
): EditorState | null {
  const { root, selection } = state;

  // Extract the selected content
  const selectedNode = extractSelectedNodes(root, selection);
  if (!selectedNode) {
    // Fallback: just insert empty parens
    return insertParens(open as '(' | '[' | '{')(
      updateState(state, root, collapsedSelection(getStart(selection)))
    );
  }

  // Delete the selection content first
  const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

  // Wrap in a row if not already a row
  const parensContent = selectedNode.kind === 'row'
    ? selectedNode
    : nodeBuilder.row([selectedNode]);

  // Create parens with selected content
  const parens = nodeBuilder.parens(
    parensContent,
    open as '(' | '[' | '{' | '|' | '\\|' | '\\langle',
    close as ')' | ']' | '}' | '|' | '\\|' | '\\rangle'
  );

  // Insert the parens at the cleaned position
  const result = insertNodeAtPosition(cleanRoot, cleanPos, parens);
  if (!result) return null;

  const [newRoot, insertPos] = result;

  // Position cursor at the end of the parens content
  const parensPath = [...insertPos.path, insertPos.offset - 1];
  const contentPath = [...parensPath, 0];
  const contentNode = getNodeAtPath(newRoot, contentPath);
  const endOffset = contentNode?.kind === 'row' ? contentNode.children.length : 0;
  const cursorPos = cursor(contentPath, endOffset);

  return updateState(state, newRoot, collapsedSelection(cursorPos));
}

// =============================================================================
// Matrix Commands
// =============================================================================

export type MatrixStyle = 'matrix' | 'pmatrix' | 'bmatrix' | 'Bmatrix' | 'vmatrix' | 'Vmatrix';

/**
 * Insert a matrix with specified dimensions
 */
export function insertMatrix(
  rows: number = 2,
  cols: number = 2,
  style: MatrixStyle = 'pmatrix'
): Command {
  return (state: EditorState) => {
    const { root, selection } = state;

    // Delete selection first if any
    const [cleanRoot, cleanPos] = deleteSelectionContent(root, selection);

    // Create the matrix cells (each cell is a row with a placeholder)
    const matrixRows: MathNode[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: MathNode[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(nodeBuilder.row([nodeBuilder.placeholder()]));
      }
      matrixRows.push(row);
    }

    const matrixNode = nodeBuilder.matrix(matrixRows, style);

    const result = insertNodeAtPosition(cleanRoot, cleanPos, matrixNode);
    if (!result) return null;

    const [newRoot, insertPos] = result;

    // Position cursor in the first cell (row 0, col 0)
    // The matrix was inserted at insertPos.path with index insertPos.offset - 1
    // Matrix rows are accessed via getChildren, first cell is rows[0][0]
    const matrixPath = [...insertPos.path, insertPos.offset - 1];
    // First cell is at index 0 in the flattened children (row 0, col 0)
    const cursorPos = cursor([...matrixPath, 0], 0);

    return updateState(state, newRoot, collapsedSelection(cursorPos));
  };
}
