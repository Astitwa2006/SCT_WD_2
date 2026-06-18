/* ============================================================
   SCT_WD_2 — Calculator  |  SkillCraft Technology
   script.js
   ============================================================ */

'use strict';

/* ── DOM References ── */
const expressionLine = document.getElementById('expression-line');
const resultLine     = document.getElementById('result-line');
const btnGrid        = document.getElementById('btn-grid');
const calculator     = document.getElementById('calculator');

/* ── State ── */
const state = {
  expression:      '',   // full expression string shown in display
  currentNum:      '0',  // number being typed right now
  prevNum:         null, // previous operand (string)
  operator:        null, // active operator symbol: +, −, ×, ÷
  waitingOperand:  false,// true after an operator is pressed → next digit replaces currentNum
  justEvaluated:   false,// true right after = is pressed
  hasDecimal:      false,// is there already a '.' in currentNum?
};

/* ── Operator Map (symbol → JS operator for eval) ── */
const OP_MAP = { '+': '+', '−': '-', '×': '*', '÷': '/' };
const OP_DISPLAY = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/* ═══════════════════════════════════════
   DISPLAY UTILITIES
═══════════════════════════════════════ */

/**
 * Format a number string for clean display (remove trailing zeros, limit decimals).
 */
function formatNum(numStr) {
  if (numStr === 'Error' || numStr === 'Infinity' || numStr === '-Infinity') return numStr;
  const n = parseFloat(numStr);
  if (isNaN(n)) return numStr;
  // Limit to 12 significant digits to prevent overflow
  let formatted = parseFloat(n.toPrecision(12)).toString();
  return formatted;
}

/**
 * Shrink the expression-line font if text is long.
 */
function scaleFontToFit(text) {
  const len = text.length;
  if (len <= 9) {
    expressionLine.style.fontSize = '';
  } else if (len <= 13) {
    expressionLine.style.fontSize = 'clamp(1.3rem, 4vw, 1.75rem)';
  } else if (len <= 18) {
    expressionLine.style.fontSize = 'clamp(1.05rem, 3.2vw, 1.3rem)';
  } else {
    expressionLine.style.fontSize = 'clamp(0.85rem, 2.6vw, 1rem)';
  }
}

/**
 * Build the expression string for the display top line.
 */
function buildDisplayExpression() {
  if (state.justEvaluated && state.expression) {
    // Show full resolved expression when = was just pressed
    return state.expression;
  }
  if (state.operator && !state.waitingOperand) {
    // mid-entry: show prevNum op currentNum
    return `${formatNum(state.prevNum)} ${state.operator} ${state.currentNum}`;
  }
  if (state.operator && state.waitingOperand) {
    // just pressed operator, waiting for next digit
    return `${formatNum(state.prevNum)} ${state.operator}`;
  }
  return state.currentNum;
}

/**
 * Render the display from current state.
 */
function render(popAnim = false) {
  const displayText = buildDisplayExpression();
  scaleFontToFit(displayText);

  expressionLine.textContent = displayText;

  if (popAnim) {
    expressionLine.classList.remove('pop');
    // Force reflow to restart animation
    void expressionLine.offsetWidth;
    expressionLine.classList.add('pop');
  }

  // Live preview result line
  const preview = computePreview();
  if (preview !== null && !state.waitingOperand && !state.justEvaluated) {
    resultLine.textContent = `= ${preview}`;
    resultLine.classList.toggle('error', preview === 'Error');
  } else {
    resultLine.textContent = '';
    resultLine.classList.remove('error');
  }

  // Clear / restore error state on calculator card
  calculator.classList.toggle('error-state', displayText === 'Error');
}

/* ═══════════════════════════════════════
   COMPUTATION
═══════════════════════════════════════ */

/**
 * Perform arithmetic on two number strings with a given operator symbol.
 * Returns result string, or 'Error'.
 */
function compute(a, op, b) {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (isNaN(numA) || isNaN(numB)) return 'Error';

  let result;
  switch (op) {
    case '+': result = numA + numB;  break;
    case '−': result = numA - numB;  break;
    case '×': result = numA * numB;  break;
    case '÷':
      if (numB === 0) return 'Error'; // Division by zero
      result = numA / numB;
      break;
    default:  return 'Error';
  }

  if (!isFinite(result)) return 'Error';

  // Limit floating-point noise
  return formatNum(result.toString());
}

/**
 * Compute a live preview (shown in small text under expression).
 * Returns formatted string or null.
 */
function computePreview() {
  if (!state.operator || state.waitingOperand) return null;
  if (!state.prevNum) return null;
  const result = compute(state.prevNum, state.operator, state.currentNum);
  if (result === 'Error') return null;
  return result;
}

/* ═══════════════════════════════════════
   CALCULATOR ACTIONS
═══════════════════════════════════════ */

function actionDigit(digit) {
  // After = pressed, start fresh unless operator immediately follows
  if (state.justEvaluated) {
    resetState();
    state.justEvaluated = false;
  }

  if (state.waitingOperand) {
    // Replace the pending slot
    state.currentNum  = digit;
    state.waitingOperand = false;
    state.hasDecimal  = false;
  } else {
    if (state.currentNum === '0' && digit !== '.') {
      state.currentNum = digit;
    } else {
      // Limit digit input length
      if (state.currentNum.replace('-', '').replace('.', '').length >= 14) return;
      state.currentNum += digit;
    }
  }
  render(true);
}

function actionDecimal() {
  if (state.justEvaluated) {
    resetState();
    state.justEvaluated = false;
  }
  if (state.waitingOperand) {
    state.currentNum     = '0.';
    state.waitingOperand = false;
    state.hasDecimal     = true;
    render(true);
    return;
  }
  if (state.hasDecimal) return; // already has decimal
  state.currentNum += '.';
  state.hasDecimal  = true;
  render(true);
}

function actionOperator(opSymbol) {
  // If there's a pending chained operation, evaluate it first
  if (state.operator && !state.waitingOperand) {
    const result = compute(state.prevNum, state.operator, state.currentNum);
    if (result === 'Error') {
      showError();
      return;
    }
    state.currentNum = result;
  }

  state.prevNum        = state.currentNum;
  state.operator       = opSymbol;
  state.waitingOperand = true;
  state.hasDecimal     = false;
  state.justEvaluated  = false;
  state.expression     = '';

  highlightOperatorButton(opSymbol);
  render();
}

function actionEquals() {
  if (!state.operator || !state.prevNum) {
    // Nothing to evaluate — flash the display
    flashDisplay();
    return;
  }

  const a = state.prevNum;
  const op = state.operator;
  const b = state.waitingOperand ? state.prevNum : state.currentNum;

  const result = compute(a, op, b);

  // Build a human-readable full expression for the display
  const bDisplay = state.waitingOperand ? formatNum(a) : state.currentNum;
  state.expression = `${formatNum(a)} ${op} ${bDisplay} =`;

  if (result === 'Error') {
    showError();
    return;
  }

  state.currentNum     = result;
  state.prevNum        = null;
  state.operator       = null;
  state.waitingOperand = false;
  state.hasDecimal     = result.includes('.');
  state.justEvaluated  = true;

  clearOperatorHighlight();
  render(true);
}

function actionClear() {
  resetState();
  render(true);
}

function actionBackspace() {
  if (state.justEvaluated || state.waitingOperand) {
    // After = or right after operator: clear current number
    state.currentNum     = '0';
    state.waitingOperand = false;
    state.hasDecimal     = false;
    state.justEvaluated  = false;
    render(true);
    return;
  }

  if (state.currentNum.length === 1 ||
      (state.currentNum.length === 2 && state.currentNum.startsWith('-'))) {
    state.currentNum = '0';
    state.hasDecimal = false;
  } else {
    const removed = state.currentNum.slice(-1);
    if (removed === '.') state.hasDecimal = false;
    state.currentNum = state.currentNum.slice(0, -1);
  }
  render(true);
}

function actionToggleSign() {
  if (state.currentNum === '0' || state.currentNum === 'Error') return;
  if (state.justEvaluated) {
    state.expression    = '';
    state.justEvaluated = false;
  }
  if (state.currentNum.startsWith('-')) {
    state.currentNum = state.currentNum.slice(1);
  } else {
    state.currentNum = '-' + state.currentNum;
  }
  render(true);
}

function actionPercent() {
  if (state.currentNum === 'Error') return;
  const n = parseFloat(state.currentNum);
  if (isNaN(n)) return;
  const result = formatNum((n / 100).toString());
  state.currentNum = result;
  state.hasDecimal = result.includes('.');
  if (state.justEvaluated) {
    state.expression    = '';
    state.justEvaluated = false;
  }
  render(true);
}

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */

function resetState() {
  state.expression     = '';
  state.currentNum     = '0';
  state.prevNum        = null;
  state.operator       = null;
  state.waitingOperand = false;
  state.justEvaluated  = false;
  state.hasDecimal     = false;
  clearOperatorHighlight();
}

function showError() {
  state.expression     = '';
  state.currentNum     = 'Error';
  state.prevNum        = null;
  state.operator       = null;
  state.waitingOperand = false;
  state.justEvaluated  = false;
  state.hasDecimal     = false;
  resultLine.textContent = '';
  expressionLine.textContent = 'Error';
  calculator.classList.add('error-state');
  clearOperatorHighlight();
  setTimeout(() => calculator.classList.remove('error-state'), 700);
}

function flashDisplay() {
  expressionLine.style.opacity = '0.3';
  setTimeout(() => { expressionLine.style.opacity = ''; }, 160);
}

function highlightOperatorButton(opSymbol) {
  clearOperatorHighlight();
  document.querySelectorAll('.btn-op').forEach(btn => {
    if (btn.dataset.value === opSymbol) {
      btn.classList.add('active-op');
    }
  });
}

function clearOperatorHighlight() {
  document.querySelectorAll('.btn-op.active-op').forEach(btn => {
    btn.classList.remove('active-op');
  });
}

/* ═══════════════════════════════════════
   RIPPLE EFFECT
═══════════════════════════════════════ */

function triggerRipple(btn, event) {
  const rect = btn.getBoundingClientRect();
  let x, y;
  if (event instanceof MouseEvent) {
    x = ((event.clientX - rect.left) / rect.width)  * 100;
    y = ((event.clientY - rect.top)  / rect.height) * 100;
  } else {
    x = 50; y = 50; // keyboard / touch centre
  }
  btn.style.setProperty('--rx', `${x}%`);
  btn.style.setProperty('--ry', `${y}%`);
  btn.classList.add('ripple');
  setTimeout(() => btn.classList.remove('ripple'), 380);
}

/* ═══════════════════════════════════════
   EVENT LISTENERS — BUTTONS
═══════════════════════════════════════ */

btnGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  triggerRipple(btn, e);

  const action = btn.dataset.action;
  const value  = btn.dataset.value;

  switch (action) {
    case 'digit':     actionDigit(value);    break;
    case 'decimal':   actionDecimal();       break;
    case 'operator':  actionOperator(value); break;
    case 'equals':    actionEquals();        break;
    case 'clear':     actionClear();         break;
    case 'backspace': actionBackspace();     break;
    case 'toggle':    actionToggleSign();    break;
    case 'percent':   actionPercent();       break;
  }
});

/* ═══════════════════════════════════════
   EVENT LISTENERS — KEYBOARD
═══════════════════════════════════════ */

document.addEventListener('keydown', (e) => {
  // Prevent default for keys we handle (e.g. Backspace navigating back)
  const handled = [
    'Backspace', 'Escape', 'Enter', '=',
    '+', '-', '*', '/', '%',
    '0','1','2','3','4','5','6','7','8','9', '.'
  ].includes(e.key);

  if (!handled) return;
  e.preventDefault();

  // Find corresponding button to animate
  let btnEl = null;

  if (e.key >= '0' && e.key <= '9') {
    btnEl = document.getElementById(`btn-${e.key}`);
    actionDigit(e.key);

  } else if (e.key === '.') {
    btnEl = document.getElementById('btn-dot');
    actionDecimal();

  } else if (e.key === '+') {
    btnEl = document.getElementById('btn-add');
    actionOperator('+');

  } else if (e.key === '-') {
    btnEl = document.getElementById('btn-subtract');
    actionOperator('−');

  } else if (e.key === '*') {
    btnEl = document.getElementById('btn-multiply');
    actionOperator('×');

  } else if (e.key === '/') {
    btnEl = document.getElementById('btn-divide');
    actionOperator('÷');

  } else if (e.key === 'Enter' || e.key === '=') {
    btnEl = document.getElementById('btn-equals');
    actionEquals();

  } else if (e.key === 'Backspace') {
    btnEl = document.getElementById('btn-bksp');
    actionBackspace();

  } else if (e.key === 'Escape') {
    btnEl = document.getElementById('btn-ac');
    actionClear();

  } else if (e.key === '%') {
    btnEl = document.getElementById('btn-percent');
    actionPercent();
  }

  // Animate the corresponding button
  if (btnEl) {
    triggerRipple(btnEl, null);
    btnEl.classList.add('key-active');
    setTimeout(() => btnEl.classList.remove('key-active'), 160);
  }
});

/* key-active visual feedback (same as :active) */
const style = document.createElement('style');
style.textContent = `.key-active { transform: scale(0.94) !important; filter: brightness(1.2) !important; }`;
document.head.appendChild(style);

/* ═══════════════════════════════════════
   INITIALISE
═══════════════════════════════════════ */

render();
