const audioUpload = document.getElementById('audio-upload');
const imageUpload = document.getElementById('image-upload');
const audioPlayer = document.getElementById('audio-player');
const btnPlay     = document.getElementById('btn-play');
const btnRestart  = document.getElementById('btn-restart');
const iconPlay    = document.getElementById('icon-play');
const iconPause   = document.getElementById('icon-pause');
const volSlider   = document.getElementById('vol-slider');
const trackName   = document.getElementById('track-name');
const canvas      = document.getElementById('visualizer');
const workspace   = document.getElementById('workspace');
const ctx         = canvas.getContext('2d');

const MAX_IMAGES = 200;
const IMG_Z_MAX  = 4;
const VIZ_Z      = 5;

let audioCtx     = null;
let analyser     = null;
let gainNode     = null;
let sourceNode   = null;
let isPlaying    = false;
let isFocus      = false;
let animId       = null;
let hasAudio     = false;
let seekDragging = false;
let selectedImg  = null;
let imgZTop      = 1;

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
audioPlayer.addEventListener('ended', () => setPlayState(false));

function setPlayState(playing) {
  isPlaying = playing;
  iconPlay.style.display  = playing ? 'none' : '';
  iconPause.style.display = playing ? '' : 'none';
  btnPlay.classList.toggle('active', playing);
}

volSlider.addEventListener('input', () => {
  if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
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

workspace.addEventListener('mousedown', e => {
  if (e.target.classList.contains('workspace-img')) return;
  selectImage(null);
  if (!hasAudio || !isNearRing(e)) return;
  seekDragging = true;
  seekFromAngle(getAngleFromEvent(e));
});
workspace.addEventListener('mousemove', e => {
  if (!seekDragging) return;
  seekFromAngle(getAngleFromEvent(e));
});
workspace.addEventListener('mouseup',    () => { seekDragging = false; });
workspace.addEventListener('mouseleave', () => { seekDragging = false; });

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
    ctx.fillStyle   = `rgba(244,114,182,${0.4 + (val / 255) * 0.55})`;
    ctx.shadowColor = 'rgba(244,114,182,0.5)';
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
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth   = RING_W;
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(244,114,182,0.7)';
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const endA2 = startA + progress * Math.PI * 2;
    const dotX  = CX + Math.cos(endA2) * RING_R;
    const dotY  = CY + Math.sin(endA2) * RING_R;
    ctx.beginPath();
    ctx.arc(dotX, dotY, RING_W * 0.9, 0, Math.PI * 2);
    ctx.fillStyle   = '#f9a8d4';
    ctx.shadowColor = 'rgba(244,114,182,0.9)';
    ctx.shadowBlur  = 14;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `600 20px 'Share Tech Mono', monospace`;
  ctx.fillStyle    = '#f472b6';
  ctx.shadowColor  = 'rgba(244,114,182,0.6)';
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
  waveGrad.addColorStop(0,   'rgba(244,114,182,0.0)');
  waveGrad.addColorStop(0.2, 'rgba(244,114,182,0.6)');
  waveGrad.addColorStop(0.5, 'rgba(244,114,182,0.85)');
  waveGrad.addColorStop(0.8, 'rgba(244,114,182,0.6)');
  waveGrad.addColorStop(1,   'rgba(244,114,182,0.0)');

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
  ctx.shadowColor = 'rgba(244,114,182,0.5)';
  ctx.shadowBlur  = 6;
  ctx.stroke();
  ctx.restore();
}

function selectImage(img) {
  if (selectedImg && selectedImg !== img) {
    selectedImg.classList.remove('selected');
  }
  selectedImg = img;
  if (img) img.classList.add('selected');
}

function deleteSelectedImage() {
  if (!selectedImg) return;
  URL.revokeObjectURL(selectedImg.src);
  selectedImg.remove();
  selectedImg = null;
}

imageUpload.addEventListener('change', e => {
  const existing = workspace.querySelectorAll('.workspace-img').length;
  const files    = Array.from(e.target.files).slice(0, MAX_IMAGES - existing);

  files.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src       = url;
    img.className = 'workspace-img';
    img.style.left = (60 + idx * 30) + 'px';
    img.style.top  = (60 + idx * 20) + 'px';
    img.style.width  = '220px';
    img.style.height = 'auto';

    imgZTop = Math.min(imgZTop + 1, IMG_Z_MAX);
    img.style.zIndex = imgZTop;

    img.addEventListener('mousedown', () => selectImage(img));

    workspace.insertBefore(img, canvas);
    setupInteract(img);
  });
  e.target.value = '';
});

function setupInteract(el) {
  interact(el)
    .draggable({
      inertia: true,
      modifiers: [interact.modifiers.restrictRect({ restriction: '#workspace', endOnly: false })],
      listeners: {
        start() { bringToFront(el); selectImage(el); },
        move(event) {
          const x = (parseFloat(el.getAttribute('data-x')) || 0) + event.dx;
          const y = (parseFloat(el.getAttribute('data-y')) || 0) + event.dy;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.setAttribute('data-x', x);
          el.setAttribute('data-y', y);
        }
      }
    })
    .resizable({
      edges: { left: true, right: true, top: true, bottom: true },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 40, height: 40 } })],
      listeners: {
        start() { selectImage(el); },
        move(event) {
          el.style.width  = event.rect.width  + 'px';
          el.style.height = event.rect.height + 'px';
          const x = (parseFloat(el.getAttribute('data-x')) || 0) + event.deltaRect.left;
          const y = (parseFloat(el.getAttribute('data-y')) || 0) + event.deltaRect.top;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.setAttribute('data-x', x);
          el.setAttribute('data-y', y);
        }
      }
    });
}

function bringToFront(el) {
  imgZTop = Math.min(imgZTop + 1, IMG_Z_MAX);
  el.style.zIndex = imgZTop;
}

document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
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
    case 'Delete':
    case 'Backspace':
      deleteSelectedImage();
      break;
  }
});

window.addEventListener('resize', () => {
  canvas.width  = 0;
  canvas.height = 0;
});

drawFrame();