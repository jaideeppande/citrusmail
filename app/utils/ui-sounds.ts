// The app's own sounds: a few soft notes made on the spot when something
// you did has happened. Off unless turned on in Settings → Notifications
export type UiSound = 'send' | 'archive' | 'snooze' | 'undo' | 'select'

type Note = [frequency: number, start: number, length: number, endFrequency?: number]

// Each is under a third of a second and stays out of the range of speech
const NOTES: Record<UiSound, Note[]> = {
  send: [[520, 0, 0.16, 880], [1040, 0.09, 0.2]],
  archive: [[660, 0, 0.1, 440]],
  snooze: [[784, 0, 0.14], [587, 0.1, 0.22]],
  undo: [[440, 0, 0.1, 660]],
  select: [[1200, 0, 0.04]]
}

let context: AudioContext | undefined

/** Plays a cue, when cues are on and the app is in front */
export function playUiSound(sound: UiSound) {
  if (!import.meta.client || typeof AudioContext === 'undefined' || document.hidden) return
  if (!usePrefs().value.uiSounds) return
  context ??= new AudioContext()
  const ctx = context
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime + 0.01
  for (const [frequency, start, length, end] of NOTES[sound]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, now + start)
    if (end) osc.frequency.exponentialRampToValueAtTime(end, now + start + length)
    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(0.045, now + start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + length + 0.05)
  }
}
