let nextQuestionChanceInputId = 1;

function normalizeMode(value) {
  return value === 'authored' ? 'authored' : 'chance';
}

function normalizeChance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.3;
  const clamped = Math.max(0, Math.min(1, numeric));
  return Math.round(clamped * 100) / 100;
}

function appendTextElement(document, parent, tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  parent.append(element);
  return element;
}

export function createQuestionPassengerDetailView({
  document,
  options = {},
  state = {},
  onCommit = () => {}
} = {}) {
  let mode = normalizeMode(options.mode);
  let chance = normalizeChance(options.chance);
  let destroyed = false;

  const element = document.createElement('section');
  element.setAttribute('data-question-passenger-settings', '');
  appendTextElement(document, element, 'h3', '机制设置');

  const modeLabel = document.createElement('label');
  modeLabel.setAttribute('data-question-field', 'mode');
  appendTextElement(document, modeLabel, 'span', '分配模式');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('data-question-mode', '');
  for (const [value, text] of [
    ['chance', '概率随机'],
    ['authored', '关卡标记']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    modeSelect.append(option);
  }
  modeSelect.value = mode;
  modeLabel.append(modeSelect);
  element.append(modeLabel);

  const chanceRow = document.createElement('div');
  chanceRow.setAttribute('data-question-chance-row', '');
  const chanceLabel = document.createElement('label');
  chanceLabel.setAttribute('data-question-field', 'chance');
  appendTextElement(document, chanceLabel, 'span', '随机概率');
  const chanceInput = document.createElement('input');
  chanceInput.type = 'range';
  chanceInput.id = `question-passenger-chance-${nextQuestionChanceInputId}`;
  nextQuestionChanceInputId += 1;
  chanceInput.setAttribute('min', '0');
  chanceInput.setAttribute('max', '100');
  chanceInput.setAttribute('step', '1');
  chanceInput.setAttribute('data-question-chance', '');
  chanceInput.value = String(Math.round(chance * 100));
  chanceLabel.append(chanceInput);
  const chanceOutput = document.createElement('output');
  chanceOutput.setAttribute('data-question-chance-output', '');
  chanceOutput.setAttribute('for', chanceInput.id);
  chanceRow.append(chanceLabel, chanceOutput);
  element.append(chanceRow);

  const questionState = state.questionPassenger ?? {};
  const authoredMarked = questionState.authoredMarked ?? 0;
  const authoredTotal = questionState.authoredTotal ?? 0;
  const authoredSummary = appendTextElement(
    document,
    element,
    'p',
    `固定标记：${authoredMarked}/${authoredTotal} 组`
  );
  authoredSummary.setAttribute('data-question-authored-summary', '');

  function renderChancePercent(percent) {
    const text = `${percent}%`;
    chanceOutput.textContent = text;
    chanceInput.setAttribute('aria-valuetext', text);
  }

  function syncModeVisibility() {
    const authored = mode === 'authored';
    modeSelect.value = mode;
    chanceRow.hidden = authored;
    authoredSummary.hidden = !authored;
  }

  function handleModeChange() {
    mode = normalizeMode(modeSelect.value);
    syncModeVisibility();
    onCommit({ mode, chance });
  }

  function handleChanceInput() {
    const previewChance = normalizeChance(Number(chanceInput.value) / 100);
    renderChancePercent(Math.round(previewChance * 100));
  }

  function handleChanceChange() {
    chance = normalizeChance(Number(chanceInput.value) / 100);
    chanceInput.value = String(Math.round(chance * 100));
    renderChancePercent(chanceInput.value);
    onCommit({ mode, chance });
  }

  modeSelect.addEventListener('change', handleModeChange);
  chanceInput.addEventListener('input', handleChanceInput);
  chanceInput.addEventListener('change', handleChanceChange);
  renderChancePercent(chanceInput.value);
  syncModeVisibility();

  return {
    element,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      modeSelect.removeEventListener('change', handleModeChange);
      chanceInput.removeEventListener('input', handleChanceInput);
      chanceInput.removeEventListener('change', handleChanceChange);
    }
  };
}
