import {
  normalizeTrainChance,
  normalizeTrainMode
} from './model.js';

let nextTrainInputId = 1;

function appendTextElement(document, parent, tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  parent.append(element);
  return element;
}

export function createTrainDetailView({
  document,
  options = {},
  state = {},
  onCommit = () => {}
} = {}) {
  let mode = normalizeTrainMode(options.mode);
  let chance = normalizeTrainChance(options.chance);
  let destroyed = false;
  const train = state.train ?? {};

  const element = document.createElement('section');
  element.setAttribute('data-train-settings', '');
  appendTextElement(document, element, 'h3', '机制设置');

  const modeLabel = document.createElement('label');
  modeLabel.setAttribute('data-train-field', 'mode');
  appendTextElement(document, modeLabel, 'span', '分配模式');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('data-train-mode', '');
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
  chanceRow.setAttribute('data-train-chance-row', '');
  const chanceLabel = document.createElement('label');
  chanceLabel.setAttribute('data-train-field', 'chance');
  appendTextElement(document, chanceLabel, 'span', '车厢概率');
  const chanceInput = document.createElement('input');
  const chanceId = `train-chance-${nextTrainInputId}`;
  nextTrainInputId += 1;
  chanceInput.type = 'range';
  chanceInput.id = chanceId;
  chanceInput.setAttribute('min', '0');
  chanceInput.setAttribute('max', '100');
  chanceInput.setAttribute('step', '1');
  chanceInput.setAttribute('data-train-chance', '');
  chanceLabel.append(chanceInput);
  const chanceOutput = document.createElement('output');
  chanceOutput.setAttribute('data-train-chance-output', '');
  chanceOutput.setAttribute('for', chanceId);
  chanceRow.append(chanceLabel, chanceOutput);
  element.append(chanceRow);

  const authoredSummary = appendTextElement(
    document,
    element,
    'p',
    `固定标记：${train.authoredGroupCount ?? 0} 列火车，${train.authoredCarriageCount ?? 0} 节车厢`
  );
  authoredSummary.setAttribute('data-train-authored-summary', '');

  function commit() {
    onCommit({ mode, chance });
  }

  function sync() {
    modeSelect.value = mode;
    chanceInput.value = String(Math.round(chance * 100));
    const chanceText = `${Math.round(chance * 100)}%`;
    chanceOutput.textContent = chanceText;
    chanceInput.setAttribute('aria-valuetext', chanceText);
    const authored = mode === 'authored';
    chanceRow.hidden = authored;
    authoredSummary.hidden = !authored;
  }

  function handleModeChange() {
    mode = normalizeTrainMode(modeSelect.value);
    sync();
    commit();
  }

  function handleChanceInput() {
    const preview = Math.round(normalizeTrainChance(Number(chanceInput.value) / 100) * 100);
    chanceOutput.textContent = `${preview}%`;
    chanceInput.setAttribute('aria-valuetext', `${preview}%`);
  }

  function handleChanceChange() {
    chance = normalizeTrainChance(Number(chanceInput.value) / 100);
    sync();
    commit();
  }

  modeSelect.addEventListener('change', handleModeChange);
  chanceInput.addEventListener('input', handleChanceInput);
  chanceInput.addEventListener('change', handleChanceChange);
  sync();

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
