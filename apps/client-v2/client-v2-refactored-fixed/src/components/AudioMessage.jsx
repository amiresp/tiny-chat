import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { getToken } from '../api';

const BAR_COUNT = 34;
const fallback = Array.from({ length: BAR_COUNT }, (_, i) => 0.26 + (((i * 17) % 19) / 28));
const waveformCache = new Map();

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function decodeWaveform(src, signal) {
  if (waveformCache.has(src)) return waveformCache.get(src);
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(src, { headers, signal });
  if (!response.ok) throw new Error(`Audio fetch failed (${response.status})`);
  const buffer = await response.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return fallback;
  const context = new AudioContextClass();
  try {
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks = Array.from({ length: BAR_COUNT }, (_, index) => {
      const start = index * block;
      const end = Math.min(channel.length, start + block);
      let max = 0;
      const step = Math.max(1, Math.floor(block / 160));
      for (let sample = start; sample < end; sample += step) max = Math.max(max, Math.abs(channel[sample] || 0));
      return Math.max(0.14, Math.min(1, max * 2.6));
    });
    waveformCache.set(src, peaks);
    return peaks;
  } finally {
    context.close?.().catch?.(() => {});
  }
}

export function AudioMessage({ src, label = 'Voice message' }) {
  const rootRef = useRef(null);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [decodedPeaks, setDecodedPeaks] = useState(null);
  const peaks = useMemo(() => decodedPeaks || fallback, [decodedPeaks]);

  useEffect(() => {
    const pause = (event) => { if (event.detail !== audioRef.current) audioRef.current?.pause(); };
    window.addEventListener('tiny-chat:audio-play', pause);
    return () => window.removeEventListener('tiny-chat:audio-play', pause);
  }, []);

  useEffect(() => {
    if (!src || !rootRef.current || waveformCache.has(src)) {
      if (waveformCache.has(src)) setDecodedPeaks(waveformCache.get(src));
      return undefined;
    }
    const controller = new AbortController();
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      decodeWaveform(src, controller.signal).then(setDecodedPeaks).catch(() => {});
    };
    if (!('IntersectionObserver' in window)) start();
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer.disconnect(); }
    }, { rootMargin: '180px' }) : null;
    observer?.observe(rootRef.current);
    return () => { observer?.disconnect(); controller.abort(); };
  }, [src]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent('tiny-chat:audio-play', { detail: audio }));
      try { await audio.play(); } catch {}
    } else audio.pause();
  }

  function seekRatio(ratio) {
    if (!duration || !audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
  }

  function seek(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    seekRatio((event.clientX - rect.left) / rect.width);
  }

  function keyboardSeek(event) {
    if (!duration) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -5 : 5;
      audioRef.current.currentTime = Math.max(0, Math.min(duration, (audioRef.current.currentTime || 0) + delta));
    }
    if (event.key === 'Home') { event.preventDefault(); seekRatio(0); }
    if (event.key === 'End') { event.preventDefault(); seekRatio(1); }
  }

  const ratio = duration > 0 ? current / duration : 0;
  return <div ref={rootRef} className="tiny-audio-message" onClick={(e) => e.stopPropagation()}>
    <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)} onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setCurrent(0); }} />
    <button type="button" className="tiny-audio-play" onClick={toggle} aria-label={playing ? 'Pause audio' : 'Play audio'}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
    <div className="tiny-audio-main">
      <div className="tiny-audio-waveform" onPointerDown={seek} onKeyDown={keyboardSeek} role="slider" tabIndex={0} aria-label="Audio position" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(ratio * 100)}>
        {peaks.map((peak, index) => <i key={index} className={(index + 1) / BAR_COUNT <= ratio ? 'played' : ''} style={{ '--peak': peak }} />)}
      </div>
      <div className="tiny-audio-meta"><span>{formatTime(current)}</span><b>{label}</b><span>{formatTime(duration)}</span></div>
    </div>
  </div>;
}
