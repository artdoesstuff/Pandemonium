function savePrefs() {
  localStorage.setItem('pandemonium', JSON.stringify({
    volume:     volSlider.value,
    loop:       isLooping,
    accent:     accentPicker.value,
    queueIndex: queueIndex
  }));
}

function saveQueueMeta() {
  localStorage.setItem('pandemonium_queue', JSON.stringify(
    queue.map(t => ({ id: t.id, name: t.name }))
  ));
}

function saveWorkspaceMeta() {
  const texts = [];
  workspace.querySelectorAll('.workspace-text').forEach(el => {
    texts.push({
      text:     el.textContent,
      font:     el.dataset.font,
      fontSize: el.dataset.fontSize,
      bold:     el.dataset.bold,
      italic:   el.dataset.italic,
      color:    el.dataset.color,
      opacity:  el.style.opacity || '1',
      x:        el.getAttribute('data-x') || '0',
      y:        el.getAttribute('data-y') || '0',
      flipH:    el.dataset.flipH || '0',
      flipV:    el.dataset.flipV || '0',
      zIndex:   el.style.zIndex || '1'
    });
  });
  localStorage.setItem('pandemonium_texts', JSON.stringify(texts));
}

async function saveImageToDb(id, blob, meta) {
  await dbPut('images', id, { id, blob, ...meta });
}

async function loadSavedImages() {
  const images = await dbGetAll('images').catch(() => []);
  for (const entry of images) {
    const url = URL.createObjectURL(entry.blob);
    spawnImage(url, entry);
  }
}

async function loadSavedTexts() {
  const raw = localStorage.getItem('pandemonium_texts');
  if (!raw) return;
  JSON.parse(raw).forEach(t => spawnText(t));
}

async function loadSavedQueue() {
  const metaRaw = localStorage.getItem('pandemonium_queue');
  if (!metaRaw) return;
  const meta = JSON.parse(metaRaw);
  if (!meta.length) return;

  const blobs = await dbGetAll('queue').catch(() => []);
  const blobMap = Object.fromEntries(blobs.map(b => [b.id, b.blob]));

  for (const m of meta) {
    if (!blobMap[m.id]) continue;
    queue.push({ id: m.id, name: m.name, blob: blobMap[m.id] });
  }

  if (!queue.length) return;

  const saved    = JSON.parse(localStorage.getItem('pandemonium') || '{}');
  const startIdx = Math.min(saved.queueIndex ?? 0, queue.length - 1);
  renderQueueList();
  loadQueueTrack(startIdx, false);
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

function setPlayState(playing) {
  isPlaying = playing;
  iconPlay.style.display  = playing ? 'none' : '';
  iconPause.style.display = playing ? '' : 'none';
  btnPlay.classList.toggle('active', playing);
}

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

function toggleLoop() {
  isLooping = !isLooping;
  audioPlayer.loop = isLooping;
  btnLoop.classList.toggle('active', isLooping);
  savePrefs();
}

btnPlay.addEventListener('click', togglePlayPause);
btnRestart.addEventListener('click', restartTrack);
btnLoop.addEventListener('click', toggleLoop);

audioPlayer.addEventListener('ended', () => {
  if (isLooping) return;
  if (queueIndex < queue.length - 1) {
    loadQueueTrack(queueIndex + 1, true);
  } else if (queue.length > 1) {
    loadQueueTrack(0, true);
  } else {
    setPlayState(false);
  }
});

btnPrev.addEventListener('click', () => {
  if (queueIndex > 0) loadQueueTrack(queueIndex - 1, true);
});

btnNext.addEventListener('click', () => {
  if (queueIndex < queue.length - 1) loadQueueTrack(queueIndex + 1, true);
});

volSlider.addEventListener('input', () => {
  if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
  savePrefs();
});

accentPicker.addEventListener('input', () => {
  const hex = accentPicker.value;
  document.documentElement.style.setProperty('--accent2', hex);
  document.documentElement.style.setProperty('--glow2', hexToRgba(hex, 0.25));
  savePrefs();
});

function loadAudioFile(file) {
  if (!file) return;
  const id   = 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const name = file.name.replace(/\.[^.]+$/, '');
  const blob = file;

  queue.push({ id, name, blob });
  dbPut('queue', id, { id, blob });
  saveQueueMeta();
  renderQueueList();
  loadQueueTrack(queue.length - 1, true);
}

function loadQueueTrack(index, autoPlay) {
  if (index < 0 || index >= queue.length) return;
  queueIndex = index;
  savePrefs();

  const track = queue[index];
  trackName.textContent = track.name;
  hasAudio = true;
  document.body.classList.add('has-audio');
  if (audioPlayer.src && audioPlayer.src.startsWith('blob:')) URL.revokeObjectURL(audioPlayer.src);
  audioPlayer.src = URL.createObjectURL(track.blob);

  if (!audioCtx) {
    initAudioContext();
  } else {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  if (autoPlay) {
    audioPlayer.play().then(() => setPlayState(true)).catch(() => {});
  }

  renderQueueList();
  updateNavButtons();
}

function updateNavButtons() {
  btnPrev.disabled = queueIndex <= 0;
  btnNext.disabled = queueIndex >= queue.length - 1;
  btnPrev.classList.toggle('disabled', btnPrev.disabled);
  btnNext.classList.toggle('disabled', btnNext.disabled);
}

function renderQueueList() {
  queueList.innerHTML = '';
  queue.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item' + (i === queueIndex ? ' active' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className   = 'queue-item-name';
    nameSpan.textContent = track.name;
    nameSpan.addEventListener('click', () => loadQueueTrack(i, true));

    const delBtn = document.createElement('button');
    delBtn.className   = 'queue-item-del';
    delBtn.textContent = '×';
    delBtn.title       = 'Remove from queue';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      removeFromQueue(i);
    });

    li.append(nameSpan, delBtn);
    queueList.appendChild(li);
  });
}

function removeFromQueue(index) {
  const track = queue[index];
  dbDelete('queue', track.id);
  queue.splice(index, 1);
  saveQueueMeta();

  if (queue.length === 0) {
    queueIndex = -1;
    audioPlayer.src = '';
    trackName.textContent = '— no track loaded —';
    hasAudio = false;
    document.body.classList.remove('has-audio');
    setPlayState(false);
  } else if (index === queueIndex) {
    const next = Math.min(index, queue.length - 1);
    loadQueueTrack(next, false);
  } else if (index < queueIndex) {
    queueIndex--;
    savePrefs();
    renderQueueList();
    updateNavButtons();
  } else {
    renderQueueList();
    updateNavButtons();
  }
}

btnQueue.addEventListener('click', () => {
  queuePanel.classList.toggle('visible');
  btnQueue.classList.toggle('active', queuePanel.classList.contains('visible'));
});

audioUpload.addEventListener('change', e => {
  Array.from(e.target.files).forEach(f => loadAudioFile(f));
  e.target.value = '';
});

document.getElementById('audio-upload-queue').addEventListener('change', e => {
  Array.from(e.target.files).forEach(f => loadAudioFile(f));
  e.target.value = '';
});

function formatTime(s) {
  if (isNaN(s) || s < 0) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
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

function seekFromAngle(angle) {
  const pct = angle / (Math.PI * 2);
  if (audioPlayer.duration) audioPlayer.currentTime = pct * audioPlayer.duration;
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
  if (seekDragging) { seekFromAngle(getAngleFromEvent(e)); return; }
  if (!workspace.contains(e.target) && e.target !== workspace) {
    workspace.classList.remove('cursor-ring'); return;
  }
  workspace.classList.toggle('cursor-ring', hasAudio && isNearRing(e));
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