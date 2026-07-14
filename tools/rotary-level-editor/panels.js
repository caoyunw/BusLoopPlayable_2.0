function selectionMatches(selection, target) {
  return selection.some((entry) => entry.type === target.type
    && entry.id === target.id
    && (entry.type !== 'slot' || entry.laneId === target.laneId));
}

function errorMatches(errors, objectType, objectId) {
  return errors.some((entry) => entry.objectType === objectType
    && String(entry.objectId) === String(objectId));
}

function vehicleLabel(vehicle) {
  return `车辆 ${vehicle.id}`;
}

function findSlot(document, laneId, slotId) {
  return document.rotaryLanes
    .find(({ id }) => id === laneId)
    ?.slots.find(({ id }) => id === slotId);
}

export function buildObjectTreeModel(
  document,
  selection = [],
  validation = { errors: [], warnings: [] }
) {
  const errors = validation.errors ?? [];
  const fieldItems = document.vehicles
    .filter(({ placement }) => placement.kind === 'field')
    .map((vehicle) => {
      const target = { type: 'vehicle', id: vehicle.id };
      return {
        id: vehicle.id,
        label: vehicleLabel(vehicle),
        meta: `${vehicle.seats} 座 · 色 ${vehicle.colorIndex}`,
        target,
        selected: selectionMatches(selection, target),
        error: errorMatches(errors, 'vehicle', vehicle.id),
        readonly: false,
        children: []
      };
    });

  const laneItems = document.rotaryLanes.map((lane) => {
    const laneTarget = { type: 'lane', id: lane.id };
    return {
      id: lane.id,
      label: `回转车道 ${lane.id}`,
      meta: `${lane.slots.length} 槽位`,
      target: laneTarget,
      selected: selectionMatches(selection, laneTarget),
      error: errorMatches(errors, 'lane', lane.id),
      readonly: false,
      children: lane.slots.map((slot) => {
        const occupant = document.vehicles.find(({ placement }) => (
          placement.kind === 'rotary-slot'
          && placement.laneId === lane.id
          && placement.slotId === slot.id
        ));
        const target = { type: 'slot', laneId: lane.id, id: slot.id };
        return {
          id: slot.id,
          label: `槽位 ${slot.id}`,
          meta: occupant ? `车辆 ${occupant.id}` : '空槽',
          occupantId: occupant?.id ?? null,
          target,
          selected: selectionMatches(selection, target),
          error: errorMatches(errors, 'slot', slot.id)
            || errorMatches(errors, 'lane', lane.id)
            || (occupant && errorMatches(errors, 'vehicle', occupant.id)),
          readonly: false,
          children: occupant ? [{
            id: occupant.id,
            label: vehicleLabel(occupant),
            meta: `${occupant.seats} 座`,
            target: { type: 'vehicle', id: occupant.id },
            selected: selectionMatches(
              selection,
              { type: 'vehicle', id: occupant.id }
            ),
            error: errorMatches(errors, 'vehicle', occupant.id),
            readonly: false,
            children: []
          }] : []
        };
      })
    };
  });

  const garageItems = (document.context?.garages ?? []).map((garage) => {
    const vehicles = document.vehicles
      .filter(({ placement }) => placement.kind === 'garage'
        && placement.garageId === garage.id)
      .sort((a, b) => a.placement.stockOrder - b.placement.stockOrder);
    return {
      id: garage.id,
      label: `车库 ${garage.id}`,
      meta: `${vehicles.length} 辆`,
      target: { type: 'context', kind: 'garage', id: garage.id },
      selected: selectionMatches(
        selection,
        { type: 'context', kind: 'garage', id: garage.id }
      ),
      error: errorMatches(errors, 'garage', garage.id),
      readonly: true,
      children: vehicles.map((vehicle) => {
        const target = { type: 'vehicle', id: vehicle.id };
        return {
          id: vehicle.id,
          label: vehicleLabel(vehicle),
          meta: `顺序 ${vehicle.placement.stockOrder}`,
          target,
          selected: selectionMatches(selection, target),
          error: errorMatches(errors, 'vehicle', vehicle.id),
          readonly: false,
          children: []
        };
      })
    };
  });

  const readonlyItems = [];
  const appendReadonly = (values, kind) => {
    (values ?? []).forEach((value, index) => {
      const id = value.id ?? `${kind}-${index + 1}`;
      readonlyItems.push({
        id,
        label: value.label ?? `${kind} ${id}`,
        meta: Number.isFinite(value.count) ? `${value.count} 项` : kind,
        target: { type: 'context', kind, id },
        selected: false,
        error: errorMatches(errors, kind, id),
        readonly: true,
        children: []
      });
    });
  };
  appendReadonly(document.context?.parkingSpots, 'parking-spot');
  appendReadonly(document.context?.conveyors, 'conveyor');
  appendReadonly(document.context?.passengerQueues, 'passenger-queue');
  appendReadonly(document.context?.protectedGeometry, 'protected-geometry');

  return {
    groups: [
      { id: 'field', label: '普通车辆', items: fieldItems },
      { id: 'lanes', label: '回转车道', items: laneItems },
      { id: 'garages', label: '车库归属', items: garageItems },
      { id: 'readonly', label: '只读上下文', items: readonlyItems }
    ]
  };
}

function propertyField(key, label, value, target, options = {}) {
  return {
    key,
    label,
    value,
    target,
    type: options.type ?? 'number',
    options: options.options ?? null,
    disabled: options.disabled ?? false
  };
}

function poseFields(pose, target, disabled = false) {
  return [
    propertyField('x', 'X', pose.x, target, { disabled }),
    propertyField('z', 'Z', pose.z, target, { disabled }),
    propertyField('yaw', '朝向', pose.yaw, target, { disabled })
  ];
}

function findContextObject(document, selected) {
  if (selected.kind === 'garage') {
    return document.context?.garages?.find(({ id }) => id === selected.id);
  }
  const mapping = {
    'parking-spot': 'parkingSpots',
    conveyor: 'conveyors',
    'passenger-queue': 'passengerQueues',
    'protected-geometry': 'protectedGeometry'
  };
  return document.context?.[mapping[selected.kind]]?.find(({ id }) => id === selected.id);
}

function placementValue(placement) {
  if (placement.kind === 'garage') return `garage|${placement.garageId}`;
  if (placement.kind === 'rotary-slot') {
    return `rotary-slot|${placement.laneId}|${placement.slotId}`;
  }
  return 'field';
}

function vehiclePlacementOptions(document, vehicle) {
  const options = [{ value: 'field', label: '普通区域' }];
  for (const garage of document.context?.garages ?? []) {
    options.push({
      value: `garage|${garage.id}`,
      label: `车库 ${garage.id}`
    });
  }
  for (const lane of document.rotaryLanes) {
    for (const slot of lane.slots) {
      const occupiedByAnother = document.vehicles.some((candidate) => (
        candidate.id !== vehicle.id
        && candidate.placement.kind === 'rotary-slot'
        && candidate.placement.laneId === lane.id
        && candidate.placement.slotId === slot.id
      ));
      if (occupiedByAnother) continue;
      options.push({
        value: `rotary-slot|${lane.id}|${slot.id}`,
        label: `回转槽位 ${lane.id} / ${slot.id}`
      });
    }
  }
  return options;
}

export function buildPropertyModel(document, selection = []) {
  if (selection.length === 0) {
    return { kind: 'empty', title: '未选择对象', readonly: true, fields: [] };
  }
  if (selection.length > 1) {
    return {
      kind: 'multiple',
      title: `已选择 ${selection.length} 个对象`,
      readonly: true,
      fields: []
    };
  }
  const selected = selection[0];
  if (selected.type === 'vehicle') {
    const vehicle = document.vehicles.find(({ id }) => id === selected.id);
    if (!vehicle) return { kind: 'missing', title: '对象不存在', readonly: true, fields: [] };
    let pose;
    let poseTarget;
    if (vehicle.placement.kind === 'field') {
      pose = vehicle.placement;
      poseTarget = { type: 'vehicle', id: vehicle.id };
    } else if (vehicle.placement.kind === 'rotary-slot') {
      pose = findSlot(
        document,
        vehicle.placement.laneId,
        vehicle.placement.slotId
      );
      poseTarget = {
        type: 'slot',
        laneId: vehicle.placement.laneId,
        id: vehicle.placement.slotId
      };
    } else {
      pose = vehicle.placement.storedPose;
      poseTarget = { type: 'vehicle-stored-pose', id: vehicle.id };
    }
    const fields = [
      propertyField('id', '车辆 ID', vehicle.id, { type: 'vehicle', id: vehicle.id }),
      propertyField(
        'colorIndex',
        '颜色',
        vehicle.colorIndex,
        { type: 'vehicle', id: vehicle.id },
        {
          type: 'select',
          options: (document.context?.allowedColorIndexes ?? []).map((value) => ({
            value,
            label: `颜色 ${value}`
          }))
        }
      ),
      propertyField(
        'seats',
        '座位数',
        vehicle.seats,
        { type: 'vehicle', id: vehicle.id },
        {
          type: 'select',
          options: [4, 6, 10].map((value) => ({ value, label: `${value} 座` }))
        }
      ),
      propertyField(
        'placement',
        '归属',
        placementValue(vehicle.placement),
        { type: 'vehicle', id: vehicle.id },
        {
          type: 'select',
          options: vehiclePlacementOptions(document, vehicle)
        }
      ),
      ...poseFields(pose, poseTarget)
    ];
    if (vehicle.placement.kind === 'garage') {
      fields.push(propertyField(
        'stockOrder',
        '出库顺序',
        vehicle.placement.stockOrder,
        { type: 'vehicle', id: vehicle.id }
      ));
    }
    return {
      kind: 'vehicle',
      title: vehicleLabel(vehicle),
      readonly: false,
      note: vehicle.placement.kind === 'rotary-slot'
        ? '坐标与朝向来自所属槽位；修改会移动该真实槽位。'
        : null,
      fields,
      actions: [
        { id: 'duplicate', label: '复制车辆' },
        { id: 'delete', label: '删除车辆', danger: true }
      ]
    };
  }

  if (selected.type === 'slot') {
    const slot = findSlot(document, selected.laneId, selected.id);
    if (!slot) return { kind: 'missing', title: '槽位不存在', readonly: true, fields: [] };
    const target = { type: 'slot', laneId: selected.laneId, id: selected.id };
    return {
      kind: 'slot',
      title: `槽位 ${slot.id}`,
      readonly: false,
      fields: [
        propertyField('id', '槽位 ID', slot.id, target, { type: 'text' }),
        ...poseFields(slot, target)
      ]
    };
  }

  if (selected.type === 'lane') {
    const lane = document.rotaryLanes.find(({ id }) => id === selected.id);
    return {
      kind: 'lane',
      title: lane ? `回转车道 ${lane.id}` : '车道不存在',
      readonly: false,
      fields: lane ? [propertyField(
        'id',
        '车道 ID',
        lane.id,
        { type: 'lane', id: lane.id },
        { type: 'text' }
      )] : []
    };
  }

  const contextValue = findContextObject(document, selected);
  const fields = contextValue && Number.isFinite(contextValue.x)
    ? poseFields(contextValue, selected, true)
    : [];
  return {
    kind: 'context',
    title: contextValue?.label ?? `${selected.kind} ${selected.id}`,
    readonly: true,
    note: '该对象来自正式关卡上下文，首版仅供参考，不能在编辑器内修改。',
    fields
  };
}

function focusTarget(entry) {
  if (entry.objectId === null || entry.objectId === undefined) return null;
  if (entry.objectType === 'vehicle') {
    return { type: 'vehicle', id: entry.objectId };
  }
  if (entry.objectType === 'lane') {
    return { type: 'lane', id: entry.objectId };
  }
  if (entry.objectType === 'slot') {
    return { type: 'slot', id: entry.objectId };
  }
  return { type: 'context', kind: entry.objectType, id: entry.objectId };
}

export function buildValidationRows(validation) {
  return [
    ...(validation.errors ?? []).map((entry) => ({
      ...entry,
      severity: 'error',
      focus: focusTarget(entry)
    })),
    ...(validation.warnings ?? []).map((entry) => ({
      ...entry,
      severity: 'warning',
      focus: focusTarget(entry)
    }))
  ];
}

function appendTreeItem(documentRef, parent, item, onSelect) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = 'tree-item';
  button.classList.toggle('is-selected', Boolean(item.selected));
  button.classList.toggle('is-error', Boolean(item.error));
  button.classList.toggle('is-readonly', Boolean(item.readonly));
  button.addEventListener('click', () => onSelect(item.target));
  const label = documentRef.createElement('span');
  label.textContent = item.label;
  const meta = documentRef.createElement('span');
  meta.className = 'tree-item-meta';
  meta.textContent = item.meta ?? '';
  button.append(label, meta);
  parent.append(button);
  if (item.children?.length) {
    const children = documentRef.createElement('div');
    children.className = 'tree-children';
    item.children.forEach((child) => {
      appendTreeItem(documentRef, children, child, onSelect);
    });
    parent.append(children);
  }
}

export function renderObjectTree(
  root,
  model,
  { onSelect = () => {} } = {}
) {
  root.replaceChildren();
  const documentRef = root.ownerDocument;
  model.groups.forEach((group) => {
    const section = documentRef.createElement('section');
    section.className = 'tree-group';
    const heading = documentRef.createElement('h3');
    heading.className = 'tree-group-title';
    const title = documentRef.createElement('span');
    title.textContent = group.label;
    const count = documentRef.createElement('span');
    count.className = 'tree-group-count';
    count.textContent = String(group.items.length);
    heading.append(title, count);
    section.append(heading);
    group.items.forEach((item) => {
      appendTreeItem(documentRef, section, item, onSelect);
    });
    root.append(section);
  });
}

function inputValue(field) {
  if (field.type === 'number') return Number(field.value);
  return field.value;
}

export function renderPropertyPanel(
  root,
  model,
  { onCommit = () => {}, onAction = () => {} } = {}
) {
  root.replaceChildren();
  const documentRef = root.ownerDocument;
  if (model.fields.length === 0) {
    const empty = documentRef.createElement('p');
    empty.className = 'property-empty';
    empty.textContent = model.title;
    root.append(empty);
    return;
  }
  const title = documentRef.createElement('h3');
  title.className = 'property-title';
  title.textContent = model.title;
  root.append(title);
  model.fields.forEach((field) => {
    const row = documentRef.createElement('div');
    row.className = 'property-field';
    const label = documentRef.createElement('label');
    label.textContent = field.label;
    let control;
    if (field.type === 'select') {
      control = documentRef.createElement('select');
      (field.options ?? []).forEach((optionValue) => {
        const option = documentRef.createElement('option');
        option.value = String(optionValue.value);
        option.textContent = optionValue.label;
        control.append(option);
      });
    } else {
      control = documentRef.createElement('input');
      control.type = field.type === 'number' ? 'number' : 'text';
      if (field.type === 'number') control.step = 'any';
    }
    control.value = String(field.value ?? '');
    control.disabled = model.readonly || field.disabled;
    control.dataset.field = field.key;
    label.htmlFor = `property-${field.key}`;
    control.id = `property-${field.key}`;
    const commit = () => onCommit(field, inputValue({
      ...field,
      value: control.value
    }));
    control.addEventListener('change', commit);
    control.addEventListener('blur', commit);
    control.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        commit();
        control.blur();
      }
    });
    row.append(label, control);
    root.append(row);
  });
  if (model.note) {
    const note = documentRef.createElement('p');
    note.className = 'property-note';
    note.textContent = model.note;
    root.append(note);
  }
  if (model.actions?.length) {
    const actions = documentRef.createElement('div');
    actions.className = 'property-actions';
    model.actions.forEach((action) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.dataset.propertyAction = action.id;
      button.className = action.danger ? 'is-danger' : '';
      button.textContent = action.label;
      button.addEventListener('click', () => onAction(action));
      actions.append(button);
    });
    root.append(actions);
  }
}

export function renderValidationPanel(
  root,
  rows,
  { onFocus = () => {} } = {}
) {
  root.replaceChildren();
  const documentRef = root.ownerDocument;
  if (rows.length === 0) {
    const clean = documentRef.createElement('span');
    clean.className = 'validation-clean';
    clean.textContent = '无阻断错误';
    root.append(clean);
    return;
  }
  rows.forEach((row) => {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = `validation-row is-${row.severity}`;
    button.disabled = !row.focus;
    button.addEventListener('click', () => {
      if (row.focus) onFocus(row.focus, row.path);
    });
    const code = documentRef.createElement('span');
    code.className = 'validation-row-code';
    code.textContent = row.code;
    const message = documentRef.createElement('span');
    message.className = 'validation-row-message';
    message.textContent = row.message;
    const path = documentRef.createElement('span');
    path.className = 'validation-row-path';
    path.textContent = row.path;
    button.append(code, message, path);
    root.append(button);
  });
}
