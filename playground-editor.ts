/**
 * Editor Model Playground
 * Run with: npx tsx playground-editor.ts
 *
 * Tests the editor state, commands, and cursor navigation.
 */

// Import from specific modules to avoid CSS import issues in Node.js
import {
  createEmptyState,
  createHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  EditorState,
  History,
} from './src/core/model';
import {
  insertCharacter,
  insertFraction,
  insertSqrt,
  insertSuperscript,
  insertSubscript,
} from './src/core/commands/insert';
import {
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  selectAll,
} from './src/core/commands/navigate';
import { deleteBackward } from './src/core/commands/delete';
import { serializeToLatex } from './src/parser/ast-to-latex';
import { isCollapsed } from './src/core/selection';

// =============================================================================
// Helper Functions
// =============================================================================

function printState(state: EditorState, label: string = '') {
  const latex = serializeToLatex(state.root);
  const pos = state.selection.focus;
  const collapsed = isCollapsed(state.selection);

  console.log(`${label ? label + ': ' : ''}LaTeX: ${latex}`);
  console.log(`  Cursor: path=[${pos.path.join(',')}] offset=${pos.offset} ${collapsed ? '(collapsed)' : '(selection)'}`);
  console.log('');
}

function applyCommand(
  state: EditorState,
  command: (s: EditorState) => EditorState | null,
  label: string
): EditorState {
  const result = command(state);
  if (result) {
    printState(result, label);
    return result;
  } else {
    console.log(`${label}: Command returned null (no change)`);
    console.log('');
    return state;
  }
}

// =============================================================================
// Test Scenarios
// =============================================================================

console.log('=== Editor Model Playground ===\n');

// Start with empty state
let state = createEmptyState();
let history = createHistory(state);

printState(state, 'Initial (empty)');

// Type "x+y"
console.log('--- Typing "x+y" ---\n');

state = applyCommand(state, insertCharacter('x'), 'Insert x');
history = pushHistory(history, state);

state = applyCommand(state, insertCharacter('+'), 'Insert +');
history = pushHistory(history, state);

state = applyCommand(state, insertCharacter('y'), 'Insert y');
history = pushHistory(history, state);

// Add superscript with multiple characters
console.log('--- Adding superscript (y^{2n}) ---\n');

state = applyCommand(state, insertSuperscript(), 'Insert ^');
state = applyCommand(state, insertCharacter('2'), 'Insert 2');
state = applyCommand(state, insertCharacter('n'), 'Insert n (multiple chars in exponent)');
history = pushHistory(history, state);

// Navigate out of superscript
console.log('--- Navigating out ---\n');

state = applyCommand(state, moveRight(false), 'Move right');
state = applyCommand(state, insertCharacter('='), 'Insert =');
history = pushHistory(history, state);

// Insert fraction with multiple chars in each slot
console.log('--- Inserting fraction (a+b)/(c-d) ---\n');

state = applyCommand(state, insertFraction(), 'Insert fraction');
state = applyCommand(state, insertCharacter('a'), 'Insert a (numerator)');
state = applyCommand(state, insertCharacter('+'), 'Insert + (numerator)');
state = applyCommand(state, insertCharacter('b'), 'Insert b (numerator)');
state = applyCommand(state, moveDown(false), 'Move down (to denominator)');
state = applyCommand(state, insertCharacter('c'), 'Insert c (denominator)');
state = applyCommand(state, insertCharacter('-'), 'Insert - (denominator)');
state = applyCommand(state, insertCharacter('d'), 'Insert d (denominator)');
history = pushHistory(history, state);

// Navigate with Up/Down
console.log('--- Up/Down navigation ---\n');

state = applyCommand(state, moveUp(false), 'Move up (back to numerator)');
state = applyCommand(state, moveDown(false), 'Move down (to denominator)');

// Exit fraction properly - need to move to end then exit
console.log('--- Exiting fraction ---\n');

state = applyCommand(state, moveRight(false), 'Move right (in denominator)');
state = applyCommand(state, moveRight(false), 'Move right (in denominator)');
state = applyCommand(state, moveRight(false), 'Move right (exit denominator)');
state = applyCommand(state, moveRight(false), 'Move right (exit fraction)');

// Insert sqrt with multiple chars
console.log('--- Inserting sqrt(xy) ---\n');

state = applyCommand(state, insertCharacter('+'), 'Insert +');
state = applyCommand(state, insertSqrt(), 'Insert sqrt');
state = applyCommand(state, insertCharacter('x'), 'Insert x');
state = applyCommand(state, insertCharacter('y'), 'Insert y (multiple chars in sqrt)');
history = pushHistory(history, state);

// Test undo/redo
console.log('--- Undo/Redo ---\n');

console.log(`Can undo: ${canUndo(history)}, Can redo: ${canRedo(history)}`);

history = undo(history);
state = history.present;
printState(state, 'After undo');

console.log(`Can undo: ${canUndo(history)}, Can redo: ${canRedo(history)}`);

history = redo(history);
state = history.present;
printState(state, 'After redo');

// Test delete
console.log('--- Delete ---\n');

state = applyCommand(state, deleteBackward(), 'Delete backward');
state = applyCommand(state, deleteBackward(), 'Delete backward again');
history = pushHistory(history, state);

// Final state
console.log('--- Final State ---\n');
printState(state, 'Final');

// Select all
console.log('--- Select All ---\n');
state = applyCommand(state, selectAll(), 'Select all');

console.log('=== Done ===');
