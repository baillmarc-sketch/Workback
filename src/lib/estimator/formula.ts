/**
 * Safe arithmetic evaluator for cost cells. A cell lets you type a small
 * expression like "2*15000+500" and stores the evaluated total. We never use
 * eval/Function — input is tokenized, converted to RPN with the shunting-yard
 * algorithm, then evaluated on a stack. Only numbers and + - * / ( ) % are
 * allowed, so shared estimates can't smuggle code into a viewer's browser.
 *
 * Percent follows spreadsheet semantics: "n%" is n/100 (so 15000*10% = 1500),
 * but as the right side of + or - it's relative to the left operand, so
 * 15000+10% = 16500 (a 10% markup) and 15000-10% = 13500 (a 10% discount).
 */

export interface EvalResult {
  ok: boolean;
  value?: number;
  error?: string;
}

const ALLOWED = /^[0-9.+\-*/()%\s]*$/;

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "u-" | "pct" }
  | { t: "lparen" }
  | { t: "rparen" };

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3, pct: 4 };

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  // An operator is "expected next" at the start, after another operator, or
  // after "(" — that's where a "-" means unary negation rather than subtract.
  let expectOperand = true;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      let dots = 0;
      while (j < expr.length && ((expr[j] >= "0" && expr[j] <= "9") || expr[j] === ".")) {
        if (expr[j] === ".") dots++;
        j++;
      }
      if (dots > 1) return null; // "1.2.3"
      const num = Number(expr.slice(i, j));
      if (!Number.isFinite(num)) return null;
      tokens.push({ t: "num", v: num });
      expectOperand = false;
      i = j;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lparen" });
      expectOperand = true;
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rparen" });
      expectOperand = false;
      i++;
      continue;
    }
    if (c === "%") {
      if (expectOperand) return null; // "%" must follow a value or ")"
      tokens.push({ t: "op", v: "pct" });
      // result of n% is still an operand (e.g. "10%*5" is valid, "10%5" is not)
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      if (expectOperand) {
        // Leading/standalone sign: treat unary "-" as negation, drop unary "+".
        if (c === "-") tokens.push({ t: "op", v: "u-" });
        else if (c === "+") {
          /* unary plus is a no-op */
        } else return null; // a binary * or / can't open an operand
      } else {
        tokens.push({ t: "op", v: c });
        expectOperand = true;
      }
      i++;
      continue;
    }
    return null; // unreachable given ALLOWED, but keeps the parser total
  }
  return tokens;
}

function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const ops: Token[] = [];
  for (const tok of tokens) {
    if (tok.t === "num") {
      output.push(tok);
    } else if (tok.t === "op" && tok.v === "pct") {
      // Postfix: binds tightest to the operand just emitted.
      output.push(tok);
    } else if (tok.t === "op") {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === "op") {
          const higher = PRECEDENCE[top.v] > PRECEDENCE[tok.v];
          // Left-associative binary ops also pop on equal precedence; unary "-"
          // is right-associative so it doesn't pop an equal-precedence unary.
          const equalLeft = PRECEDENCE[top.v] === PRECEDENCE[tok.v] && tok.v !== "u-";
          if (higher || equalLeft) {
            output.push(ops.pop()!);
            continue;
          }
        }
        break;
      }
      ops.push(tok);
    } else if (tok.t === "lparen") {
      ops.push(tok);
    } else {
      // rparen: drain to the matching lparen
      let matched = false;
      while (ops.length) {
        const top = ops.pop()!;
        if (top.t === "lparen") {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) return null; // unbalanced ")"
    }
  }
  while (ops.length) {
    const top = ops.pop()!;
    if (top.t === "lparen") return null; // unbalanced "("
    output.push(top);
  }
  return output;
}

// Stack values carry a `pct` flag so + / - can treat a percent operand as
// relative to the left operand (spreadsheet semantics).
interface Val {
  v: number;
  pct: boolean;
}

function evalRpn(rpn: Token[]): number | null {
  const stack: Val[] = [];
  for (const tok of rpn) {
    if (tok.t === "num") {
      stack.push({ v: tok.v, pct: false });
      continue;
    }
    if (tok.t !== "op") return null;
    if (tok.v === "pct") {
      if (stack.length < 1) return null;
      const x = stack.pop()!;
      stack.push({ v: x.v / 100, pct: true });
      continue;
    }
    if (tok.v === "u-") {
      if (stack.length < 1) return null;
      const x = stack.pop()!;
      stack.push({ v: -x.v, pct: x.pct });
      continue;
    }
    if (stack.length < 2) return null;
    const b = stack.pop()!;
    const a = stack.pop()!;
    let r: number;
    switch (tok.v) {
      case "+":
        r = b.pct ? a.v + a.v * b.v : a.v + b.v; // a + 10%  ->  a * 1.10
        break;
      case "-":
        r = b.pct ? a.v - a.v * b.v : a.v - b.v; // a - 10%  ->  a * 0.90
        break;
      case "*":
        r = a.v * b.v; // b already /100 for percents (15000 * 10% = 1500)
        break;
      case "/":
        if (b.v === 0) return null; // division by zero
        r = a.v / b.v;
        break;
      default:
        return null;
    }
    stack.push({ v: r, pct: false });
  }
  if (stack.length !== 1) return null;
  return stack[0].v;
}

/** Evaluate an arithmetic expression. Blank input is a valid $0 cell. */
export function evalExpr(expr: string): EvalResult {
  const trimmed = expr.trim();
  if (trimmed === "") return { ok: true, value: 0 };
  if (!ALLOWED.test(trimmed)) return { ok: false, error: "Only numbers and + - * / ( ) % are allowed" };
  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return { ok: false, error: "Could not read that expression" };
  const rpn = toRpn(tokens);
  if (!rpn) return { ok: false, error: "Mismatched parentheses" };
  const value = evalRpn(rpn);
  if (value === null || !Number.isFinite(value)) return { ok: false, error: "That doesn't compute" };
  return { ok: true, value };
}

/** Evaluate, returning 0 for anything invalid — for batch recompute on load. */
export function evalOrZero(expr: string): number {
  const r = evalExpr(expr);
  return r.ok && r.value !== undefined ? r.value : 0;
}

export interface RangeResult {
  ok: boolean;
  lowExpr?: string;
  low?: number;
  highExpr?: string;
  high?: number;
  error?: string;
}

/**
 * Parse a ballpark range cell. Accepts "low – high", "low to high", "low..high",
 * or "low-high"; a single expression becomes low == high. In a range column a
 * "-" means the range separator, not subtraction. low/high are normalized so
 * low <= high.
 */
export function parseRange(input: string): RangeResult {
  const s = input.trim();
  if (s === "") return { ok: true };
  const m = s.match(/^(.+?)\s*(?:–|\.\.|\bto\b|-)\s*(.+)$/i);
  if (!m) {
    const r = evalExpr(s);
    return r.ok ? { ok: true, lowExpr: s, low: r.value, highExpr: s, high: r.value } : { ok: false, error: r.error };
  }
  const lo = evalExpr(m[1]);
  if (!lo.ok) return { ok: false, error: lo.error };
  const hi = evalExpr(m[2]);
  if (!hi.ok) return { ok: false, error: hi.error };
  let low = lo.value ?? 0;
  let high = hi.value ?? 0;
  let lowExpr = m[1].trim();
  let highExpr = m[2].trim();
  if (low > high) {
    [low, high] = [high, low];
    [lowExpr, highExpr] = [highExpr, lowExpr];
  }
  return { ok: true, lowExpr, low, highExpr, high };
}
