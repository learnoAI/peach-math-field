/**
 * Editor Model Tests
 */

import { describe, it, expect } from 'vitest';
import { node } from './ast';
import {
  createEmptyState,
  createStateFromAST,
  createHistory,
  updateRoot,
  updateSelection,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  isEmpty,
  hasSelection,
} from './model';
import { cursor, cursorAtStart, getNodeAtPath } from './cursor';
import { collapsedSelection, selection, isCollapsed } from './selection';
import {
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  insertCharacter,
  insertFraction,
  deleteBackward,
  selectAll,
} from './commands';

// =============================================================================
// State Creation Tests
// =============================================================================

describe('Editor State', () => {
  it('creates empty state with placeholder', () => {
    const state = createEmptyState();
    expect(state.root.kind).toBe('row');
    if (state.root.kind === 'row') {
      expect(state.root.children.length).toBe(1);
      expect(state.root.children[0].kind).toBe('placeholder');
    }
  });

  it('creates state from AST', () => {
    const ast = node.row([node.symbol('x'), node.operator('+'), node.symbol('y')]);
    const state = createStateFromAST(ast);
    // Use deep equality since normalization creates a new object
    expect(state.root).toStrictEqual(ast);
    expect(isCollapsed(state.selection)).toBe(true);
  });

  it('isEmpty returns true for empty state', () => {
    const state = createEmptyState();
    expect(isEmpty(state)).toBe(true);
  });

  it('isEmpty returns false for non-empty state', () => {
    const ast = node.row([node.symbol('x')]);
    const state = createStateFromAST(ast);
    expect(isEmpty(state)).toBe(false);
  });
});

// =============================================================================
// History Tests
// =============================================================================

describe('History', () => {
  it('creates initial history', () => {
    const state = createEmptyState();
    const history = createHistory(state);

    expect(history.past.length).toBe(0);
    expect(history.present).toBe(state);
    expect(history.future.length).toBe(0);
  });

  it('pushes state to history', () => {
    const state1 = createEmptyState();
    const state2 = { ...state1, root: node.row([node.symbol('x')]) };

    let history = createHistory(state1);
    history = pushHistory(history, state2);

    expect(history.past.length).toBe(1);
    expect(history.past[0]).toBe(state1);
    expect(history.present).toBe(state2);
    expect(history.future.length).toBe(0);
  });

  it('undo returns to previous state', () => {
    const state1 = createEmptyState();
    const state2 = { ...state1, root: node.row([node.symbol('x')]) };

    let history = createHistory(state1);
    history = pushHistory(history, state2);
    history = undo(history);

    expect(history.present).toBe(state1);
    expect(history.future.length).toBe(1);
    expect(history.future[0]).toBe(state2);
  });

  it('redo restores undone state', () => {
    const state1 = createEmptyState();
    const state2 = { ...state1, root: node.row([node.symbol('x')]) };

    let history = createHistory(state1);
    history = pushHistory(history, state2);
    history = undo(history);
    history = redo(history);

    expect(history.present).toBe(state2);
    expect(history.past.length).toBe(1);
    expect(history.future.length).toBe(0);
  });

  it('canUndo returns correct value', () => {
    const state = createEmptyState();
    let history = createHistory(state);

    expect(canUndo(history)).toBe(false);

    history = pushHistory(history, { ...state, root: node.row([node.symbol('x')]) });
    expect(canUndo(history)).toBe(true);
  });

  it('canRedo returns correct value', () => {
    const state1 = createEmptyState();
    const state2 = { ...state1, root: node.row([node.symbol('x')]) };

    let history = createHistory(state1);
    expect(canRedo(history)).toBe(false);

    history = pushHistory(history, state2);
    history = undo(history);
    expect(canRedo(history)).toBe(true);
  });

  it('new changes clear redo stack', () => {
    const state1 = createEmptyState();
    const state2 = { ...state1, root: node.row([node.symbol('x')]) };
    const state3 = { ...state1, root: node.row([node.symbol('y')]) };

    let history = createHistory(state1);
    history = pushHistory(history, state2);
    history = undo(history);
    history = pushHistory(history, state3);

    expect(history.future.length).toBe(0);
    expect(canRedo(history)).toBe(false);
  });
});

// =============================================================================
// Cursor Tests
// =============================================================================

describe('Cursor', () => {
  it('getNodeAtPath returns correct node', () => {
    const ast = node.row([
      node.symbol('x'),
      node.fraction(node.number('1'), node.number('2')),
    ]);

    expect(getNodeAtPath(ast, [])?.kind).toBe('row');
    expect(getNodeAtPath(ast, [0])?.kind).toBe('symbol');
    expect(getNodeAtPath(ast, [1])?.kind).toBe('fraction');
    expect(getNodeAtPath(ast, [1, 0])?.kind).toBe('number'); // numerator
    expect(getNodeAtPath(ast, [1, 1])?.kind).toBe('number'); // denominator
  });

  it('getNodeAtPath returns null for invalid path', () => {
    const ast = node.row([node.symbol('x')]);

    expect(getNodeAtPath(ast, [5])).toBeNull();
    expect(getNodeAtPath(ast, [0, 0])).toBeNull();
  });
});

// =============================================================================
// Selection Tests
// =============================================================================

describe('Selection', () => {
  it('creates collapsed selection', () => {
    const sel = collapsedSelection(cursor([], 0));
    expect(isCollapsed(sel)).toBe(true);
  });

  it('creates range selection', () => {
    const sel = selection(cursor([], 0), cursor([], 2));
    expect(isCollapsed(sel)).toBe(false);
  });

  it('hasSelection returns correct value', () => {
    const state1 = createEmptyState();
    expect(hasSelection(state1)).toBe(false);

    const state2 = updateSelection(state1, selection(cursor([0], 0), cursor([0], 1)));
    expect(hasSelection(state2)).toBe(true);
  });
});

// =============================================================================
// Navigation Command Tests
// =============================================================================

describe('Navigation Commands', () => {
  it('moveRight moves cursor forward', () => {
    const ast = node.row([node.symbol('x'), node.symbol('y')]);
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([], 0)),
    };

    const result = moveRight(false)(state);
    expect(result).not.toBeNull();
    expect(result!.selection.focus.offset).toBe(1);
  });

  it('moveLeft moves cursor backward', () => {
    const ast = node.row([node.symbol('x'), node.symbol('y')]);
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([], 2)),
    };

    const result = moveLeft(false)(state);
    expect(result).not.toBeNull();
    expect(result!.selection.focus.offset).toBe(1);
  });

  it('moveUp moves into superscript/numerator', () => {
    const ast = node.row([
      node.fraction(
        node.row([node.symbol('a')]),
        node.row([node.symbol('b')])
      ),
    ]);
    // Position cursor in denominator
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([0, 1], 0)),
    };

    const result = moveUp(false)(state);
    expect(result).not.toBeNull();
    // Should be in numerator now
    expect(result!.selection.focus.path[1]).toBe(0);
  });

  it('moveDown moves into subscript/denominator', () => {
    const ast = node.row([
      node.fraction(
        node.row([node.symbol('a')]),
        node.row([node.symbol('b')])
      ),
    ]);
    // Position cursor in numerator
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([0, 0], 0)),
    };

    const result = moveDown(false)(state);
    expect(result).not.toBeNull();
    // Should be in denominator now
    expect(result!.selection.focus.path[1]).toBe(1);
  });

  it('selectAll selects entire content', () => {
    const ast = node.row([node.symbol('x'), node.symbol('y'), node.symbol('z')]);
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([], 1)),
    };

    const result = selectAll()(state);
    expect(result).not.toBeNull();
    expect(isCollapsed(result!.selection)).toBe(false);
  });
});

// =============================================================================
// Insert Command Tests
// =============================================================================

describe('Insert Commands', () => {
  it('insertCharacter inserts a letter', () => {
    const state = createEmptyState();

    const result = insertCharacter('x')(state);
    expect(result).not.toBeNull();
    expect(result!.root.kind).toBe('row');
    if (result!.root.kind === 'row') {
      expect(result!.root.children[0].kind).toBe('symbol');
    }
  });

  it('insertCharacter inserts a number', () => {
    const state = createEmptyState();

    const result = insertCharacter('5')(state);
    expect(result).not.toBeNull();
    if (result!.root.kind === 'row') {
      expect(result!.root.children[0].kind).toBe('number');
    }
  });

  it('insertCharacter inserts an operator', () => {
    const state = createEmptyState();

    const result = insertCharacter('+')(state);
    expect(result).not.toBeNull();
    if (result!.root.kind === 'row') {
      expect(result!.root.children[0].kind).toBe('operator');
    }
  });

  it('insertFraction inserts a fraction', () => {
    const state = createEmptyState();

    const result = insertFraction()(state);
    expect(result).not.toBeNull();
    if (result!.root.kind === 'row') {
      expect(result!.root.children[0].kind).toBe('fraction');
    }
  });
});

// =============================================================================
// Delete Command Tests
// =============================================================================

describe('Delete Commands', () => {
  it('deleteBackward removes previous character', () => {
    // Start with 'xy', cursor after y
    const ast = node.row([node.symbol('x'), node.symbol('y')]);
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([], 2)),
    };

    const result = deleteBackward()(state);
    expect(result).not.toBeNull();
    if (result!.root.kind === 'row') {
      expect(result!.root.children.length).toBe(1);
      expect(result!.root.children[0].kind).toBe('symbol');
    }
  });

  it('deleteBackward at start deletes first element when row has content', () => {
    const ast = node.row([node.symbol('x')]);
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([], 0)),
    };

    // At position 0 with content, backspace deletes the first element
    // This makes backspace work intuitively after deleting elements
    const result = deleteBackward()(state);
    expect(result).not.toBeNull();
    expect(result!.root.kind).toBe('row');
    expect((result!.root as any).children[0].kind).toBe('placeholder');
  });

  it('deleteBackward at start of empty row returns null', () => {
    const ast = node.row([node.placeholder()]);
    const state = {
      root: ast,
      selection: collapsedSelection(cursor([], 0)),
    };

    // At position 0 with only placeholder, nothing to delete
    const result = deleteBackward()(state);
    expect(result).toBeNull();
  });
});
