export function validateDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600)
    throw new Error("Audio duration must be between 0 and 600 seconds.");
  return duration;
}

export class BrowserAudio {
  private context: AudioContext | null = null;
  private sources = new Map<AudioBufferSourceNode, GainNode>();
  private epoch = 0;
  private readonly createContext: () => AudioContext;

  constructor(createContext: () => AudioContext = () => new AudioContext()) { this.createContext = createContext; }

  private getContext() { return this.context ??= this.createContext(); }

  async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
    const buffer = await this.getContext().decodeAudioData(bytes.slice(0));
    validateDuration(buffer.duration);
    return buffer;
  }

  async play(buffer: AudioBuffer, onEnd: () => void) {
    return this.playTimeline([{ buffer, startTime: 0, duration: buffer.duration, gain: 1 }], onEnd);
  }

  async playTimeline(clips: { buffer: AudioBuffer; startTime: number; duration: number; gain: number }[], onEnd: () => void): Promise<boolean> {
    this.stop();
    if (!clips.length) throw new Error("No audio clips to play.");
    for (const clip of clips) {
      validateDuration(clip.duration);
      if (!Number.isFinite(clip.startTime) || clip.startTime < 0 || !Number.isFinite(clip.gain) || clip.gain < 0 || clip.gain > 2)
        throw new Error("Invalid playback position or gain.");
      if (Math.abs(clip.duration - clip.buffer.duration) > 1 / clip.buffer.sampleRate)
        throw new Error("Timeline duration does not match the decoded audio.");
    }
    const epoch = this.epoch;
    const context = this.getContext();
    await context.resume();
    if (epoch !== this.epoch) return false;
    const origin = context.currentTime + 0.05;
    try {
      for (const clip of clips) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = clip.buffer;
        gain.gain.value = clip.gain;
        source.connect(gain); gain.connect(context.destination);
        source.onended = () => {
          source.disconnect(); gain.disconnect();
          if (this.sources.delete(source) && this.sources.size === 0 && epoch === this.epoch) onEnd();
        };
        this.sources.set(source, gain);
        source.start(origin + clip.startTime);
      }
    } catch (error) { this.stop(); throw error; }
    return true;
  }

  stop() {
    this.epoch++;
    for (const [source, gain] of this.sources) { source.onended = null; source.stop(); source.disconnect(); gain.disconnect(); }
    this.sources.clear();
  }

  dispose() { this.stop(); if (this.context) void this.context.close(); this.context = null; }
}
