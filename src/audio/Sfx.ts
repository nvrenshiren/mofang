/**
 * 极轻量 Web Audio 音效合成 (无外部素材)
 *   - clack(): 短促咔哒声,一次转动结束时
 *   - chime(): 高音叮,完成涟漪触发时
 *   - tick(): 极轻 tick,键盘按下幽灵预览时
 *
 * 用户首次交互前不要播放 (浏览器策略),通过 enable() 在第一次用户事件后激活
 */

class AudioEngine {
  private ctx: AudioContext | null = null
  private enabled = false
  private master: GainNode | null = null

  /** 第一次用户手势后调一次 */
  enable(): void {
    if (this.ctx) return
    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.18
      this.master.connect(this.ctx.destination)
      this.enabled = true
    } catch {
      // 浏览器不支持,静默
    }
  }

  setVolume(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v))
  }

  setMuted(muted: boolean): void {
    this.enabled = !muted
  }

  clack(): void {
    this.tone({ freq: 110, durMs: 80, type: 'square', sweepTo: 60, amp: 0.5 })
    this.tone({ freq: 880, durMs: 35, type: 'triangle', amp: 0.18, delayMs: 5 })
  }

  chime(): void {
    this.tone({ freq: 988, durMs: 220, type: 'sine', amp: 0.4 })
    this.tone({ freq: 1318, durMs: 260, type: 'sine', amp: 0.32, delayMs: 60 })
    this.tone({ freq: 1568, durMs: 320, type: 'sine', amp: 0.24, delayMs: 110 })
  }

  tick(): void {
    this.tone({ freq: 1800, durMs: 22, type: 'triangle', amp: 0.12 })
  }

  private tone(opts: {
    freq: number
    durMs: number
    type: OscillatorType
    amp: number
    sweepTo?: number
    delayMs?: number
  }): void {
    if (!this.enabled || !this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime + (opts.delayMs ?? 0) / 1000
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = opts.type
    osc.frequency.value = opts.freq
    if (opts.sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, now + opts.durMs / 1000)
    }
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(opts.amp, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, now + opts.durMs / 1000)
    osc.connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + opts.durMs / 1000 + 0.02)
  }
}

export const sfx = new AudioEngine()
