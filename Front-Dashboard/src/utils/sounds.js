// Web Audio API - generador de tonos sin archivos externos
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

// Sonido de nuevo lead (tono agradable, doble beep)
export function playNuevoLead() {
  try {
    const c = getCtx();
    [0, 0.15].forEach(delay => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.12);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + 0.12);
    });
  } catch (e) { console.warn('Audio no disponible:', e); }
}

// Sonido de venta efectiva (fanfarria festiva)
export function playVentaEfectiva() {
  try {
    const c = getCtx();
    // Melodía ascendente: Do - Mi - Sol - Do alta
    const notas = [
      { freq: 523, delay: 0,    dur: 0.15 },
      { freq: 659, delay: 0.16, dur: 0.15 },
      { freq: 784, delay: 0.32, dur: 0.15 },
      { freq: 1047, delay: 0.48, dur: 0.35 },
    ];
    notas.forEach(({ freq, delay, dur }) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + dur);
    });
  } catch (e) { console.warn('Audio no disponible:', e); }
}

// Sonido de alerta SLA (tono urgente, más grave)
export function playAlertaSLA() {
  try {
    const c = getCtx();
    [0, 0.2, 0.4].forEach(delay => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.25, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.15);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + 0.15);
    });
  } catch (e) { console.warn('Audio no disponible:', e); }
}
