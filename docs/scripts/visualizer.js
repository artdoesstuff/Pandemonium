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