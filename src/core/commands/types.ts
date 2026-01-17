/**
 * Command Types
 *
 * Commands are pure functions that transform editor state.
 * They return a new state or null if the command couldn't be executed.
 */

import { EditorState } from '../model';

// =============================================================================
// Command Types
// =============================================================================

/**
 * A command that transforms editor state
 * Returns new state, or null if command couldn't be executed
 */
export type Command = (state: EditorState) => EditorState | null;

/**
 * A command with options
 */
export type CommandWithOptions<T> = (state: EditorState, options: T) => EditorState | null;

/**
 * Result of executing a command
 */
export interface CommandResult {
  /** New state after command */
  state: EditorState;
  /** Whether the command actually changed something */
  changed: boolean;
  /** Whether this should be recorded in history */
  recordHistory: boolean;
  /** Whether this should be merged with previous history entry */
  mergeHistory: boolean;
}

/**
 * Direction for navigation commands
 */
export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * Unit for navigation/deletion
 */
export type Unit = 'character' | 'word' | 'line' | 'node' | 'all';

// =============================================================================
// Command Helpers
// =============================================================================

/**
 * Execute a command and return result
 */
export function executeCommand(
  state: EditorState,
  command: Command,
  options: { recordHistory?: boolean; mergeHistory?: boolean } = {}
): CommandResult {
  const { recordHistory = true, mergeHistory = false } = options;

  const newState = command(state);

  if (newState === null) {
    return {
      state,
      changed: false,
      recordHistory: false,
      mergeHistory: false,
    };
  }

  return {
    state: newState,
    changed: true,
    recordHistory,
    mergeHistory,
  };
}

/**
 * Chain multiple commands together
 * Stops at the first command that returns null
 */
export function chainCommands(...commands: Command[]): Command {
  return (state: EditorState) => {
    let currentState = state;

    for (const command of commands) {
      const result = command(currentState);
      if (result === null) {
        return currentState === state ? null : currentState;
      }
      currentState = result;
    }

    return currentState;
  };
}

/**
 * Try multiple commands until one succeeds
 */
export function tryCommands(...commands: Command[]): Command {
  return (state: EditorState) => {
    for (const command of commands) {
      const result = command(state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  };
}
