import { useState, useRef } from 'react'
import { MathField, MathDisplay, MathFieldRef, MathKeyboard } from 'peach-math-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Moon, Sun, Divide, Radical, Superscript, Subscript, Parentheses, Undo, Redo, Keyboard, Grid3X3 } from 'lucide-react'

// Import peach-math-field styles (relative path for development)
import '../../../src/styles/math-field.css'

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [latex, setLatex] = useState('')
  const [showKeyboard, setShowKeyboard] = useState(false)
  const mathFieldRef = useRef<MathFieldRef>(null)

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const insertCommand = (command: string) => {
    mathFieldRef.current?.insertCommand(command)
    mathFieldRef.current?.focus()
  }

  return (
    <div className={`min-h-screen p-8 ${darkMode ? 'dark' : ''}`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">peach-math-field</h1>
            <p className="text-muted-foreground">
              A shadcn-native, highly customizable math editor
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Main Editor Card */}
        <Card>
          <CardHeader>
            <CardTitle>Math Editor</CardTitle>
            <CardDescription>
              Click the field and start typing. Use keyboard shortcuts or toolbar buttons to insert structures.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertCommand('fraction')}
                title="Fraction (press /)"
              >
                <Divide className="h-4 w-4 mr-1" />
                Fraction
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertCommand('sqrt')}
                title="Square root"
              >
                <Radical className="h-4 w-4 mr-1" />
                Root
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertCommand('superscript')}
                title="Superscript (press ^)"
              >
                <Superscript className="h-4 w-4 mr-1" />
                x^n
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertCommand('subscript')}
                title="Subscript (press _)"
              >
                <Subscript className="h-4 w-4 mr-1" />
                x_n
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertCommand('parens')}
                title="Parentheses (press ()"
              >
                <Parentheses className="h-4 w-4 mr-1" />
                ( )
              </Button>
              <div className="w-px h-8 bg-border mx-1" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => mathFieldRef.current?.undo()}
                title="Undo (Ctrl+Z)"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => mathFieldRef.current?.redo()}
                title="Redo (Ctrl+Y)"
              >
                <Redo className="h-4 w-4" />
              </Button>
              <div className="w-px h-8 bg-border mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => insertCommand('matrix:2x2:pmatrix')}
                title="Insert 2×2 matrix"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Matrix
              </Button>
              <div className="w-px h-8 bg-border mx-1" />
              <Button
                variant={showKeyboard ? "default" : "outline"}
                size="icon"
                onClick={() => setShowKeyboard(!showKeyboard)}
                title="Toggle virtual keyboard"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>

            {/* Math Field */}
            <MathField
              ref={mathFieldRef}
              value={latex}
              onChange={setLatex}
              placeholder="Type math here... (try: x^2 + y^2 = z^2)"
              className="w-full min-h-[60px]"
              autoFocus
            />

            {/* LaTeX Output */}
            <div className="p-3 bg-muted rounded-md font-mono text-sm">
              <span className="text-muted-foreground">LaTeX: </span>
              {latex || '(empty)'}
            </div>

            {/* Virtual Keyboard */}
            {showKeyboard && (
              <MathKeyboard
                mathFieldRef={mathFieldRef}
                visible={showKeyboard}
                onVisibilityChange={setShowKeyboard}
              />
            )}
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><kbd className="px-2 py-1 bg-muted rounded">/</kbd> Fraction</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">^</kbd> Superscript</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">_</kbd> Subscript</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">(</kbd> Parentheses</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">[</kbd> Brackets</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">{'{'}</kbd> Braces</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">*</kbd> Multiply (×)</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+Z</kbd> Undo</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+Y</kbd> Redo</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">←→</kbd> Navigate</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">↑↓</kbd> Navigate fractions/matrices</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Tab</kbd> Next placeholder</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Shift+Tab</kbd> Previous placeholder</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+C</kbd> Copy LaTeX</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+V</kbd> Paste</div>
              <div><kbd className="px-2 py-1 bg-muted rounded">Ctrl+A</kbd> Select all</div>
            </div>
          </CardContent>
        </Card>

        {/* Example Formulas */}
        <Card>
          <CardHeader>
            <CardTitle>Example Formulas (MathDisplay)</CardTitle>
            <CardDescription>
              Read-only math display using the same styling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-md text-center">
              <MathDisplay latex="E = mc^2" />
            </div>
            <div className="p-4 bg-muted rounded-md text-center">
              <MathDisplay latex="\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" displayMode />
            </div>
            <div className="p-4 bg-muted rounded-md text-center">
              <MathDisplay latex="\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}" displayMode />
            </div>
            <div className="p-4 bg-muted rounded-md text-center">
              <MathDisplay latex="\begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix} = \begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}" displayMode />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Built with shadcn/ui theming.{' '}
            <a href="#" className="underline">
              View source on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
