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
audioPlayer.addEventListener('ended', () => setPlayState(false));

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
}

audioUpload.addEventListener('change', e => loadAudioFile(e.target.files[0]));

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
  if (seekDragging) {
    seekFromAngle(getAngleFromEvent(e));
    return;
  }
  if (!workspace.contains(e.target) && e.target !== workspace) {
    workspace.classList.remove('cursor-ring');
    return;
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