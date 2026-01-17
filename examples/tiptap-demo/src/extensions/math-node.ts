/**
 * Tiptap Math Node Extension
 *
 * A custom node extension that integrates peach-math-field into Tiptap.
 * Renders as an inline math expression that can be clicked to edit.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MathNodeView } from '../components/MathNodeView';

export interface MathNodeOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathNode: {
      /**
       * Insert a math node
       */
      insertMath: (latex?: string) => ReturnType;
      /**
       * Update the LaTeX of the selected math node
       */
      updateMath: (latex: string) => ReturnType;
    };
  }
}

export const MathNode = Node.create<MathNodeOptions>({
  name: 'mathNode',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || '',
        renderHTML: (attributes) => ({
          'data-latex': attributes.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'math',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },

  addCommands() {
    return {
      insertMath:
        (latex = '') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
      updateMath:
        (latex: string) =>
        ({ commands, state }) => {
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);
          if (node?.type.name === this.name) {
            return commands.updateAttributes(this.name, { latex });
          }
          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl + M to insert math
      'Mod-m': () => this.editor.commands.insertMath(),
    };
  },

  // Support markdown-style math input: $...$
  addInputRules() {
    return [];
  },
});

export default MathNode;
