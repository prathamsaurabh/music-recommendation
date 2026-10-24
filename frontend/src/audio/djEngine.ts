import type { Playlist } from '../api'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended'

export interface EngineSnapshot {
  status: EngineStatus
  currentTrack: number
  trackElapsed: number
  totalElapsed: number
  totalDuration: number
  blending: boolean
}

const CURVE_LEN = 64

function fadeCurves(): { inCurve: Float32Array; outCurve: Float32Array } {
  const inCurve = new Float32Array(CURVE_LEN)
  const outCurve = new Float32Array(CURVE_LEN)
  for (let i = 0; i < CURVE_LEN; i++) {
    const t = i / (CURVE_LEN - 1)
    inCurve[i] = Math.sin((t * Math.PI) / 2)
    outCurve[i] = Math.cos((t * Math.PI) / 2)
  }
  return { inCurve, outCurve }
}

/**
 * Two-deck Web Audio engine. The backend hands us a tempo curve (playbackRate
 * per track), a mix-in point per track, and a beat-aligned exit time per
 * transition; we schedule the set on the AudioContext clock. All scheduling is
 * relative to a "set timeline" so seek/skip just re-anchors it.
 */
export class DjEngine {
  private ctx = new AudioContext()
  private master = this.ctx.createGain()
  private buffers: AudioBuffer[] = []
  private sources: AudioBufferSourceNode[] = []
  private gains: GainNode[] = []
  private setStarts: number[] = [] // set-timeline offset where each track enters
  private bufferStarts: number[] = [] // buffer pos each track starts from
  private setDuration = 0
  private originSet = 0 // set-timeline position at t0
  private t0 = 0
  private firstIdx = 0 // index of sources[0]/gains[0] within the set
  private mix: Playlist | null = null
  private runId = 0
  status: EngineStatus = 'idle'
  onProgress?: (n: number, total: number) => void
  onEnded?: () => void

  constructor() {
    this.master.connect(this.ctx.destination)
  }

  async load(mix: Playlist) {
    this.tearDownSources()
    this.mix = mix
    this.status = 'loading'
    this.buffers = []
    for (let i = 0; i < mix.tracks.length; i++) {
      const resp = await fetch(mix.tracks[i].audio_url)
      const data = await resp.arrayBuffer()
      this.buffers.push(await this.ctx.decodeAudioData(data))
      this.onProgress?.(i + 1, mix.tracks.length)
    }
    this.buildTimeline()
    this.status = 'ready'
  }

  play() {
    if (!this.mix || this.buffers.length === 0) return
    if (this.status === 'paused') {
      void this.ctx.resume()
      this.status = 'playing'
      return
    }
    this.scheduleFrom(0)
  }

  pause() {
    if (this.status !== 'playing') return
    void this.ctx.suspend()
    this.status = 'paused'
  }

  stop() {
    this.tearDownSources()
    this.status = 'ready'
  }

  /** Jump to a position (seconds) on the set timeline. Resumes playback. */
  seekSet(seconds: number) {
    if (!this.mix || this.buffers.length === 0) return
    if (this.status === 'paused') void this.ctx.resume()
    this.scheduleFrom(Math.max(0, Math.min(seconds, this.setDuration - 0.5)))
  }

  skipNext() {
    const cur = this.snapshot().currentTrack
    if (cur + 1 < this.setStarts.length) this.seekSet(this.setStarts[cur + 1] + 0.02)
  }

  skipPrev() {
    const snap = this.snapshot()
    // Standard prev semantics: >3s in restarts the track, else go back one.
    this.seekSet(snap.trackElapsed > 3 ? this.setStarts[snap.currentTrack] : this.setStarts[Math.max(0, snap.currentTrack - 1)])
  }

  private buildTimeline() {
    const mix = this.mix!
    const tracks = mix.tracks
    this.bufferStarts = tracks.map((t, i) =>
      i === 0 ? t.start_offset : mix.transitions[i - 1].enter_time,
    )
    this.setStarts = [0]
    for (let i = 1; i < tracks.length; i++) {
      const tr = mix.transitions[i - 1]
      this.setStarts.push(
        this.setStarts[i - 1] + (tr.exit_time - this.bufferStarts[i - 1]) / tracks[i - 1].rate,
      )
    }
    const last = tracks.length - 1
    this.setDuration =
      this.setStarts[last] + (this.buffers[last].duration - this.bufferStarts[last]) / tracks[last].rate
  }

  /** (Re)schedule playback starting `fromSet` seconds into the set timeline. */
  private scheduleFrom(fromSet: number) {
    this.tearDownSources()
    const runId = this.runId
    const mix = this.mix!
    const tracks = mix.tracks
    const { inCurve, outCurve } = fadeCurves()

    let first = 0
    for (let i = 0; i < tracks.length; i++) {
      if (this.setStarts[i] <= fromSet) first = i
    }
    this.firstIdx = first
    this.originSet = fromSet
    this.t0 = this.ctx.currentTime + 0.12

    for (let i = first; i < tracks.length; i++) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.buffers[i]
      src.playbackRate.value = tracks[i].rate
      const gain = this.ctx.createGain()
      src.connect(gain)
      gain.connect(this.master)

      let wall = this.t0 + (this.setStarts[i] - fromSet)
      let bufPos = this.bufferStarts[i]
      if (i === first) {
        wall = this.t0
        bufPos += (fromSet - this.setStarts[i]) * tracks[i].rate
        bufPos = Math.min(bufPos, this.buffers[i].duration - 0.3)
        gain.gain.setValueAtTime(1, wall)
      } else {
        const fade = mix.transitions[i - 1].fade_seconds
        gain.gain.setValueAtTime(0, wall)
        gain.gain.setValueCurveAtTime(inCurve, wall, fade)

        const prevGain = this.gains[i - 1 - first]
        prevGain.gain.cancelScheduledValues(wall)
        prevGain.gain.setValueAtTime(1, wall)
        prevGain.gain.setValueCurveAtTime(outCurve, wall, fade)
        this.sources[i - 1 - first].stop(wall + fade + 0.1)
      }

      src.start(wall, bufPos)
      if (i === tracks.length - 1) {
        src.onended = () => {
          if (this.runId === runId && this.status === 'playing') {
            this.status = 'ended'
            this.onEnded?.()
          }
        }
      }
      this.sources.push(src)
      this.gains.push(gain)
    }
    this.status = 'playing'
  }

  snapshot(): EngineSnapshot {
    const elapsed = this.originSet + (this.ctx.currentTime - this.t0)
    let current = this.firstIdx
    for (let i = 0; i < this.setStarts.length; i++) {
      if (elapsed >= this.setStarts[i]) current = i
    }
    const blending =
      current > 0 &&
      !!this.mix &&
      elapsed < this.setStarts[current] + this.mix.transitions[current - 1].fade_seconds &&
      this.status === 'playing'
    return {
      status: this.status,
      currentTrack: current,
      trackElapsed: Math.max(0, elapsed - (this.setStarts[current] ?? 0)),
      totalElapsed: Math.max(0, elapsed),
      totalDuration: this.setDuration,
      blending,
    }
  }

  private tearDownSources() {
    this.runId++
    for (const s of this.sources) {
      try {
        s.onended = null
        s.stop()
      } catch { /* not started */ }
      s.disconnect()
    }
    for (const g of this.gains) g.disconnect()
    this.sources = []
    this.gains = []
  }
}
