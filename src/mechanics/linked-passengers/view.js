let nextLinkedInputId = 1;

function normalizeMode(value) {
  return value === 'authored' ? 'authored' : 'chance';
}

function normalizeChance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.3;
  const clamped = Math.max(0, Math.min(1, numeric));
  return Math.round(clamped * 100) / 100;
}

function normalizeMaximum(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(2, Math.trunc(numeric)) : 10;
}

function normalizeLength(value, maximum) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(2, Math.min(maximum, Math.trunc(numeric)))
    : maximum;
}

function appendTextElement(document, parent, tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  parent.append(element);
  return element;
}

export function createLinkedPassengerDetailView({
  document,
  options = {},
  state = {},
  onCommit = () => {}
} = {}) {
  const runtimeState = state.linkedPassenger ?? {};
  const maximum = normalizeMaximum(runtimeState.maxVehicleSeats);
  const authoredChainCount = runtimeState.authoredChainCount ?? runtimeState.chainCount ?? 0;
  const authoredLinkedGroupCount = (
    runtimeState.authoredLinkedGroupCount ?? runtimeState.linkedGroupCount ?? 0
  );
  let mode = normalizeMode(options.mode);
  let chance = normalizeChance(options.chance);
  let maxLength = normalizeLength(options.maxLength, maximum);
  let destroyed = false;

  const element = document.createElement('section');
  element.setAttribute('data-linked-passenger-settings', '');
  appendTextElement(document, element, 'h3', '机制设置');

  const modeLabel = document.createElement('label');
  modeLabel.setAttribute('data-linked-field', 'mode');
  appendTextElement(document, modeLabel, 'span', '分配模式');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('data-linked-mode', '');
  for (const [value, text] of [
    ['chance', '概率随机'],
    ['authored', '关卡标记']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    modeSelect.append(option);
  }
  modeLabel.append(modeSelect);
  element.append(modeLabel);

  const chanceRow = document.createElement('div');
  chanceRow.setAttribute('data-linked-chance-row', '');
  const chanceLabel = document.createElement('label');
  chanceLabel.setAttribute('data-linked-field', 'chance');
  appendTextElement(document, chanceLabel, 'span', '生成概率');
  const chanceInput = document.createElement('input');
  const chanceId = `linked-passenger-chance-${nextLinkedInputId}`;
  chanceInput.type = 'range';
  chanceInput.id = chanceId;
  chanceInput.setAttribute('min', '0');
  chanceInput.setAttribute('max', '100');
  chanceInput.setAttribute('step', '1');
  chanceInput.setAttribute('data-linked-chance', '');
  chanceLabel.append(chanceInput);
  const chanceOutput = document.createElement('output');
  chanceOutput.setAttribute('data-linked-chance-output', '');
  chanceOutput.setAttribute('for', chanceId);
  chanceRow.append(chanceLabel, chanceOutput);
  element.append(chanceRow);

  const lengthRow = document.createElement('div');
  lengthRow.setAttribute('data-linked-length-row', '');
  const lengthLabel = document.createElement('label');
  lengthLabel.setAttribute('data-linked-field', 'maxLength');
  appendTextElement(document, lengthLabel, 'span', '最长连体排数');
  const lengthInput = document.createElement('input');
  const lengthId = `linked-passenger-length-${nextLinkedInputId}`;
  nextLinkedInputId += 1;
  lengthInput.type = 'range';
  lengthInput.id = lengthId;
  lengthInput.setAttribute('min', '2');
  lengthInput.setAttribute('max', String(maximum));
  lengthInput.setAttribute('step', '1');
  lengthInput.setAttribute('data-linked-max-length', '');
  lengthLabel.append(lengthInput);
  const lengthOutput = document.createElement('output');
  lengthOutput.setAttribute('data-linked-max-length-output', '');
  lengthOutput.setAttribute('for', lengthId);
  lengthRow.append(lengthLabel, lengthOutput);
  element.append(lengthRow);

  const authoredSummary = appendTextElement(
    document,
    element,
    'p',
    `固定标记：${authoredChainCount} 组连体，${authoredLinkedGroupCount} 排乘客`
  );
  authoredSummary.setAttribute('data-linked-authored-summary', '');

  function commit() {
    onCommit({ mode, chance, maxLength });
  }

  function renderChancePercent() {
    const text = `${Math.round(chance * 100)}%`;
    chanceOutput.textContent = text;
    chanceInput.setAttribute('aria-valuetext', text);
  }

  function renderLength() {
    const text = String(maxLength);
    lengthOutput.textContent = text;
    lengthInput.setAttribute('aria-valuetext', text);
  }

  function sync() {
    modeSelect.value = mode;
    chanceInput.value = String(Math.round(chance * 100));
    lengthInput.value = String(maxLength);
    renderChancePercent();
    renderLength();
    const authored = mode === 'authored';
    chanceRow.hidden = authored;
    lengthRow.hidden = authored;
    authoredSummary.hidden = !authored;
  }

  function handleModeChange() {
    mode = normalizeMode(modeSelect.value);
    sync();
    commit();
  }

  function handleChanceInput() {
    const preview = Math.round(normalizeChance(Number(chanceInput.value) / 100) * 100);
    const text = `${preview}%`;
    chanceOutput.textContent = text;
    chanceInput.setAttribute('aria-valuetext', text);
  }

  function handleChanceChange() {
    chance = normalizeChance(Number(chanceInput.value) / 100);
    sync();
    commit();
  }

  function handleLengthInput() {
    const preview = String(normalizeLength(lengthInput.value, maximum));
    lengthOutput.textContent = preview;
    lengthInput.setAttribute('aria-valuetext', preview);
  }

  function handleLengthChange() {
    maxLength = normalizeLength(lengthInput.value, maximum);
    sync();
    commit();
  }

  modeSelect.addEventListener('change', handleModeChange);
  chanceInput.addEventListener('input', handleChanceInput);
  chanceInput.addEventListener('change', handleChanceChange);
  lengthInput.addEventListener('input', handleLengthInput);
  lengthInput.addEventListener('change', handleLengthChange);
  sync();

  return {
    element,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      modeSelect.removeEventListener('change', handleModeChange);
      chanceInput.removeEventListener('input', handleChanceInput);
      chanceInput.removeEventListener('change', handleChanceChange);
      lengthInput.removeEventListener('input', handleLengthInput);
      lengthInput.removeEventListener('change', handleLengthChange);
    }
  };
}
