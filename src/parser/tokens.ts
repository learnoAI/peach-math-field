/**
 * LaTeX Tokenizer
 *
 * Breaks a LaTeX string into tokens for the parser.
 * Handles commands, groups, special characters, and whitespace.
 */

// =============================================================================
// Token Types
// =============================================================================

export type TokenType =
  | 'command' // \frac, \sqrt, \alpha, etc.
  | 'text' // Regular text/letters
  | 'number' // Digits
  | 'operator' // +, -, =, etc.
  | 'superscript' // ^
  | 'subscript' // _
  | 'openBrace' // {
  | 'closeBrace' // }
  | 'openBracket' // [
  | 'closeBracket' // ]
  | 'openParen' // (
  | 'closeParen' // )
  | 'pipe' // |
  | 'ampersand' // &
  | 'newline' // \\
  | 'whitespace' // spaces (usually ignored)
  | 'eof'; // End of input

export interface Token {
  type: TokenType;
  value: string;
  position: number; // Start position in source
}

// =============================================================================
// Tokenizer Class
// =============================================================================

export class Tokenizer {
  private source: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire source string
   */
  tokenize(): Token[] {
    this.position = 0;
    this.tokens = [];

    while (this.position < this.source.length) {
      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    // Add EOF token
    this.tokens.push({ type: 'eof', value: '', position: this.position });

    return this.tokens;
  }

  private nextToken(): Token | null {
    const start = this.position;
    const char = this.source[this.position];

    // Whitespace
    if (/\s/.test(char)) {
      return this.readWhitespace(start);
    }

    // Command (starts with \)
    if (char === '\\') {
      return this.readCommand(start);
    }

    // Number
    if (/[0-9]/.test(char)) {
      return this.readNumber(start);
    }

    // Special characters
    switch (char) {
      case '{':
        this.position++;
        return { type: 'openBrace', value: '{', position: start };
      case '}':
        this.position++;
        return { type: 'closeBrace', value: '}', position: start };
      case '[':
        this.position++;
        return { type: 'openBracket', value: '[', position: start };
      case ']':
        this.position++;
        return { type: 'closeBracket', value: ']', position: start };
      case '(':
        this.position++;
        return { type: 'openParen', value: '(', position: start };
      case ')':
        this.position++;
        return { type: 'closeParen', value: ')', position: start };
      case '^':
        this.position++;
        return { type: 'superscript', value: '^', position: start };
      case '_':
        this.position++;
        return { type: 'subscript', value: '_', position: start };
      case '&':
        this.position++;
        return { type: 'ampersand', value: '&', position: start };
      case '|':
        this.position++;
        return { type: 'pipe', value: '|', position: start };
      case '+':
      case '-':
      case '=':
      case '<':
      case '>':
      case '*':
      case '/':
      case '!':
      case '\'':
      case ',':
      case '.':
      case ':':
      case ';':
        this.position++;
        return { type: 'operator', value: char, position: start };
    }

    // Letters (single character in math mode)
    if (/[a-zA-Z]/.test(char)) {
      this.position++;
      return { type: 'text', value: char, position: start };
    }

    // Unknown character - treat as text
    this.position++;
    return { type: 'text', value: char, position: start };
  }

  private readWhitespace(start: number): Token {
    while (this.position < this.source.length && /\s/.test(this.source[this.position])) {
      this.position++;
    }
    return { type: 'whitespace', value: this.source.slice(start, this.position), position: start };
  }

  private readCommand(start: number): Token {
    // Skip the backslash
    this.position++;

    // Check for special two-character commands
    if (this.position < this.source.length) {
      const nextChar = this.source[this.position];

      // \\ is newline
      if (nextChar === '\\') {
        this.position++;
        return { type: 'newline', value: '\\\\', position: start };
      }

      // Single non-letter commands: \, \; \: \! \{ \} \| \  (backslash space)
      if (!/[a-zA-Z]/.test(nextChar)) {
        this.position++;
        return { type: 'command', value: '\\' + nextChar, position: start };
      }
    }

    // Read alphabetic command name
    const cmdStart = this.position;
    while (this.position < this.source.length && /[a-zA-Z]/.test(this.source[this.position])) {
      this.position++;
    }

    const cmdName = this.source.slice(cmdStart, this.position);
    return { type: 'command', value: '\\' + cmdName, position: start };
  }

  private readNumber(start: number): Token {
    while (this.position < this.source.length && /[0-9.]/.test(this.source[this.position])) {
      this.position++;
    }
    return { type: 'number', value: this.source.slice(start, this.position), position: start };
  }
}

// =============================================================================
// Convenience Function
// =============================================================================

export function tokenize(source: string): Token[] {
  return new Tokenizer(source).tokenize();
}

// =============================================================================
// Token Stream (for parser consumption)
// =============================================================================

export class TokenStream {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Get current token without advancing
   */
  peek(): Token {
    return this.tokens[this.position] ?? { type: 'eof', value: '', position: -1 };
  }

  /**
   * Look ahead n tokens
   */
  peekAt(offset: number): Token {
    return this.tokens[this.position + offset] ?? { type: 'eof', value: '', position: -1 };
  }

  /**
   * Get current token and advance
   */
  next(): Token {
    const token = this.peek();
    this.position++;
    return token;
  }

  /**
   * Check if current token matches type
   */
  is(type: TokenType): boolean {
    return this.peek().type === type;
  }

  /**
   * Check if current token matches type and value
   */
  isValue(type: TokenType, value: string): boolean {
    const t = this.peek();
    return t.type === type && t.value === value;
  }

  /**
   * Consume token if it matches, throw if not
   */
  expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type} at position ${token.position}`);
    }
    return this.next();
  }

  /**
   * Consume token if it matches type and value
   */
  expectValue(type: TokenType, value: string): Token {
    const token = this.peek();
    if (token.type !== type || token.value !== value) {
      throw new Error(`Expected ${type}:${value}, got ${token.type}:${token.value} at position ${token.position}`);
    }
    return this.next();
  }

  /**
   * Try to consume token if it matches, return null if not
   */
  tryConsume(type: TokenType): Token | null {
    if (this.is(type)) {
      return this.next();
    }
    return null;
  }

  /**
   * Try to consume token if it matches type and value
   */
  tryConsumeValue(type: TokenType, value: string): Token | null {
    if (this.isValue(type, value)) {
      return this.next();
    }
    return null;
  }

  /**
   * Skip whitespace tokens
   */
  skipWhitespace(): void {
    while (this.is('whitespace')) {
      this.next();
    }
  }

  /**
   * Check if at end of input
   */
  isEof(): boolean {
    return this.is('eof');
  }

  /**
   * Get current position for error reporting
   */
  getPosition(): number {
    return this.peek().position;
  }
}
