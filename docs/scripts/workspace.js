function isPointerNearRing(pointerEvent) {
  return hasAudio && isNearRing(pointerEvent);
}

function bringToFront(el) {
  if (el.classList.contains('workspace-text')) {
    imgZTop++;
    el.style.zIndex = imgZTop;
  } else {
    imgImgZ = Math.min(imgImgZ + 1, VIZ_Z - 1);
    el.style.zIndex = imgImgZ;
  }
}

function applyFlip(el) {
  const tx = parseFloat(el.getAttribute('data-x')) || 0;
  const ty = parseFloat(el.getAttribute('data-y')) || 0;
  const sx = el.dataset.flipH === '1' ? -1 : 1;
  const sy = el.dataset.flipV === '1' ? -1 : 1;
  el.style.transform = `translate(${tx}px,${ty}px) scale(${sx},${sy})`;
}

function setupInteract(el) {
  const isText = el.classList.contains('workspace-text');
  const interactable = interact(el)
    .draggable({
      inertia: true,
      styleCursor: false,
      modifiers: [interact.modifiers.restrictRect({ restriction: '#workspace', endOnly: false })],
      listeners: {
        start(event) {
          if (el.classList.contains('editing')) { event.interaction.stop(); return; }
          const pe = event.pointerEvent ?? event;
          if (isPointerNearRing(pe)) { event.interaction.stop(); return; }
          bringToFront(el);
          selectItem(el);
        },
        move(event) {
          const x = (parseFloat(el.getAttribute('data-x')) || 0) + event.dx;
          const y = (parseFloat(el.getAttribute('data-y')) || 0) + event.dy;
          el.setAttribute('data-x', x);
          el.setAttribute('data-y', y);
          applyFlip(el);
        },
        end() { persistWorkspace(el); }
      }
    });

  if (!isText) {
    interactable.resizable({
      edges: { left: true, right: true, top: true, bottom: true },
      styleCursor: false,
      modifiers: [interact.modifiers.restrictSize({ min: { width: 40, height: 40 } })],
      listeners: {
        start(event) {
          if (el.classList.contains('editing')) { event.interaction.stop(); return; }
          const pe = event.pointerEvent ?? event;
          if (isPointerNearRing(pe)) { event.interaction.stop(); return; }
          selectItem(el);
        },
        move(event) {
          el.style.width  = event.rect.width  + 'px';
          el.style.height = event.rect.height + 'px';
          const x = (parseFloat(el.getAttribute('data-x')) || 0) + event.deltaRect.left;
          const y = (parseFloat(el.getAttribute('data-y')) || 0) + event.deltaRect.top;
          el.setAttribute('data-x', x);
          el.setAttribute('data-y', y);
          applyFlip(el);
        },
        end() { persistWorkspace(el); }
      }
    });
  }
}

function persistWorkspace(el) {
  if (el.classList.contains('workspace-text')) {
    saveWorkspaceMeta();
  } else {
    const id   = el.dataset.dbId;
    const meta = {
      opacity: el.style.opacity || '1',
      x:       el.getAttribute('data-x') || '0',
      y:       el.getAttribute('data-y') || '0',
      flipH:   el.dataset.flipH || '0',
      flipV:   el.dataset.flipV || '0',
      width:   el.style.width  || '220px',
      height:  el.style.height || '',
      zIndex:  Math.min(parseInt(el.style.zIndex) || 1, VIZ_Z - 1)
    };
    dbPut('images', id, { id, blob: el._blob, ...meta });
  }
}

function selectItem(el) {
  if (selectedItem && selectedItem !== el) selectedItem.classList.remove('selected');
  selectedItem = el;
  if (!el) {
    itemToolbar.classList.remove('visible');
    tbImgControls.classList.remove('visible');
    tbTextControls.classList.remove('visible');
    return;
  }
  el.classList.add('selected');
  tbOpacity.value = el.style.opacity !== '' ? parseFloat(el.style.opacity) : 1;
  itemToolbar.classList.add('visible');
  if (el.classList.contains('workspace-img')) {
    tbImgControls.classList.add('visible');
    tbTextControls.classList.remove('visible');
  } else {
    tbImgControls.classList.remove('visible');
    tbTextControls.classList.add('visible');
    tbFont.value      = el.dataset.font     || 'Share Tech Mono';
    tbFontSize.value  = el.dataset.fontSize || '32';
    tbBold.classList.toggle('on',   el.dataset.bold   === '1');
    tbItalic.classList.toggle('on', el.dataset.italic === '1');
    tbTextColor.value = el.dataset.color    || '#ffffff';
  }
}

function deleteSelectedItem() {
  if (!selectedItem) return;
  if (selectedItem.classList.contains('workspace-img')) {
    const id = selectedItem.dataset.dbId;
    if (id) dbDelete('images', id);
    if (selectedItem._blobUrl) URL.revokeObjectURL(selectedItem._blobUrl);
  }
  selectedItem.remove();
  selectedItem = null;
  itemToolbar.classList.remove('visible');
  tbImgControls.classList.remove('visible');
  tbTextControls.classList.remove('visible');
  saveWorkspaceMeta();
}

function applyTextStyle(el) {
  const font   = el.dataset.font     || 'Share Tech Mono';
  const size   = el.dataset.fontSize || '32';
  const bold   = el.dataset.bold     === '1';
  const italic = el.dataset.italic   === '1';
  const color  = el.dataset.color    || '#ffffff';
  el.style.fontFamily = `'${font}', sans-serif`;
  el.style.fontSize   = size + 'px';
  el.style.fontWeight = bold   ? '700' : '400';
  el.style.fontStyle  = italic ? 'italic' : 'normal';
  el.style.color      = color;
}

function startEditing(el) {
  el.classList.add('editing');
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  interact(el).draggable({ enabled: false });
}

function stopEditing(el) {
  el.classList.remove('editing');
  el.contentEditable = 'false';
  interact(el).draggable({ enabled: true });
  if (el.textContent.trim() === '') el.textContent = 'Double-click to edit';
  saveWorkspaceMeta();
}

function spawnImage(url, meta = {}) {
  const img = document.createElement('img');
  img.src           = url;
  img.className     = 'workspace-img';
  img.style.left    = '0px';
  img.style.top     = '0px';
  img.style.width   = meta.width   || '220px';
  if (meta.height)  img.style.height = meta.height;
  img.style.opacity = meta.opacity || '1';
  img.dataset.flipH = meta.flipH   || '0';
  img.dataset.flipV = meta.flipV   || '0';
  img.dataset.dbId  = meta.id      || '';
  img._blobUrl      = url;
  img._blob         = meta.blob    || null;
  img.style.zIndex  = Math.min(++imgImgZ, VIZ_Z - 1);

  const tx = parseFloat(meta.x || 60);
  const ty = parseFloat(meta.y || 60);
  img.setAttribute('data-x', tx);
  img.setAttribute('data-y', ty);
  applyFlip(img);

  img.addEventListener('mousedown', () => selectItem(img));
  img.addEventListener('dragstart', ev => ev.preventDefault());
  img.setAttribute('draggable', 'false');
  workspace.insertBefore(img, canvas);
  setupInteract(img);
}

function spawnText(t = {}) {
  const el = document.createElement('div');
  el.className        = 'workspace-text';
  el.textContent      = t.text      || 'Double-click to edit';
  el.dataset.font     = t.font      || 'Share Tech Mono';
  el.dataset.fontSize = t.fontSize  || '32';
  el.dataset.bold     = t.bold      || '0';
  el.dataset.italic   = t.italic    || '0';
  el.dataset.color    = t.color     || '#ffffff';
  el.dataset.flipH    = t.flipH     || '0';
  el.dataset.flipV    = t.flipV     || '0';
  el.style.opacity    = t.opacity   || '1';
  el.style.left       = '0px';
  el.style.top        = '0px';

  const savedZ = parseInt(t.zIndex) || 0;
  imgZTop = Math.max(imgZTop, savedZ, VIZ_Z) + 1;
  el.style.zIndex = imgZTop;

  const tx = parseFloat(t.x || 120);
  const ty = parseFloat(t.y || 120);
  el.setAttribute('data-x', tx);
  el.setAttribute('data-y', ty);
  applyTextStyle(el);
  applyFlip(el);

  el.addEventListener('mousedown', ev => {
    if (el.classList.contains('editing')) ev.stopPropagation();
    else selectItem(el);
  });
  el.addEventListener('dblclick', ev => {
    ev.stopPropagation();
    startEditing(el);
  });

  workspace.insertBefore(el, canvas);
  setupInteract(el);
}

imageUpload.addEventListener('change', e => {
  const existing = workspace.querySelectorAll('.workspace-img').length;
  const files    = Array.from(e.target.files).slice(0, MAX_IMAGES - existing);
  files.forEach((file, idx) => {
    const id  = 'img_' + Date.now() + '_' + idx;
    const url = URL.createObjectURL(file);
    const meta = {
      id,
      blob:    file,
      x:       60 + idx * 30,
      y:       60 + idx * 20,
      width:   '220px',
      opacity: '1',
      flipH:   '0',
      flipV:   '0'
    };
    spawnImage(url, meta);
    dbPut('images', id, { id, blob: file, ...meta });
  });
  e.target.value = '';
});

btnAddText.addEventListener('click', () => {
  spawnText();
  const el = workspace.querySelector('.workspace-text:last-of-type');
  if (el) { selectItem(el); saveWorkspaceMeta(); }
});

tbDelete.addEventListener('click', deleteSelectedItem);

tbFlipH.addEventListener('click', () => {
  if (!selectedItem) return;
  selectedItem.dataset.flipH = selectedItem.dataset.flipH === '1' ? '0' : '1';
  applyFlip(selectedItem);
  persistWorkspace(selectedItem);
});

tbFlipV.addEventListener('click', () => {
  if (!selectedItem) return;
  selectedItem.dataset.flipV = selectedItem.dataset.flipV === '1' ? '0' : '1';
  applyFlip(selectedItem);
  persistWorkspace(selectedItem);
});

tbOpacity.addEventListener('input', () => {
  if (!selectedItem) return;
  selectedItem.style.opacity = tbOpacity.value;
  persistWorkspace(selectedItem);
});

tbFont.addEventListener('change', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.font = tbFont.value;
  applyTextStyle(selectedItem);
  saveWorkspaceMeta();
});

tbFontSize.addEventListener('input', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  const clamped = Math.min(172, Math.max(8, parseInt(tbFontSize.value) || 8));
  tbFontSize.value = clamped;
  selectedItem.dataset.fontSize = clamped;
  applyTextStyle(selectedItem);
  saveWorkspaceMeta();
});

tbBold.addEventListener('click', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.bold = selectedItem.dataset.bold === '1' ? '0' : '1';
  tbBold.classList.toggle('on', selectedItem.dataset.bold === '1');
  applyTextStyle(selectedItem);
  saveWorkspaceMeta();
});

tbItalic.addEventListener('click', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.italic = selectedItem.dataset.italic === '1' ? '0' : '1';
  tbItalic.classList.toggle('on', selectedItem.dataset.italic === '1');
  applyTextStyle(selectedItem);
  saveWorkspaceMeta();
});

tbTextColor.addEventListener('input', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.color = tbTextColor.value;
  applyTextStyle(selectedItem);
  saveWorkspaceMeta();
});