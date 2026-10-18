let ctx: AudioContext | null = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime)
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration)
}

export function playWorkComplete() {
  // Ascending three-note chime
  playTone(523, 0.15, 'sine', 0.25)
  setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 150)
  setTimeout(() => playTone(784, 0.35, 'sine', 0.25), 300)
}

export function playBreakComplete() {
  // Descending two-note
  playTone(440, 0.2, 'sine', 0.2)
  setTimeout(() => playTone(349, 0.35, 'sine', 0.2), 200)
}

export function playStart() {
  playTone(600, 0.1, 'sine', 0.15)
  setTimeout(() => playTone(800, 0.1, 'sine', 0.15), 100)
}
