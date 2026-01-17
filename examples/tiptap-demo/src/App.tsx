import { useState } from 'react';
import { TiptapEditor } from './components/TiptapEditor';
import { Button } from './components/ui/button';
import { Moon, Sun } from 'lucide-react';

// Import styles
import 'katex/dist/katex.min.css'; // Required for KaTeX rendering
import '../../../src/styles/math-field.css';
import './styles/tiptap.css';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [html, setHtml] = useState('');

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const initialContent = `
    <h1>Math in Tiptap</h1>
    <p>This is a <strong>Tiptap 3</strong> editor with integrated math support using <em>peach-math-field</em>.</p>
    <h2>How to use</h2>
    <ul>
      <li>Click the <strong>Math</strong> button in the toolbar to insert a math expression</li>
      <li>Or press <code>Ctrl+M</code> (or <code>Cmd+M</code> on Mac)</li>
      <li>Click on any math expression to edit it</li>
      <li>Use the virtual keyboard or type LaTeX directly</li>
      <li>Press <code>Escape</code> or click outside to finish editing</li>
    </ul>
    <h2>Example</h2>
    <p>Here's the quadratic formula: <span data-type="math" data-latex="x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"></span></p>
    <p>And Einstein's famous equation: <span data-type="math" data-latex="E = mc^2"></span></p>
    <p>Try adding your own math expressions!</p>
  `;

  return (
    <div className={`min-h-screen p-8 ${darkMode ? 'dark' : ''}`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tiptap + peach-math-field</h1>
            <p className="text-muted-foreground">
              Rich text editing with inline math support
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Editor */}
        <div className="editor-wrapper">
          <TiptapEditor
            content={initialContent}
            onChange={setHtml}
            placeholder="Start writing... Press Ctrl+M to insert math"
          />
        </div>

        {/* Output Preview */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">HTML Output</h3>
          <div className="p-4 bg-muted rounded-md overflow-auto max-h-48">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {html || '(empty)'}
            </pre>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+M</kbd> Insert math</div>
            <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+B</kbd> Bold</div>
            <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+I</kbd> Italic</div>
            <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+Z</kbd> Undo</div>
            <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+Y</kbd> Redo</div>
            <div><kbd className="px-2 py-1 bg-muted rounded">Escape</kbd> Close math editor</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Built with Tiptap 3 and peach-math-field
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
