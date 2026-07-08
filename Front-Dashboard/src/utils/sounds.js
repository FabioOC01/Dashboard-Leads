// Web Audio API 
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

export function playNuevoLead(vendedorNombre = '') {
  try {
    const SoundsMap = {
      'erimay': '/sounds/erimay.mp3',
      'sthefania': '/sounds/sthefania.mp3',
      'estefany': '/sounds/estefany.wav'
    };

    const asName = vendedorNombre.toLowerCase();
    let urlToPlay = null;

    if (asName.includes('erimay')) urlToPlay = SoundsMap['erimay'];
    else if (asName.includes('sthefania') || asName.includes('stefania')) urlToPlay = SoundsMap['sthefania'];
    else if (asName.includes('estefany') || asName.includes('stephany')) urlToPlay = SoundsMap['estefany'];

    if (urlToPlay) {
      const audio = new Audio(urlToPlay);
      audio.volume = (asName.includes('sthefania') || asName.includes('stefania')) ? 0.1 : 0.5;
      audio.play().catch(e => console.warn('Bloqueado por el navegador:', e));
      return;
    }

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
  } catch (e) {
    console.warn('Audio no disponible:', e);
  }
}

// Sonido de venta efectiva (dos archivos en secuencia)
export function playVentaEfectiva() {
  try {
    const sounds = [
      '/sounds/venta1.wav',
      '/sounds/venta2.wav',
    ];
    const url = sounds[Math.random() < 0.5 ? 0 : 1];
    const a1 = new Audio(url);
    a1.volume = 0.5;
    a1.play().catch(e => console.warn('Bloqueado por el navegador:', e));
  } catch (e) {
    console.warn('Audio no disponible:', e);
  }
}

// Sonido de alerta SLA (archivo WAV externo)
export function playAlertaSLA() {
  try {
    const audio = new Audio('/sounds/sla.wav');
    audio.volume = 0.3;
    audio.play().catch(e => console.warn('Bloqueado por el navegador:', e));
  } catch (e) {
    console.warn('Audio no disponible:', e);
  }
}

// ── Sonido de inicio de jornada ──
export function playInicioJornada() {
  try {
    const audio = new Audio('/sounds/inicio.wav');
    audio.volume = 0.6;
    audio.play().catch(e => console.warn('Bloqueado por el navegador:', e));
  } catch (e) { console.warn('Audio inicio jornada no disponible:', e); }
}

// ── Sonido de fin de jornada ──
export function playFinJornada() {
  try {
    const audio = new Audio('/sounds/fin.wav');
    audio.volume = 0.5;
    audio.play().catch(e => console.warn('Bloqueado por el navegador:', e));
  } catch (e) { console.warn('Audio fin jornada no disponible:', e); }
}
