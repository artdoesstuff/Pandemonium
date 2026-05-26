const audioUpload    = document.getElementById('audio-upload');
const imageUpload    = document.getElementById('image-upload');
const audioPlayer    = document.getElementById('audio-player');
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const btnLoop        = document.getElementById('btn-loop');
const btnAddText     = document.getElementById('btn-add-text');
const iconPlay       = document.getElementById('icon-play');
const iconPause      = document.getElementById('icon-pause');
const volSlider      = document.getElementById('vol-slider');
const trackName      = document.getElementById('track-name');
const accentPicker   = document.getElementById('accent-picker');
const canvas         = document.getElementById('visualizer');
const workspace      = document.getElementById('workspace');
const ctx            = canvas.getContext('2d');
const itemToolbar    = document.getElementById('item-toolbar');
const tbImgControls  = document.getElementById('tb-img-controls');
const tbTextControls = document.getElementById('tb-text-controls');
const tbFlipH        = document.getElementById('tb-flip-h');
const tbFlipV        = document.getElementById('tb-flip-v');
const tbOpacity      = document.getElementById('tb-opacity');
const tbDelete       = document.getElementById('tb-delete');
const tbFont         = document.getElementById('tb-font');
const tbFontSize     = document.getElementById('tb-fontsize');
const tbBold         = document.getElementById('tb-bold');
const tbItalic       = document.getElementById('tb-italic');
const tbTextColor    = document.getElementById('tb-text-color');
const dropOverlay    = document.getElementById('drop-overlay');

const MAX_IMAGES = 20;
const VIZ_Z      = 5;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getAccent() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--accent2').trim();
}

let audioCtx     = null;
let analyser     = null;
let gainNode     = null;
let sourceNode   = null;
let isPlaying    = false;
let isFocus      = false;
let animId       = null;
let hasAudio     = false;
let isLooping    = false;
let selectedItem = null;
let imgZTop      = 1;

function savePrefs() {
  localStorage.setItem('pandemonium', JSON.stringify({
    volume: volSlider.value,
    loop:   isLooping,
    accent: accentPicker.value
  }));
}

(function loadPrefs() {
  const saved = JSON.parse(localStorage.getItem('pandemonium') || '{}');
  if (saved.volume !== undefined) volSlider.value = saved.volume;
  if (saved.loop) {
    isLooping = true;
    audioPlayer.loop = true;
    btnLoop.classList.add('active');
  }
  if (saved.accent) {
    accentPicker.value = saved.accent;
    document.documentElement.style.setProperty('--accent2', saved.accent);
    document.documentElement.style.setProperty('--glow2', hexToRgba(saved.accent, 0.25));
  }
})();

const BAR_COUNT = 80;
const INNER_R   = 220;
const BAR_MAX_H = 160;
const RING_R    = 200;
const RING_W    = 7;
const WAVE_W    = 420;
const WAVE_H    = 52;

audioUpload.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  trackName.textContent = file.name.replace(/\.[^.]+$/, '');
  hasAudio = true;
  document.body.classList.add('has-audio');
  if (audioPlayer.src && audioPlayer.src.startsWith('blob:')) URL.revokeObjectURL(audioPlayer.src);
  audioPlayer.src = URL.createObjectURL(file);
  if (!audioCtx) {
    initAudioContext();
  } else {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  audioPlayer.play().then(() => setPlayState(true)).catch(() => {});
});

function initAudioContext() {
  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  gainNode   = audioCtx.createGain();
  analyser   = audioCtx.createAnalyser();
  sourceNode = audioCtx.createMediaElementSource(audioPlayer);
  sourceNode.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize               = 2048;
  analyser.smoothingTimeConstant = 0.82;
  gainNode.gain.value = parseFloat(volSlider.value);
  if (!animId) drawFrame();
}

document.addEventListener('click', () => {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});

function togglePlayPause() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (isPlaying) { audioPlayer.pause(); setPlayState(false); }
  else           { audioPlayer.play();  setPlayState(true);  }
}

function restartTrack() {
  if (!audioPlayer.src) return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  audioPlayer.currentTime = 0;
  audioPlayer.play().then(() => setPlayState(true)).catch(() => {});
}

btnPlay.addEventListener('click', togglePlayPause);
btnRestart.addEventListener('click', restartTrack);
btnLoop.addEventListener('click', toggleLoop);
audioPlayer.addEventListener('ended', () => setPlayState(false));

function toggleLoop() {
  isLooping = !isLooping;
  audioPlayer.loop = isLooping;
  btnLoop.classList.toggle('active', isLooping);
  savePrefs();
}

accentPicker.addEventListener('input', () => {
  const hex = accentPicker.value;
  document.documentElement.style.setProperty('--accent2', hex);
  document.documentElement.style.setProperty('--glow2', hexToRgba(hex, 0.25));
  savePrefs();
});

function setPlayState(playing) {
  isPlaying = playing;
  iconPlay.style.display  = playing ? 'none' : '';
  iconPause.style.display = playing ? '' : 'none';
  btnPlay.classList.toggle('active', playing);
}

volSlider.addEventListener('input', () => {
  if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
  savePrefs();
});

function formatTime(s) {
  if (isNaN(s) || s < 0) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function seekFromAngle(angle) {
  const pct = angle / (Math.PI * 2);
  if (audioPlayer.duration) audioPlayer.currentTime = pct * audioPlayer.duration;
}

function getCenter() {
  const rect = workspace.getBoundingClientRect();
  return { cx: rect.width / 3, cy: rect.height / 2 };
}

function getAngleFromEvent(e) {
  const rect = workspace.getBoundingClientRect();
  const px   = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
  const py   = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
  const { cx, cy } = getCenter();
  let angle = Math.atan2(py - cy, px - cx) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  return angle;
}

function isNearRing(e) {
  const rect = workspace.getBoundingClientRect();
  const px   = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
  const py   = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
  const { cx, cy } = getCenter();
  return Math.abs(Math.hypot(px - cx, py - cy) - RING_R) < 20;
}

document.addEventListener('mousedown', e => {
  const inWorkspace = workspace.contains(e.target);
  if (inWorkspace && hasAudio && isNearRing(e)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    seekDragging = true;
    seekFromAngle(getAngleFromEvent(e));
    return;
  }
  if (inWorkspace && selectedItem && selectedItem.classList.contains('editing') && !selectedItem.contains(e.target)) {
    stopEditing(selectedItem);
  }
  if (inWorkspace && !e.target.classList.contains('workspace-img') && !e.target.classList.contains('workspace-text') && !itemToolbar.contains(e.target)) {
    selectItem(null);
  }
}, true);

document.addEventListener('mousemove', e => {
  if (seekDragging) {
    seekFromAngle(getAngleFromEvent(e));
    return;
  }
  if (!workspace.contains(e.target) && e.target !== workspace) {
    workspace.classList.remove('cursor-ring');
    return;
  }
  if (hasAudio && isNearRing(e)) {
    workspace.classList.add('cursor-ring');
  } else {
    workspace.classList.remove('cursor-ring');
  }
});

document.addEventListener('mouseup', () => { seekDragging = false; });

workspace.addEventListener('touchstart', e => {
  if (!hasAudio || !isNearRing(e)) return;
  seekDragging = true;
  seekFromAngle(getAngleFromEvent(e));
}, { passive: true });
workspace.addEventListener('touchmove', e => {
  if (!seekDragging) return;
  seekFromAngle(getAngleFromEvent(e));
}, { passive: true });
workspace.addEventListener('touchend', () => { seekDragging = false; });

function drawFrame() {
  animId = requestAnimationFrame(drawFrame);

  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const wPx  = Math.round(rect.width  * dpr);
  const hPx  = Math.round(rect.height * dpr);
  if (canvas.width !== wPx || canvas.height !== hPx) {
    canvas.width        = wPx;
    canvas.height       = hPx;
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
  }

  const W  = rect.width;
  const H  = rect.height;
  const CX = W / 3;
  const CY = H / 2;

  ctx.clearRect(0, 0, W, H);
  if (!hasAudio) return;

  let freqData = new Uint8Array(analyser ? analyser.frequencyBinCount : 1);
  let waveData = new Uint8Array(analyser ? analyser.frequencyBinCount : 1);
  if (analyser) {
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(waveData);
  }

  const angleStep = (Math.PI * 2) / BAR_COUNT;
  const gap       = 0.018;
  const binCount  = freqData.length;

  for (let i = 0; i < BAR_COUNT; i++) {
    const angle    = i * angleStep - Math.PI / 2;
    const bin      = Math.floor(Math.pow(i / BAR_COUNT, 1.4) * (binCount * 0.75));
    const val      = freqData[Math.min(bin, binCount - 1)];
    const barH     = (val / 255) * BAR_MAX_H + 2;
    const outerR   = INNER_R + barH;
    const halfSpan = (angleStep / 2) - gap;
    const a1       = angle - halfSpan;
    const a2       = angle + halfSpan;

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, outerR, a1, a2);
    ctx.arc(CX, CY, INNER_R, a2, a1, true);
    ctx.closePath();
    ctx.fillStyle   = hexToRgba(getAccent(), 0.4 + (val / 255) * 0.55);
    ctx.shadowColor = hexToRgba(getAccent(), 0.5);
    ctx.shadowBlur  = 6 + (val / 255) * 10;
    ctx.fill();
    ctx.restore();
  }

  const progress = (audioPlayer.duration && !isNaN(audioPlayer.duration))
    ? audioPlayer.currentTime / audioPlayer.duration : 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, RING_R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(42,42,58,0.9)';
  ctx.lineWidth   = RING_W;
  ctx.stroke();
  ctx.restore();

  if (progress > 0) {
    const startA = -Math.PI / 2;
    const endA   = startA + progress * Math.PI * 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, RING_R, startA, endA);
    ctx.strokeStyle = getAccent();
    ctx.lineWidth   = RING_W;
    ctx.lineCap     = 'round';
    ctx.shadowColor = hexToRgba(getAccent(), 0.7);
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const endA2 = startA + progress * Math.PI * 2;
    const dotX  = CX + Math.cos(endA2) * RING_R;
    const dotY  = CY + Math.sin(endA2) * RING_R;
    ctx.beginPath();
    ctx.arc(dotX, dotY, RING_W * 0.9, 0, Math.PI * 2);
    ctx.fillStyle   = getAccent();
    ctx.shadowColor = hexToRgba(getAccent(), 0.9);
    ctx.shadowBlur  = 14;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `600 20px 'Share Tech Mono', monospace`;
  ctx.fillStyle    = getAccent();
  ctx.shadowColor  = hexToRgba(getAccent(), 0.6);
  ctx.shadowBlur   = 10;
  ctx.fillText(formatTime(audioPlayer.currentTime), CX, CY - 10);
  ctx.font         = `300 10px 'Share Tech Mono', monospace`;
  ctx.fillStyle    = 'rgba(90,88,112,0.9)';
  ctx.shadowBlur   = 0;
  ctx.fillText('────', CX, CY + 3);
  ctx.font         = `12px 'Share Tech Mono', monospace`;
  ctx.fillStyle    = '#5a5870';
  ctx.fillText(formatTime(audioPlayer.duration), CX, CY + 18);
  ctx.restore();

  const waveLeft = CX + INNER_R + BAR_MAX_H + 32;
  const waveMidY = CY;
  const waveTop  = waveMidY - WAVE_H / 2;
  const step     = WAVE_W / waveData.length;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(waveLeft - 4, waveTop - 4, WAVE_W + 8, WAVE_H + 8, 6);
  ctx.strokeStyle = 'rgba(42,42,58,0.5)';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.restore();

  const waveGrad = ctx.createLinearGradient(waveLeft, 0, waveLeft + WAVE_W, 0);
  waveGrad.addColorStop(0,   hexToRgba(getAccent(), 0.0));
  waveGrad.addColorStop(0.2, hexToRgba(getAccent(), 0.6));
  waveGrad.addColorStop(0.5, hexToRgba(getAccent(), 0.85));
  waveGrad.addColorStop(0.8, hexToRgba(getAccent(), 0.6));
  waveGrad.addColorStop(1,   hexToRgba(getAccent(), 0.0));

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < waveData.length; i++) {
    const v = (waveData[i] / 128.0) - 1;
    const x = waveLeft + i * step;
    const y = waveMidY + v * (WAVE_H / 2 - 4);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = waveGrad;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = hexToRgba(getAccent(), 0.5);
  ctx.shadowBlur  = 6;
  ctx.stroke();
  ctx.restore();
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

function applyFlip(el) {
  const tx = parseFloat(el.getAttribute('data-x')) || 0;
  const ty = parseFloat(el.getAttribute('data-y')) || 0;
  const sx = el.dataset.flipH === '1' ? -1 : 1;
  const sy = el.dataset.flipV === '1' ? -1 : 1;
  el.style.transform = `translate(${tx}px,${ty}px) scale(${sx},${sy})`;
}

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

tbDelete.addEventListener('click', deleteSelectedItem);

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

let dragCounter = 0;

workspace.addEventListener('dragenter', e => {
  if (!e.dataTransfer.types.includes('Files')) return;
  dragCounter++;
  dropOverlay.classList.add('active');
});
workspace.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('active'); }
});
workspace.addEventListener('dragover', e => { e.preventDefault(); });
workspace.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');
  const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('audio/'));
  if (!file) return;
  trackName.textContent = file.name.replace(/\.[^.]+$/, '');
  hasAudio = true;
  document.body.classList.add('has-audio');
  if (audioPlayer.src && audioPlayer.src.startsWith('blob:')) URL.revokeObjectURL(audioPlayer.src);
  audioPlayer.src = URL.createObjectURL(file);
  if (!audioCtx) { initAudioContext(); } else { if (audioCtx.state === 'suspended') audioCtx.resume(); }
  audioPlayer.play().then(() => setPlayState(true)).catch(() => {});
});

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

function isPointerNearRing(pointerEvent) {
  return hasAudio && isNearRing(pointerEvent);
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

  // Images get manual resize handles; text elements auto-size to their content
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

function bringToFront(el) {
  imgZTop++;
  el.style.zIndex = imgZTop;
}

document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  const isEditing = selectedItem && selectedItem.classList.contains('editing');
  if (isEditing) {
    if (e.key === 'Escape') { e.preventDefault(); stopEditing(selectedItem); }
    return;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  switch (e.key) {
    case ' ':
    case 'Spacebar':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'r':
    case 'R':
      restartTrack();
      break;
    case 'f':
    case 'F':
      isFocus = !isFocus;
      document.body.classList.toggle('focus-mode', isFocus);
      break;
    case 'l':
    case 'L':
      toggleLoop();
      break;
    case 'Delete':
    case 'Backspace':
      deleteSelectedItem();
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      if (audioPlayer.duration) audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      if (audioPlayer.duration) audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 5);
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault();
      volSlider.value = Math.min(1, parseFloat(volSlider.value) + 0.05).toFixed(2);
      if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      volSlider.value = Math.max(0, parseFloat(volSlider.value) - 0.05).toFixed(2);
      if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
      break;
  }
});

window.addEventListener('resize', () => {
  canvas.width  = 0;
  canvas.height = 0;
});

drawFrame();