import assert from "node:assert/strict";
import { test } from "node:test";
import { BrowserAudio } from "../lib/audio/browser-audio.ts";

function fixture(resume: () => Promise<void> = async () => {}) {
  const sources: { started?: number; stopped: boolean; onended: (() => void) | null }[] = [];
  const context = {
    currentTime: 10, destination: {}, resume,
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = { buffer: null, started: undefined as number | undefined, stopped: false, onended: null as (() => void) | null, connect() {}, disconnect() {}, start(when: number) { this.started = when; }, stop() { this.stopped = true; } };
      sources.push(source); return source;
    },
  } as unknown as AudioContext;
  const engine = new BrowserAudio(() => context);
  const clip = (startTime: number, duration: number) => ({ startTime, duration, gain: 1, buffer: { duration, sampleRate: 44100 } as AudioBuffer });
  return { engine, sources, clip };
}

test("raw clips use one Web Audio clock with exact boundaries", async () => {
  const { engine, sources, clip } = fixture();
  let ended = 0;
  assert.equal(await engine.playTimeline([clip(0, 1.25), clip(1.25, 2.5)], () => ended++), true);
  assert.equal(sources[0].started, 10.05);
  assert.equal(sources[1].started, 11.3);
  sources[0].onended?.(); assert.equal(ended, 0);
  sources[1].onended?.(); assert.equal(ended, 1);
});

test("Stop cancels every scheduled clip and suppresses the completion callback", async () => {
  const { engine, sources, clip } = fixture();
  await engine.playTimeline([clip(0, 1), clip(1, 1)], () => assert.fail("Stopped playback must not complete"));
  engine.stop();
  assert.ok(sources.every((s) => s.stopped && s.onended === null));
});

test("invalid timestamps and duration mismatches never schedule audio", async () => {
  const { engine, sources, clip } = fixture();
  for (const input of [{ ...clip(-1, 1) }, { ...clip(0, 1), gain: NaN }, { ...clip(0, 1), duration: 2 }]) {
    await assert.rejects(engine.playTimeline([input], () => {}));
  }
  assert.equal(sources.length, 0);
});

test("Stop during resume prevents playback from starting later", async () => {
  let resume!: () => void;
  const pendingResume = new Promise<void>((resolve) => { resume = resolve; });
  const { engine, sources, clip } = fixture(() => pendingResume);
  const pending = engine.playTimeline([clip(0, 1)], () => {});
  engine.stop(); resume();
  assert.equal(await pending, false);
  assert.equal(sources.length, 0);
});
