import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

interface CalmState {
  rainOn: boolean;
  setRainOn: (on: boolean) => void;
}

export const useCalmStore = create<CalmState>((set) => ({
  rainOn: false,
  setRainOn: (rainOn) => set({ rainOn }),
}));

/**
 * "Calming sounds" toggle — a very quiet distant-leaves noise bed, ported from
 * the prototype's WebAudio graph. Web only; a no-op visual toggle on native.
 */
export function useCalmSound() {
  const rainOn = useCalmStore((s) => s.rainOn);
  const setRainOn = useCalmStore((s) => s.setRainOn);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ src?: AudioBufferSourceNode; lfo?: OscillatorNode }>({});

  const toggle = useCallback(() => {
    if (Platform.OS !== 'web') {
      setRainOn(!rainOn);
      return;
    }
    if (rainOn) {
      try {
        nodesRef.current.src?.stop();
        nodesRef.current.lfo?.stop();
      } catch {}
      ctxRef.current?.close();
      ctxRef.current = null;
      nodesRef.current = {};
      setRainOn(false);
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + 3);
    const len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.25;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 350;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.Q.value = 0.3;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.09;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(bedGain);
    bedGain.connect(master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(bedGain.gain);
    lfo.start();
    src.start();
    ctxRef.current = ctx;
    nodesRef.current = { src, lfo };
    setRainOn(true);
  }, [rainOn, setRainOn]);

  return { rainOn, toggle };
}
