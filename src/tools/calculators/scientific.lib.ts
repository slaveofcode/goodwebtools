/**
 * A small, safe arithmetic expression evaluator (no `eval`). Supports + - * / ^,
 * parentheses, unary minus, constants (pi, e) and functions (sin, cos, tan,
 * asin, acos, atan, ln, log, sqrt, abs, exp). Trig respects an angle mode.
 *
 * Pipeline: tokenize → shunting-yard to RPN → evaluate RPN.
 */

export type AngleMode = 'deg' | 'rad';

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
};
const TRIG = new Set(['sin', 'cos', 'tan']);
const INV_TRIG = new Set(['asin', 'acos', 'atan']);

type TokType = 'num' | 'op' | 'func' | 'const' | 'lparen' | 'rparen';
interface Tok { type: TokType; value: string }

const PREC: Record<string, number> = { '+': 2, '-': 2, '*': 3, '/': 3, '^': 4, neg: 5 };
const RIGHT_ASSOC = new Set(['^', 'neg']);

function tokenize(expr: string): Tok[] {
  const s = expr.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      // Scientific notation: 1e3, 2.5e-4
      if (s[j] === 'e' && /[0-9.+-]/.test(s[j + 1] ?? '')) {
        j++;
        if (s[j] === '+' || s[j] === '-') j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      toks.push({ type: 'num', value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
      const name = s.slice(i, j).toLowerCase();
      if (name in FUNCTIONS) toks.push({ type: 'func', value: name });
      else if (name in CONSTANTS) toks.push({ type: 'const', value: name });
      else throw new Error(`Unknown name: ${name}`);
      i = j;
      continue;
    }
    if ('+-*/^'.includes(c)) { toks.push({ type: 'op', value: c }); i++; continue; }
    if (c === '(') { toks.push({ type: 'lparen', value: c }); i++; continue; }
    if (c === ')') { toks.push({ type: 'rparen', value: c }); i++; continue; }
    throw new Error(`Unexpected character: ${c}`);
  }
  return toks;
}

function toRpn(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  const stack: Tok[] = [];
  let prev: Tok | null = null;
  for (const tok of toks) {
    if (tok.type === 'num' || tok.type === 'const') {
      out.push(tok);
    } else if (tok.type === 'func') {
      stack.push(tok);
    } else if (tok.type === 'op') {
      const unary = (tok.value === '-' || tok.value === '+')
        && (prev === null || prev.type === 'op' || prev.type === 'lparen');
      if (unary) {
        if (tok.value === '-') stack.push({ type: 'op', value: 'neg' });
        // unary '+' is a no-op
      } else {
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type !== 'op') break;
          const p = PREC[top.value], q = PREC[tok.value];
          if (p > q || (p === q && !RIGHT_ASSOC.has(tok.value))) out.push(stack.pop()!);
          else break;
        }
        stack.push(tok);
      }
    } else if (tok.type === 'lparen') {
      stack.push(tok);
    } else {
      // rparen
      while (stack.length && stack[stack.length - 1].type !== 'lparen') out.push(stack.pop()!);
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop(); // discard the '('
      if (stack.length && stack[stack.length - 1].type === 'func') out.push(stack.pop()!);
    }
    prev = tok;
  }
  while (stack.length) {
    const t = stack.pop()!;
    if (t.type === 'lparen') throw new Error('Mismatched parentheses');
    out.push(t);
  }
  return out;
}

function applyOp(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '^': return Math.pow(a, b);
    default: throw new Error(`Unknown operator: ${op}`);
  }
}

function evalRpn(rpn: Tok[], angle: AngleMode): number {
  const st: number[] = [];
  for (const tok of rpn) {
    if (tok.type === 'num') {
      const n = Number(tok.value);
      if (Number.isNaN(n)) throw new Error(`Invalid number: ${tok.value}`);
      st.push(n);
    } else if (tok.type === 'const') {
      st.push(CONSTANTS[tok.value]);
    } else if (tok.type === 'func') {
      const a = st.pop();
      if (a === undefined) throw new Error('Missing function argument');
      const x = angle === 'deg' && TRIG.has(tok.value) ? (a * Math.PI) / 180 : a;
      let r = FUNCTIONS[tok.value](x);
      if (angle === 'deg' && INV_TRIG.has(tok.value)) r = (r * 180) / Math.PI;
      st.push(r);
    } else if (tok.value === 'neg') {
      const a = st.pop();
      if (a === undefined) throw new Error('Missing operand');
      st.push(-a);
    } else {
      const b = st.pop(), a = st.pop();
      if (a === undefined || b === undefined) throw new Error('Missing operand');
      st.push(applyOp(tok.value, a, b));
    }
  }
  if (st.length !== 1) throw new Error('Invalid expression');
  return st[0];
}

/** Evaluate an arithmetic expression. Throws on malformed input. */
export function evaluate(expr: string, angle: AngleMode = 'rad'): number {
  if (!expr.trim()) throw new Error('Empty expression');
  const result = evalRpn(toRpn(tokenize(expr)), angle);
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number');
  return result;
}
