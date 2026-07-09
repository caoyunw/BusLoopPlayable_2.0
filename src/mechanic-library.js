const STATUS_LABELS = {
  playable: '可试玩',
  planned: '待实现'
};

export function filterMechanicCollection(mechanics, query = '') {
  const value = query.trim().toLocaleLowerCase('zh-CN');
  if (!value) return [...mechanics];

  return mechanics.filter((mechanic) => (
    [mechanic.name, mechanic.summary, ...mechanic.categories]
      .some((text) => text.toLocaleLowerCase('zh-CN').includes(value))
  ));
}

function appendTextElement(document, parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

export function createMechanicLibrary(root, {
  mechanics,
  activeId,
  onSelect = () => {},
  filter = filterMechanicCollection
}) {
  const search = root?.querySelector('#mechanic-search');
  const list = root?.querySelector('#mechanic-list');
  const detail = root?.querySelector('#mechanic-detail');
  const toggle = root?.querySelector('#mechanic-library-toggle');

  if (!search || !list || !detail || !toggle) {
    throw new Error('Mechanic library root is missing required controls.');
  }

  const document = root.ownerDocument;
  const view = document.defaultView;
  const mobileViewport = view?.matchMedia?.('(max-width: 860px)');
  const mechanicById = new Map(mechanics.map((mechanic) => [mechanic.id, mechanic]));
  const allowedIds = new Set(mechanicById.keys());
  let currentId = mechanicById.has(activeId) ? activeId : mechanics[0]?.id;

  function renderDetail() {
    detail.replaceChildren();
    const mechanic = mechanicById.get(currentId);
    if (!mechanic) {
      appendTextElement(document, detail, 'p', 'mechanic-detail-empty', '选择机制查看规则。');
      return;
    }

    const heading = document.createElement('div');
    heading.className = 'mechanic-detail-heading';
    appendTextElement(document, heading, 'h2', 'mechanic-detail-title', mechanic.name);
    appendTextElement(
      document,
      heading,
      'span',
      `mechanic-status mechanic-status--${mechanic.status}`,
      STATUS_LABELS[mechanic.status] ?? mechanic.status
    );
    detail.append(heading);
    appendTextElement(document, detail, 'p', 'mechanic-detail-summary', mechanic.summary);

    const facts = document.createElement('dl');
    facts.className = 'mechanic-facts';
    for (const [label, value] of [
      ['机制效果', mechanic.effect],
      ['体验变化', mechanic.experience],
      ['理解难度', mechanic.difficulty]
    ]) {
      appendTextElement(document, facts, 'dt', '', label);
      appendTextElement(document, facts, 'dd', '', value);
    }
    detail.append(facts);

    const categoryBlock = document.createElement('div');
    categoryBlock.className = 'mechanic-categories';
    appendTextElement(document, categoryBlock, 'h3', '', '分类');
    const categoryList = document.createElement('div');
    categoryList.className = 'mechanic-category-list';
    for (const category of mechanic.categories) {
      appendTextElement(document, categoryList, 'span', 'mechanic-category', category);
    }
    categoryBlock.append(categoryList);
    detail.append(categoryBlock);
  }

  function syncCurrentButtons() {
    for (const button of list.querySelectorAll('[data-mechanic-id]')) {
      button.setAttribute('aria-current', String(button.dataset.mechanicId === currentId));
    }
  }

  function renderList(query = '') {
    list.replaceChildren();
    const matches = filter(mechanics, query).filter((mechanic) => allowedIds.has(mechanic.id));

    if (!matches.length) {
      appendTextElement(document, list, 'p', 'mechanic-empty-state', '没有找到匹配的机制');
      return;
    }

    const groups = new Map();
    const groupedIds = new Set();
    for (const mechanic of matches) {
      if (groupedIds.has(mechanic.id)) continue;
      groupedIds.add(mechanic.id);
      const category = mechanic.categories[0] ?? '其他';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(mechanic);
    }

    for (const [category, entries] of groups) {
      const section = document.createElement('section');
      section.className = 'mechanic-group';
      appendTextElement(document, section, 'h2', 'mechanic-group-title', category);

      for (const mechanic of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mechanic-item';
        button.dataset.mechanicId = mechanic.id;
        button.setAttribute('aria-current', String(mechanic.id === currentId));
        appendTextElement(document, button, 'span', 'mechanic-item-name', mechanic.name);
        appendTextElement(
          document,
          button,
          'span',
          `mechanic-status mechanic-status--${mechanic.status}`,
          STATUS_LABELS[mechanic.status] ?? mechanic.status
        );
        section.append(button);
      }
      list.append(section);
    }
  }

  function setCollapsed(collapsed) {
    root.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? '展开机制库' : '收起机制库');
    toggle.textContent = collapsed ? '☰' : '‹';
  }

  function setActive(id) {
    if (!mechanicById.has(id)) return;
    currentId = id;
    syncCurrentButtons();
    renderDetail();
  }

  const handleSearch = () => renderList(search.value);
  const handleToggle = () => {
    if (!mobileViewport?.matches) {
      setCollapsed(false);
      return;
    }
    setCollapsed(!root.classList.contains('is-collapsed'));
  };
  const handleViewportChange = (event) => {
    if (!event.matches) setCollapsed(false);
  };
  const handleListClick = (event) => {
    const button = event.target.closest('[data-mechanic-id]');
    if (!button || !list.contains(button)) return;
    const id = button.dataset.mechanicId;
    setActive(id);
    onSelect(id);
    if (mobileViewport?.matches) {
      setCollapsed(true);
      toggle.focus();
    }
  };

  search.addEventListener('input', handleSearch);
  toggle.addEventListener('click', handleToggle);
  list.addEventListener('click', handleListClick);
  mobileViewport?.addEventListener('change', handleViewportChange);
  setCollapsed(mobileViewport?.matches && root.classList.contains('is-collapsed'));
  renderList();
  renderDetail();

  return {
    setActive,
    destroy() {
      search.removeEventListener('input', handleSearch);
      toggle.removeEventListener('click', handleToggle);
      list.removeEventListener('click', handleListClick);
      mobileViewport?.removeEventListener('change', handleViewportChange);
    }
  };
}
