import './tiny-chat-audio-player.css';

const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const AUDIO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
const ERROR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>';
const BAR_COUNT = 46;
const enhanced = new WeakSet();
const players = new Set();

function formatTime(value) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function fallbackPeaks() {
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const a = Math.sin(index * 0.72) * 0.18;
    const b = Math.sin(index * 0.23 + 1.7) * 0.12;
    return Math.max(0.18, Math.min(1, 0.5 + a + b + ((index * 17) % 9) / 30));
  });
}

function renderBars(node, peaks = fallbackPeaks()) {
  node.innerHTML = peaks.map((peak, index) => `<span data-bar="${index}" style="--wave:${Math.max(.12, Math.min(1, peak)).toFixed(3)}"></span>`).join('');
}

async function decodeWaveform(src) {
  const response = await fetch(src, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio API unavailable');
  const context = new AudioContextCtor();
  try {
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks = [];
    let max = 0;
    for (let index = 0; index < BAR_COUNT; index += 1) {
      const start = index * block;
      const end = Math.min(channel.length, start + block);
      let peak = 0;
      for (let sample = start; sample < end; sample += Math.max(1, Math.floor(block / 180))) {
        peak = Math.max(peak, Math.abs(channel[sample] || 0));
      }
      peaks.push(peak);
      max = Math.max(max, peak);
    }
    return peaks.map((peak) => max ? Math.max(.12, peak / max) : .22);
  } finally {
    context.close?.().catch?.(() => {});
  }
}

function pauseOtherPlayers(current) {
  for (const item of players) {
    if (item !== current && !item.audio.paused) item.audio.pause();
  }
}

function setProgress(player) {
  const { audio, root, current, duration, waveform } = player;
  const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const now = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const ratio = total ? Math.max(0, Math.min(1, now / total)) : 0;
  root.style.setProperty('--audio-progress', `${ratio * 100}%`);
  waveform.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  current.textContent = formatTime(now);
  duration.textContent = formatTime(total);
}

function setPlayState(player) {
  const playing = !player.audio.paused && !player.audio.ended;
  player.root.classList.toggle('is-playing', playing);
  player.play.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  player.play.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio');
  player.play.setAttribute('title', playing ? 'Pause' : 'Play');
}

function seekFromPointer(player, event) {
  const rect = player.waveform.getBoundingClientRect();
  if (!rect.width || !Number.isFinite(player.audio.duration)) return;
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  player.audio.currentTime = ratio * player.audio.duration;
  setProgress(player);
}

function bindSeeking(player) {
  let dragging = false;
  player.waveform.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    player.waveform.setPointerCapture?.(event.pointerId);
    seekFromPointer(player, event);
  });
  player.waveform.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    seekFromPointer(player, event);
  });
  const stop = (event) => {
    if (!dragging) return;
    dragging = false;
    player.waveform.releasePointerCapture?.(event.pointerId);
  };
  player.waveform.addEventListener('pointerup', stop);
  player.waveform.addEventListener('pointercancel', stop);
  player.waveform.addEventListener('keydown', (event) => {
    if (!Number.isFinite(player.audio.duration)) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 5 : -5;
    player.audio.currentTime = Math.max(0, Math.min(player.audio.duration, player.audio.currentTime + delta));
    setProgress(player);
  });
}

async function enhanceAudio(audio) {
  if (!audio || enhanced.has(audio)) return;
  enhanced.add(audio);
  audio.classList.add('tiny-native-audio');
  audio.controls = false;
  audio.preload = 'metadata';

  const root = document.createElement('div');
  root.className = 'tiny-audio-message';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Audio message player');
  root.innerHTML = `
    <button type="button" class="tiny-audio-play" aria-label="Play audio" title="Play">${PLAY_ICON}</button>
    <div class="tiny-audio-main">
      <div class="tiny-audio-waveform" role="slider" tabindex="0" aria-label="Audio position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
      <div class="tiny-audio-meta">
        <span class="tiny-audio-current">0:00</span>
        <span class="tiny-audio-kind">${AUDIO_ICON}<b>${audio.closest('.message-bubble')?.querySelector('.file-chip') ? 'Audio file' : 'Voice message'}</b></span>
        <span class="tiny-audio-duration">0:00</span>
      </div>
    </div>
  `;
  audio.after(root);

  const player = {
    audio,
    root,
    play: root.querySelector('.tiny-audio-play'),
    waveform: root.querySelector('.tiny-audio-waveform'),
    current: root.querySelector('.tiny-audio-current'),
    duration: root.querySelector('.tiny-audio-duration'),
  };
  players.add(player);
  renderBars(player.waveform);
  bindSeeking(player);

  root.addEventListener('click', (event) => event.stopPropagation());
  root.addEventListener('pointerdown', (event) => event.stopPropagation());

  player.play.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (audio.paused || audio.ended) {
      pauseOtherPlayers(player);
      try {
        await audio.play();
      } catch (error) {
        root.classList.add('has-error');
        player.play.innerHTML = ERROR_ICON;
        player.play.setAttribute('aria-label', 'Audio could not be played');
        root.dataset.error = error?.message || 'Playback failed';
      }
    } else {
      audio.pause();
    }
  });

  const sync = () => { setPlayState(player); setProgress(player); };
  audio.addEventListener('loadedmetadata', sync);
  audio.addEventListener('durationchange', sync);
  audio.addEventListener('timeupdate', () => setProgress(player));
  audio.addEventListener('play', () => setPlayState(player));
  audio.addEventListener('pause', () => setPlayState(player));
  audio.addEventListener('ended', () => { audio.currentTime = 0; sync(); });
  audio.addEventListener('waiting', () => root.classList.add('is-buffering'));
  audio.addEventListener('playing', () => root.classList.remove('is-buffering'));
  audio.addEventListener('canplay', () => root.classList.remove('is-buffering'));
  audio.addEventListener('error', () => {
    root.classList.add('has-error');
    player.play.innerHTML = ERROR_ICON;
    player.play.setAttribute('aria-label', 'Audio unavailable');
  });

  sync();

  const src = audio.currentSrc || audio.src;
  if (src) {
    decodeWaveform(src)
      .then((peaks) => renderBars(player.waveform, peaks))
      .catch(() => renderBars(player.waveform));
  }
}

function enhanceAllAudio() {
  document.querySelectorAll('.message-bubble audio').forEach((audio) => enhanceAudio(audio));
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    enhanceAllAudio();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhanceAllAudio);
setTimeout(enhanceAllAudio, 300);
