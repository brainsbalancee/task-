/**
 * Parser for the Python-literal blobs embedded in the dataset.
 *
 * The export was produced by `str()`-ing Python objects into CSV cells, so
 * `skills`, `experience`, `education`, `emails`, ... are *not* JSON:
 *
 *   [{'company': {'name': 'pointbank'}, 'end_date': None, 'is_primary': False}]
 *
 * Single quotes, `None`/`True`/`False`, and `"..."` whenever the value itself
 * contains an apostrophe (`"bachelor's degree"`). `JSON.parse` cannot read any
 * of it, and regex-replacing quotes corrupts every apostrophe in the corpus —
 * so this is a real recursive-descent parser over the literal grammar.
 *
 * Supported: str, int, float, bool, None, list, tuple, dict.
 */

export type PyValue = string | number | boolean | null | PyValue[] | { [k: string]: PyValue };

class Reader {
  private i = 0;
  constructor(private readonly src: string) {}

  get pos(): number {
    return this.i;
  }

  peek(): string | undefined {
    return this.src[this.i];
  }

  next(): string | undefined {
    return this.src[this.i++];
  }

  eof(): boolean {
    return this.i >= this.src.length;
  }

  skipWhitespace(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i += 1;
  }

  /** Consumes `expected` or throws with the offending offset. */
  expect(expected: string): void {
    if (this.src[this.i] !== expected) {
      throw new SyntaxError(
        `Expected "${expected}" at offset ${this.i}, found "${this.src[this.i] ?? '<eof>'}"`,
      );
    }
    this.i += 1;
  }

  /** True when the upcoming characters match `word` as a whole token. */
  tryKeyword(word: string): boolean {
    if (this.src.startsWith(word, this.i)) {
      const after = this.src[this.i + word.length];
      if (after === undefined || !/[A-Za-z0-9_]/.test(after)) {
        this.i += word.length;
        return true;
      }
    }
    return false;
  }
}

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0',
  '\\': '\\',
  "'": "'",
  '"': '"',
  '\n': '',
};

function parseString(r: Reader): string {
  const quote = r.next()!; // ' or "
  let out = '';
  while (true) {
    const ch = r.next();
    if (ch === undefined) throw new SyntaxError('Unterminated string literal');
    if (ch === quote) return out;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const esc = r.next();
    if (esc === undefined) throw new SyntaxError('Unterminated escape sequence');
    if (esc === 'x' || esc === 'u' || esc === 'U') {
      const width = esc === 'x' ? 2 : esc === 'u' ? 4 : 8;
      let hex = '';
      for (let k = 0; k < width; k += 1) hex += r.next() ?? '';
      const code = Number.parseInt(hex, 16);
      out += Number.isNaN(code) ? `\\${esc}${hex}` : String.fromCodePoint(code);
      continue;
    }
    out += ESCAPES[esc] ?? esc;
  }
}

function parseNumber(r: Reader): number {
  let raw = '';
  while (!r.eof() && /[-+0-9.eE]/.test(r.peek()!)) raw += r.next();
  const n = Number(raw);
  if (Number.isNaN(n)) throw new SyntaxError(`Invalid number literal "${raw}"`);
  return n;
}

function parseSequence(r: Reader, close: ']' | ')'): PyValue[] {
  r.next(); // consume opener
  const out: PyValue[] = [];
  r.skipWhitespace();
  if (r.peek() === close) {
    r.next();
    return out;
  }
  while (true) {
    out.push(parseValue(r));
    r.skipWhitespace();
    const ch = r.next();
    if (ch === close) return out;
    if (ch !== ',') throw new SyntaxError(`Expected "," or "${close}" at offset ${r.pos - 1}`);
    r.skipWhitespace();
    // Tolerate a trailing comma: `('a',)`
    if (r.peek() === close) {
      r.next();
      return out;
    }
  }
}

function parseDict(r: Reader): { [k: string]: PyValue } {
  r.expect('{');
  const out: { [k: string]: PyValue } = {};
  r.skipWhitespace();
  if (r.peek() === '}') {
    r.next();
    return out;
  }
  while (true) {
    r.skipWhitespace();
    const key = parseValue(r);
    r.skipWhitespace();
    r.expect(':');
    r.skipWhitespace();
    out[String(key)] = parseValue(r);
    r.skipWhitespace();
    const ch = r.next();
    if (ch === '}') return out;
    if (ch !== ',') throw new SyntaxError(`Expected "," or "}" at offset ${r.pos - 1}`);
    r.skipWhitespace();
    if (r.peek() === '}') {
      r.next();
      return out;
    }
  }
}

function parseValue(r: Reader): PyValue {
  r.skipWhitespace();
  const ch = r.peek();
  if (ch === undefined) throw new SyntaxError('Unexpected end of input');
  if (ch === "'" || ch === '"') return parseString(r);
  if (ch === '[') return parseSequence(r, ']');
  if (ch === '(') return parseSequence(r, ')');
  if (ch === '{') return parseDict(r);
  if (r.tryKeyword('None')) return null;
  if (r.tryKeyword('True')) return true;
  if (r.tryKeyword('False')) return false;
  if (r.tryKeyword('nan') || r.tryKeyword('NaN')) return null;
  if (/[-+0-9.]/.test(ch)) return parseNumber(r);
  throw new SyntaxError(`Unexpected character "${ch}" at offset ${r.pos}`);
}

/** Parses a Python literal. Throws `SyntaxError` on malformed input. */
export function parsePythonLiteral(src: string): PyValue {
  const r = new Reader(src);
  const value = parseValue(r);
  r.skipWhitespace();
  if (!r.eof()) throw new SyntaxError(`Trailing content at offset ${r.pos}`);
  return value;
}

/**
 * Lenient entry point used by the ETL: empty/blank cells become `fallback`,
 * and a malformed cell is reported to `onError` rather than aborting the whole
 * 336-row ingest over one bad record.
 */
export function parseLiteralOr<T extends PyValue>(
  src: string | undefined | null,
  fallback: T,
  onError?: (err: Error) => void,
): PyValue | T {
  const trimmed = (src ?? '').trim();
  if (trimmed === '' || trimmed === 'None' || trimmed === 'nan') return fallback;
  try {
    return parsePythonLiteral(trimmed);
  } catch (err) {
    onError?.(err as Error);
    return fallback;
  }
}
