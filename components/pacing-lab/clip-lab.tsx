"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserAudio } from "@/lib/audio/browser-audio";
import { useLabStore } from "@/lib/project-store";
import type { Voice } from "@/types/audio";

const button = "rounded-lg bg-teal-300 px-5 py-3 font-semibold text-slate-950 hover:bg-teal-200";
const field = "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100";

export function ClipLab() {
  const { voiceId, text, asset, setVoiceId, setText, setAsset } = useLabStore();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [busy, setBusy] = useState<"voices" | "speech" | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<BrowserAudio | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    audio.current?.dispose();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    useLabStore.getState().setAsset(null);
  }, []);

  async function loadVoices() {
    setBusy("voices"); setError("");
    try {
      const response = await fetch("/api/voices");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVoices(data.voices);
      if (!data.voices.some((voice: Voice) => voice.id === voiceId)) setVoiceId(data.voices[0]?.id ?? "");
      if (!data.voices.length) setError("No voices available for this account.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load voices."); }
    finally { setBusy(null); }
  }

  async function generate() {
    setBusy("speech"); setError(""); audio.current?.stop(); setPlaying(false);
    try {
      const response = await fetch("/api/speech", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId, text }),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      const bytes = await response.arrayBuffer();
      const engine = audio.current ??= new BrowserAudio();
      const decoded = await engine.decode(bytes);
      const url = URL.createObjectURL(new Blob([bytes], { type: response.headers.get("Content-Type") ?? "audio/mpeg" }));
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      buffer.current = decoded;
      setAsset({
        id: response.headers.get("X-Asset-Id") ?? crypto.randomUUID(), url, duration: decoded.duration,
        provider: response.headers.get("X-Audio-Provider") ?? "unknown", model: response.headers.get("X-Audio-Model") ?? "unknown",
        metadata: { voiceId, text: text.trim(), createdAt: new Date().toISOString() },
      });
    } catch (error) { setError(error instanceof Error ? error.message : "Could not generate audio."); }
    finally { setBusy(null); }
  }

  async function play() {
    if (!buffer.current || !audio.current) return;
    setError("");
    setPlaying(true);
    try { if (!await audio.current.play(buffer.current, () => setPlaying(false))) setPlaying(false); }
    catch { setError("Playback failed. Check your browser's audio permissions."); setPlaying(false); }
  }

  return <main className="mx-auto max-w-4xl px-5 py-12 sm:px-10">
    <header className="mb-10 border-b border-slate-800 pb-8">
      <p className="text-xs tracking-[.25em] text-teal-300">CADENCE / MILESTONE 0.1</p>
      <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Dialogue Pacing Lab</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-slate-400">Cinematic conversation starts with a voice. Generate one line, listen, and verify its real duration.</p>
    </header>
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6" aria-labelledby="clip-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 id="clip-heading" className="text-xl font-semibold">One-clip voice test</h2><span className="text-xs text-slate-400">Local session · server-side credentials</span></div>
      <button className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-800" onClick={loadVoices} disabled={!!busy}>{busy === "voices" ? "Loading voices…" : "Load voices"}</button>
      <label className="mt-6 block text-sm text-slate-300">Voice<select className={field} value={voiceId} onChange={(e) => setVoiceId(e.target.value)} disabled={!!busy || !voices.length}><option value="">Select a voice</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
      <label className="mt-5 block text-sm text-slate-300">Dialogue line<textarea className={`${field} min-h-32 resize-y`} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} disabled={!!busy} /></label>
      <p className="mt-2 text-right text-xs text-slate-500">{text.length} / 1000 characters</p>
      <button className={`${button} mt-5`} onClick={generate} disabled={!!busy || !voiceId || !text.trim()}>{busy === "speech" ? "Generating & decoding…" : "Generate test clip"}</button>
      <p className="mt-3 text-xs text-slate-400">Generation sends this line to your voice provider and uses your account credits.</p>
      {error && <p role="alert" className="mt-5 rounded-lg border border-amber-700/50 bg-amber-950/40 p-4 text-sm text-amber-200">{error}</p>}
      <div aria-live="polite" className="mt-8 border-t border-slate-800 pt-6">
        {asset ? <>
          <div className="flex flex-wrap items-center gap-5"><p className="text-2xl font-semibold tabular-nums">{asset.duration.toFixed(3)} <span className="text-sm font-normal text-slate-400">seconds · decoded audio</span></p><button className={button} onClick={play} disabled={!!busy || playing}>Play clip</button><button className="rounded-lg border border-slate-600 px-4 py-3" disabled={!playing} onClick={() => { audio.current?.stop(); setPlaying(false); }}>Stop</button></div>
          <p className="mt-4 text-sm text-slate-300">“{asset.metadata.text}”</p>
          <p className="mt-2 text-xs text-slate-500">{asset.provider} / {asset.model} · Generated clip stays in this browser session.</p>
        </> : <p className="text-sm text-slate-500">No clip generated yet. Duration will be measured from the audio, never estimated from text.</p>}
      </div>
    </section>
    <p className="mt-7 text-sm leading-relaxed text-slate-500">Next gate: verify a real generated clip before adding dialogue turns, the timeline, and Raw vs Paced.</p>
  </main>;
}
