function isPointerNearRing(pointerEvent) {
  return hasAudio && isNearRing(pointerEvent);
}

function bringToFront(el) {
  imgZTop++;
  el.style.zIndex = imgZTop;
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
        }
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
        }
      }
    });
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
    tbFont.value         = el.dataset.font      || 'Share Tech Mono';
    tbFontSize.value     = el.dataset.fontSize  || '32';
    tbBold.classList.toggle('on',   el.dataset.bold   === '1');
    tbItalic.classList.toggle('on', el.dataset.italic === '1');
    tbTextColor.value    = el.dataset.color     || '#ffffff';
  }
}

function deleteSelectedItem() {
  if (!selectedItem) return;
  if (selectedItem.src && selectedItem.src.startsWith('blob:')) URL.revokeObjectURL(selectedItem.src);
  selectedItem.remove();
  selectedItem = null;
  itemToolbar.classList.remove('visible');
  tbImgControls.classList.remove('visible');
  tbTextControls.classList.remove('visible');
}

function applyTextStyle(el) {
  const font   = el.dataset.font     || 'Share Tech Mono';
  const size   = el.dataset.fontSize || '32';
  const bold   = el.dataset.bold     === '1';
  const italic = el.dataset.italic   === '1';
  const color  = el.dataset.color    || '#ffffff';
  el.style.fontFamily  = `'${font}', sans-serif`;
  el.style.fontSize    = size + 'px';
  el.style.fontWeight  = bold   ? '700' : '400';
  el.style.fontStyle   = italic ? 'italic' : 'normal';
  el.style.color       = color;
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
}

imageUpload.addEventListener('change', e => {
  const existing = workspace.querySelectorAll('.workspace-img').length;
  const files    = Array.from(e.target.files).slice(0, MAX_IMAGES - existing);
  files.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src         = url;
    img.className   = 'workspace-img';
    img.style.left  = (60 + idx * 30) + 'px';
    img.style.top   = (60 + idx * 20) + 'px';
    img.style.width = '220px';
    imgZTop++;
    img.style.zIndex = imgZTop;
    img.addEventListener('mousedown', () => selectItem(img));
    img.addEventListener('dragstart', ev => ev.preventDefault());
    img.setAttribute('draggable', 'false');
    workspace.insertBefore(img, canvas);
    setupInteract(img);
  });
  e.target.value = '';
});

btnAddText.addEventListener('click', () => {
  const el = document.createElement('div');
  el.className        = 'workspace-text';
  el.textContent      = 'Double-click to edit';
  el.dataset.font     = 'Share Tech Mono';
  el.dataset.fontSize = '32';
  el.dataset.bold     = '0';
  el.dataset.italic   = '0';
  el.dataset.color    = '#ffffff';
  el.style.left       = '120px';
  el.style.top        = '120px';
  imgZTop++;
  el.style.zIndex     = imgZTop;
  applyTextStyle(el);

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
  selectItem(el);
});

tbDelete.addEventListener('click', deleteSelectedItem);

tbFlipH.addEventListener('click', () => {
  if (!selectedItem) return;
  selectedItem.dataset.flipH = selectedItem.dataset.flipH === '1' ? '0' : '1';
  applyFlip(selectedItem);
});

tbFlipV.addEventListener('click', () => {
  if (!selectedItem) return;
  selectedItem.dataset.flipV = selectedItem.dataset.flipV === '1' ? '0' : '1';
  applyFlip(selectedItem);
});

tbOpacity.addEventListener('input', () => {
  if (selectedItem) selectedItem.style.opacity = tbOpacity.value;
});

tbFont.addEventListener('change', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.font = tbFont.value;
  applyTextStyle(selectedItem);
});

tbFontSize.addEventListener('input', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.fontSize = tbFontSize.value;
  applyTextStyle(selectedItem);
});

tbBold.addEventListener('click', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.bold = selectedItem.dataset.bold === '1' ? '0' : '1';
  tbBold.classList.toggle('on', selectedItem.dataset.bold === '1');
  applyTextStyle(selectedItem);
});

tbItalic.addEventListener('click', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.italic = selectedItem.dataset.italic === '1' ? '0' : '1';
  tbItalic.classList.toggle('on', selectedItem.dataset.italic === '1');
  applyTextStyle(selectedItem);
});

tbTextColor.addEventListener('input', () => {
  if (!selectedItem || !selectedItem.classList.contains('workspace-text')) return;
  selectedItem.dataset.color = tbTextColor.value;
  applyTextStyle(selectedItem);
});
