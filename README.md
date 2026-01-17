# peach-math-field

A shadcn-native, highly customizable math editor for React. LaTeX-based with KaTeX rendering.

## Features

- **shadcn-native styling**: Uses CSS variables, automatically inherits your theme
- **LaTeX in/out**: Accepts and outputs standard LaTeX
- **Virtual keyboard**: Built-in math keyboard with Greek letters, operators, matrices
- **Accessible**: Full keyboard navigation, ARIA labels, screen reader support
- **Composable**: Use MathField, MathDisplay, and MathKeyboard independently

## Installation

```bash
npm install peach-math-field
```

You also need KaTeX CSS for proper rendering:

```tsx
import 'katex/dist/katex.min.css';
import 'peach-math-field/styles.css';
```

## Quick Start

```tsx
import { useState } from 'react';
import { MathField, MathDisplay } from 'peach-math-field';
import 'katex/dist/katex.min.css';
import 'peach-math-field/styles.css';

function App() {
  const [latex, setLatex] = useState('x^2 + y^2 = z^2');

  return (
    <div>
      <MathField
        value={latex}
        onChange={setLatex}
        placeholder="Enter math..."
      />
      <MathDisplay latex={latex} />
    </div>
  );
}
```

## Components

### MathField

Interactive math editor with cursor navigation and editing.

```tsx
<MathField
  value={latex}                    // Controlled LaTeX string
  onChange={setLatex}              // Called on edit
  onSelectionChange={handleSel}    // Selection updates
  placeholder="Enter math..."
  readOnly={false}
  autoFocus={false}
  className="my-class"
/>
```

**Ref methods:**
- `focus()` - Focus the field
- `blur()` - Blur the field
- `insertLatex(latex: string)` - Insert LaTeX at cursor

### MathDisplay

Read-only math renderer.

```tsx
<MathDisplay
  latex="\\frac{a}{b}"
  displayMode={false}              // true for block-level display
  errorColor="#cc0000"
  className="my-class"
/>
```

Convenience aliases:
- `<InlineMath latex="..." />` - Inline math
- `<BlockMath latex="..." />` - Block-level math

### MathKeyboard

Virtual keyboard for touch devices or toolbar use.

```tsx
<MathKeyboard
  mathFieldRef={mathFieldRef}      // Ref to MathField to control
  visible={true}
  onVisibilityChange={setVisible}
  defaultTab="basic"               // "basic" | "greek" | "operators" | "matrices"
/>
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move to next placeholder |
| `Shift+Tab` | Move to previous placeholder |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `Ctrl+A` / `Cmd+A` | Select all |
| `Ctrl+C` / `Cmd+C` | Copy selection or all |
| `Ctrl+V` / `Cmd+V` | Paste LaTeX |
| Arrow keys | Navigate cursor |

## Theming

peach-math-field uses CSS variables that inherit from shadcn themes:

```css
.math-field {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.math-field:focus-within {
  outline: 2px solid hsl(var(--ring));
}
```

Define these variables in your app (or use a shadcn theme) and peach-math-field will match automatically.

## Supported LaTeX

- Fractions: `\frac{a}{b}`
- Powers: `x^{2}`, `x^2`
- Subscripts: `x_{i}`, `x_i`
- Roots: `\sqrt{x}`, `\sqrt[3]{x}`
- Parentheses: `\left( \right)`, `()`, `[]`, `\{}`
- Greek letters: `\alpha`, `\beta`, `\pi`, etc.
- Operators: `+`, `-`, `\times`, `\div`, `=`, `\pm`, `\cdot`
- Functions: `\sin`, `\cos`, `\log`, etc.
- Matrices: `\begin{matrix}...\end{matrix}`, `\begin{pmatrix}`, `\begin{bmatrix}`

## Integration Examples

### With Tiptap

See the [examples/tiptap-demo](./examples/tiptap-demo) directory for a complete Tiptap 3 integration with inline math support.

## API Reference

### Parser

```tsx
import { parseLatex, serializeToLatex } from 'peach-math-field';

// Parse LaTeX to AST
const ast = parseLatex('\\frac{1}{2}');

// Serialize AST back to LaTeX
const latex = serializeToLatex(ast);
```

### Commands

For programmatic editing, use commands:

```tsx
import {
  insertFraction,
  insertSuperscript,
  moveLeft,
  deleteBackward,
  executeCommand,
} from 'peach-math-field';

// Execute a command on editor state
const newState = executeCommand(insertFraction(), currentState);
```

## License

MIT
