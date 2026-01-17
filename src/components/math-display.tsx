/**
 * MathDisplay Component
 *
 * Read-only math renderer using KaTeX.
 * Supports both inline and block (display) mode.
 */

import * as React from 'react';
import { renderToString, type RenderOptions } from '../renderer/katex-renderer';

// =============================================================================
// Types
// =============================================================================

export interface MathDisplayProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onError'> {
  /** LaTeX string to render */
  latex: string;
  /** Display mode (centered, larger) vs inline mode */
  display?: boolean;
  /** Custom error handler for LaTeX parse errors */
  errorRenderer?: (error: Error, latex: string) => React.ReactNode;
  /** Whether to throw on parse errors */
  throwOnError?: boolean;
  /** Custom macros */
  macros?: Record<string, string>;
}

// =============================================================================
// Component
// =============================================================================

export const MathDisplay = React.memo(function MathDisplay({
  latex,
  display = false,
  errorRenderer,
  throwOnError = false,
  macros,
  className = '',
  ...props
}: MathDisplayProps) {
  const [error, setError] = React.useState<Error | null>(null);

  // Render options
  const renderOptions: RenderOptions = React.useMemo(
    () => ({
      displayMode: display,
      throwOnError,
      macros,
      onError: errorRenderer
        ? (err) => {
            setError(err);
            return null; // Let custom handler render
          }
        : undefined,
    }),
    [display, throwOnError, macros, errorRenderer]
  );

  // Render LaTeX to HTML string
  const result = React.useMemo(() => {
    setError(null);
    try {
      return renderToString(latex, renderOptions);
    } catch (err) {
      if (throwOnError) throw err;
      setError(err as Error);
      return { html: '', error: err as Error };
    }
  }, [latex, renderOptions, throwOnError]);

  // Custom error rendering
  if (error && errorRenderer) {
    return <>{errorRenderer(error, latex)}</>;
  }

  // Determine wrapper element and classes
  const baseClass = display ? 'math-display-block' : 'math-display-inline';
  const combinedClassName = `${baseClass} ${className}`.trim();

  if (display) {
    return (
      <div
        className={combinedClassName}
        dangerouslySetInnerHTML={{ __html: result.html }}
        role="math"
        aria-label={latex}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  }

  return (
    <span
      className={combinedClassName}
      dangerouslySetInnerHTML={{ __html: result.html }}
      role="math"
      aria-label={latex}
      {...props}
    />
  );
});

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * Inline math component (shorthand)
 */
export function InlineMath({
  children,
  ...props
}: Omit<MathDisplayProps, 'latex' | 'display'> & { children: string }) {
  return <MathDisplay latex={children} display={false} {...props} />;
}

/**
 * Block/display math component (shorthand)
 */
export function BlockMath({
  children,
  ...props
}: Omit<MathDisplayProps, 'latex' | 'display'> & { children: string }) {
  return <MathDisplay latex={children} display={true} {...props} />;
}
