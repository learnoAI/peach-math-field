/**
 * Commands Index
 *
 * Re-exports all commands for easy importing.
 */

// Types
export {
  type Command,
  type CommandWithOptions,
  type CommandResult,
  type Direction,
  type Unit,
  executeCommand,
  chainCommands,
  tryCommands,
} from './types';

// Navigation
export {
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
} from './navigate';

// Insert
export {
  insertCharacter,
  insertOperator,
  insertGreek,
  insertFraction,
  insertSqrt,
  insertParens,
  insertSuperscript,
  insertSubscript,
  insertMatrix,
  type MatrixStyle,
} from './insert';

// Delete
export {
  deleteBackward,
  deleteForward,
  deleteSelection,
} from './delete';
