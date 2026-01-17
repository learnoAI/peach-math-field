/**
 * KaTeX Renderer
 *
 * Renders LaTeX strings to HTML using KaTeX.
 * Provides both string output (for SSR) and DOM rendering.
 */

import katex from 'katex';
import type { KatexOptions } from 'katex';

// =============================================================================
// Types
// =============================================================================

export interface RenderOptions {
  /** Display mode (block) vs inline mode */
  displayMode?: boolean;
  /** Custom error handler - return HTML string or null to use default */
  onError?: (error: Error, latex: string) => string | null;
  /** Whether to throw on parse errors (default: false) */
  throwOnError?: boolean;
  /** Color for error text */
  errorColor?: string;
  /** Custom macros */
  macros?: Record<string, string>;
  /** Minimum rule thickness (for fractions, etc.) */
  minRuleThickness?: number;
  /** Trust untrusted input (allow \includegraphics, etc.) */
  trust?: boolean;
}

export interface RenderResult {
  html: string;
  error?: Error;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: RenderOptions = {
  displayMode: false,
  throwOnError: false,
  errorColor: '#dc2626', // Tailwind red-600, matches --destructive
  trust: false,
};

// =============================================================================
// Renderer Functions
// =============================================================================

/**
 * Convert RenderOptions to KaTeX options
 */
function toKatexOptions(options: RenderOptions): KatexOptions {
  return {
    displayMode: options.displayMode ?? false,
    throwOnError: options.throwOnError ?? false,
    errorColor: options.errorColor ?? '#dc2626',
    macros: options.macros,
    minRuleThickness: options.minRuleThickness,
    trust: options.trust ?? false,
    output: 'htmlAndMathml', // Best for accessibility
  };
}

/**
 * Render LaTeX to an HTML string
 * Safe for SSR - returns string only
 */
export function renderToString(latex: string, options: RenderOptions = {}): RenderResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const katexOptions = toKatexOptions(mergedOptions);

  try {
    const html = katex.renderToString(latex, katexOptions);
    return { html };
  } catch (error) {
    const err = error as Error;

    // Custom error handler
    if (mergedOptions.onError) {
      const customHtml = mergedOptions.onError(err, latex);
      if (customHtml !== null) {
        return { html: customHtml, error: err };
      }
    }

    // Throw if requested
    if (mergedOptions.throwOnError) {
      throw err;
    }

    // Default error rendering
    const escapedMessage = escapeHtml(err.message);
    const escapedLatex = escapeHtml(latex);
    const color = mergedOptions.errorColor ?? '#dc2626';

    const html = `<span class="katex-error" style="color: ${color}" title="${escapedMessage}">${escapedLatex}</span>`;
    return { html, error: err };
  }
}

/**
 * Render LaTeX directly to a DOM element
 * Only for client-side use
 */
export function renderToElement(
  latex: string,
  element: HTMLElement,
  options: RenderOptions = {}
): RenderResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const katexOptions = toKatexOptions(mergedOptions);

  try {
    katex.render(latex, element, katexOptions);
    return { html: element.innerHTML };
  } catch (error) {
    const err = error as Error;

    // Custom error handler
    if (mergedOptions.onError) {
      const customHtml = mergedOptions.onError(err, latex);
      if (customHtml !== null) {
        element.innerHTML = customHtml;
        return { html: customHtml, error: err };
      }
    }

    // Throw if requested
    if (mergedOptions.throwOnError) {
      throw err;
    }

    // Default error rendering
    const escapedMessage = escapeHtml(err.message);
    const escapedLatex = escapeHtml(latex);
    const color = mergedOptions.errorColor ?? '#dc2626';

    const html = `<span class="katex-error" style="color: ${color}" title="${escapedMessage}">${escapedLatex}</span>`;
    element.innerHTML = html;
    return { html, error: err };
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if KaTeX can parse the given LaTeX (without rendering)
 */
export function validateLatex(latex: string): { valid: boolean; error?: string } {
  try {
    katex.renderToString(latex, { throwOnError: true });
    return { valid: true };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

/**
 * Pre-defined macros for common shortcuts
 */
export const commonMacros: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\eps': '\\varepsilon',
  '\\phi': '\\varphi',
};
