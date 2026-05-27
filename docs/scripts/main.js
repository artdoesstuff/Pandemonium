document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  const isEditing = selectedItem && selectedItem.classList.contains('editing');
  if (isEditing) {
    if (e.key === 'Escape') { e.preventDefault(); stopEditing(selectedItem); }
    return;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  switch (e.key) {
    case ' ': case 'Spacebar':
      e.preventDefault(); togglePlayPause(); break;
    case 'r': case 'R':
      restartTrack(); break;
    case 'q': case 'Q':
      queuePanel.classList.toggle('visible');
      btnQueue.classList.toggle('active', queuePanel.classList.contains('visible'));
      break;
    case 'f': case 'F':
      isFocus = !isFocus;
      document.body.classList.toggle('focus-mode', isFocus); break;
    case 'l': case 'L':
      toggleLoop(); break;
    case 'Delete': case 'Backspace':
      deleteSelectedItem(); break;
    case 'ArrowLeft': case 'a': case 'A':
      e.preventDefault();
      if (audioPlayer.duration) audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
      break;
    case 'ArrowRight': case 'd': case 'D':
      e.preventDefault();
      if (audioPlayer.duration) audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 5);
      break;
    case 'ArrowUp': case 'w': case 'W':
      e.preventDefault();
      volSlider.value = Math.min(1, parseFloat(volSlider.value) + 0.05).toFixed(2);
      if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
      break;
    case 'ArrowDown': case 's': case 'S':
      e.preventDefault();
      volSlider.value = Math.max(0, parseFloat(volSlider.value) - 0.05).toFixed(2);
      if (gainNode) gainNode.gain.value = parseFloat(volSlider.value);
      break;
  }
});

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
  if (file) loadAudioFile(file);
});

window.addEventListener('resize', () => {
  canvas.width  = 0;
  canvas.height = 0;
});

drawFrame();
loadSavedQueue();
loadSavedImages();
loadSavedTexts();