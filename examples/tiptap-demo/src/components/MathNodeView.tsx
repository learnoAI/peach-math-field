/**
 * MathNodeView - React component for rendering math nodes in Tiptap
 *
 * When not selected, displays the math using MathDisplay.
 * When clicked, shows the MathField editor with keyboard.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { MathField, MathDisplay, MathFieldRef, MathKeyboard } from 'peach-math-field';

export const MathNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
}) => {
  const latex = node.attrs.latex as string;
  const [isEditing, setIsEditing] = useState(false);
  const [localLatex, setLocalLatex] = useState(latex);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardPosition, setKeyboardPosition] = useState<{ top: number; left: number } | null>(null);
  const mathFieldRef = useRef<MathFieldRef>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const editorRef = useRef<HTMLSpanElement>(null);

  // Sync local state with node attribute
  useEffect(() => {
    setLocalLatex(latex);
  }, [latex]);

  // Calculate keyboard position when editing
  const updateKeyboardPosition = useCallback(() => {
    if (editorRef.current) {
      const rect = editorRef.current.getBoundingClientRect();
      setKeyboardPosition({
        top: rect.bottom + 8, // 8px gap below the field
        left: rect.left,
      });
    }
  }, []);

  // Finish editing and save
  const finishEditing = useCallback(() => {
    updateAttributes({ latex: localLatex });
    setIsEditing(false);
    setShowKeyboard(false);
    setKeyboardPosition(null);
    editor.commands.focus();
  }, [localLatex, updateAttributes, editor]);

  // Close editing when node is deselected
  useEffect(() => {
    if (!selected && isEditing) {
      finishEditing();
    }
  }, [selected, isEditing, finishEditing]);

  // Update keyboard position on scroll or resize
  useEffect(() => {
    if (!isEditing || !showKeyboard) return;

    const handlePositionUpdate = () => updateKeyboardPosition();
    window.addEventListener('scroll', handlePositionUpdate, true);
    window.addEventListener('resize', handlePositionUpdate);

    return () => {
      window.removeEventListener('scroll', handlePositionUpdate, true);
      window.removeEventListener('resize', handlePositionUpdate);
    };
  }, [isEditing, showKeyboard, updateKeyboardPosition]);

  // Handle clicking outside to close editor
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInside = containerRef.current?.contains(target);
      const isKeyboard = (target as Element)?.closest?.('.math-keyboard');

      if (!isInside && !isKeyboard) {
        finishEditing();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, finishEditing]);

  // Handle escape key to close editor
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishEditing();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, finishEditing]);

  const handleChange = useCallback((newLatex: string) => {
    setLocalLatex(newLatex);
  }, []);

  // Only enter editing mode when user explicitly clicks
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      setShowKeyboard(true);
      setTimeout(() => {
        mathFieldRef.current?.focus();
        updateKeyboardPosition();
      }, 50);
    }
  }, [isEditing, updateKeyboardPosition]);

  return (
    <NodeViewWrapper
      as="span"
      className="math-node-wrapper"
      style={{ display: 'inline-block', position: 'relative' }}
      ref={containerRef}
    >
      {isEditing ? (
        <span className="math-node-editor" ref={editorRef}>
          <MathField
            ref={mathFieldRef}
            value={localLatex}
            onChange={handleChange}
            placeholder="Enter math..."
            className="math-node-field"
            autoFocus
          />
          {showKeyboard && keyboardPosition && (
            <div
              className="math-node-keyboard-container"
              style={{
                top: keyboardPosition.top,
                left: keyboardPosition.left,
              }}
            >
              <MathKeyboard
                mathFieldRef={mathFieldRef}
                visible={showKeyboard}
                onVisibilityChange={setShowKeyboard}
              />
            </div>
          )}
        </span>
      ) : (
        <span
          className={`math-node-display ${selected ? 'math-node-selected' : ''}`}
          onClick={handleClick}
          title="Click to edit"
        >
          {localLatex ? (
            <MathDisplay latex={localLatex} />
          ) : (
            <span className="math-node-placeholder">Click to add math</span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
};

export default MathNodeView;
