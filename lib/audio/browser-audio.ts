export function validateDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600)
    throw new Error("Audio duration must be between 0 and 600 seconds.");
  return duration;
}

export class BrowserAudio {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;

  private getContext() { return this.context ??= new AudioContext(); }

  async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
    const buffer = await this.getContext().decodeAudioData(bytes.slice(0));
    validateDuration(buffer.duration);
    return buffer;
  }

  async play(buffer: AudioBuffer, onEnd: () => void) {
    this.stop();
    const context = this.getContext();
    await context.resume();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => { if (this.source === source) { this.source = null; onEnd(); } source.disconnect(); };
    this.source = source;
    source.start();
  }

  stop() {
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = null; }
  }

  dispose() { this.stop(); if (this.context) void this.context.close(); this.context = null; }
}
