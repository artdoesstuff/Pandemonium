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

const BAR_COUNT = 80;
const INNER_R   = 220;
const BAR_MAX_H = 160;
const RING_R    = 200;
const RING_W    = 7;
const WAVE_W    = 420;
const WAVE_H    = 52;

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
let seekDragging = false;

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
