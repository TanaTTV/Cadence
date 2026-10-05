"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrowserAudio } from "@/lib/audio/browser-audio";
import { generateClip } from "@/lib/audio/generate-clip";
import { buildRawTimeline } from "@/lib/audio/raw-timeline";
import { DialogueTimeline } from "@/components/timeline/dialogue-timeline";
import { useDialogueStore } from "@/lib/dialogue-store";
import type { Voice } from "@/types/audio";

const button = "rounded-lg bg-teal-300 px-4 py-2 font-semibold text-slate-950 hover:bg-teal-200";
const secondary = "rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800";
const field = "w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm";

export function DialogueLab() {
  const project = useDialogueStore();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const engine = useRef<BrowserAudio | null>(null);
  const cache = useRef(new Map<string, { buffer: AudioBuffer; url: string }>());
  const busy = loadingVoices || !!generating;
  const completed = project.turns.filter((t) => t.generatedAssetId).length;
  const rawClips = completed === project.turns.length ? buildRawTimeline(project.turns, project.assets) : [];

  useEffect(() => {
    const audioCache = cache.current;
    return () => {
      engine.current?.dispose();
      for (const item of audioCache.values()) URL.revokeObjectURL(item.url);
      audioCache.clear();
      useDialogueStore.getState().clearAudio();
    };
  }, []);

  useEffect(() => {
    const referenced = new Set(project.turns.map((t) => t.generatedAssetId));
    for (const [id, item] of cache.current) {
      if (!referenced.has(id)) { URL.revokeObjectURL(item.url); cache.current.delete(id); }
    }
  }, [project.turns]);

  function stop() { engine.current?.stop(); setPlaying(null); }

  async function loadVoices() {
    setLoadingVoices(true); setError("");
    try {
      const response = await fetch("/api/voices");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVoices(data.voices);
      if (!data.voices.length) throw new Error("No voices available for this account.");
      // Prefer built-in voices for the initial demo; library voices may require a paid plan.
      const preferred = ["EXAVITQu4vr4xnSDxMaL", "JBFqnCBsd6RMkjVDRZzb"];
      for (const [index, character] of useDialogueStore.getState().characters.entries()) {
        if (!data.voices.some((v: Voice) => v.id === character.voiceId)) {
          project.updateCharacter(character.id, { voiceId: data.voices.find((v: Voice) => v.id === preferred[index])?.id ?? data.voices[index % data.voices.length].id });
        }
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load voices."); }
    finally { setLoadingVoices(false); }
  }

  async function generate(turnId?: string) {
    stop(); setError("");
    const snapshot = useDialogueStore.getState();
    const turns = snapshot.turns.filter((t) => turnId ? t.id === turnId : !t.generatedAssetId);
    if (!turns.length) return;
    if (turns.some((t) => !t.text.trim() || !snapshot.characters.find((c) => c.id === t.characterId)?.voiceId)) {
      setError("Assign both voices and fill in each dialogue line before generating."); return;
    }
    try {
      const audio = engine.current ??= new BrowserAudio();
      for (const turn of turns) {
        setGenerating(turn.id);
        const character = snapshot.characters.find((c) => c.id === turn.characterId)!;
        const { asset, buffer } = await generateClip(audio, { voiceId: character.voiceId, text: turn.text });
        cache.current.set(asset.id, { buffer, url: asset.url });
        project.setAsset(turn.id, asset);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Dialogue generation failed."); }
    finally { setGenerating(null); }
  }

  async function play(turnId: string) {
    const turn = project.turns.find((t) => t.id === turnId);
    const item = turn?.generatedAssetId ? cache.current.get(turn.generatedAssetId) : undefined;
    if (!item || !engine.current) return;
    setError("");
    setPlaying(turnId);
    try { if (!await engine.current.play(item.buffer, () => setPlaying(null))) setPlaying(null); }
    catch { setError("Could not play audio. Check browser permissions."); setPlaying(null); }
  }

  async function playRaw() {
    if (!engine.current || !rawClips.length) return;
    setError(""); setPlaying("raw");
    try {
      const clips = rawClips.map((clip) => {
        const item = cache.current.get(clip.assetId);
        if (!item) throw new Error("Audio is missing. Generate the affected line again.");
        return { ...clip, buffer: item.buffer };
      });
      if (!await engine.current.playTimeline(clips, () => setPlaying(null))) setPlaying(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Playback failed."); setPlaying(null); }
  }

  return <main className="mx-auto max-w-5xl px-5 py-10">
    <header className="mb-8 border-b border-slate-800 pb-6"><p className="text-xs tracking-[.25em] text-teal-300">CADENCE / MILESTONE 0.1</p><h1 className="mt-3 text-3xl font-semibold">Dialogue Pacing Lab</h1><p className="mt-3 text-sm text-slate-400">Two voices. One scene. Every line is its own audio clip.</p></header>
    <div className="mb-5 flex flex-wrap gap-3"><button className={secondary} onClick={loadVoices} disabled={busy}>{loadingVoices ? "Loading voices…" : "Load voices"}</button><Link className={secondary} href="/clip-test">One-clip test</Link></div>
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Characters">
      {project.characters.map((character, index) => <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5" key={character.id}>
        <p className={`mb-3 text-xs font-semibold tracking-widest ${index ? "text-violet-300" : "text-teal-300"}`}>CHARACTER {index ? "B" : "A"}</p>
        <label className="block text-xs text-slate-400">Name<input className={`${field} mt-2`} value={character.name} maxLength={60} disabled={busy} onChange={(e) => project.updateCharacter(character.id, { name: e.target.value })} /></label>
        <label className="mt-3 block text-xs text-slate-400">Voice for {character.name || character.id}<select className={`${field} mt-2`} value={character.voiceId} disabled={busy || !voices.length} onChange={(e) => { stop(); project.updateCharacter(character.id, { voiceId: e.target.value }); }}><option value="">Select a voice</option>{voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      </div>)}
    </section>
    <section className="mt-8" aria-labelledby="dialogue-heading">
      <div className="mb-4 flex items-center justify-between"><h2 id="dialogue-heading" className="text-xl font-semibold">Dialogue</h2><span className="text-xs text-slate-400">{project.turns.length} turns · {completed} generated</span></div>
      <div className="space-y-3">{project.turns.map((turn, index) => {
        const asset = turn.generatedAssetId ? project.assets[turn.generatedAssetId] : undefined;
        return <div key={turn.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3"><span className="text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span><select aria-label={`Speaker for turn ${index + 1}`} className="rounded border border-slate-700 bg-slate-950 p-2 text-sm" value={turn.characterId} disabled={busy} onChange={(e) => { stop(); project.updateTurn(turn.id, { characterId: e.target.value }); }}>{project.characters.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}</select><span className="ml-auto text-xs tabular-nums text-slate-400">{generating === turn.id ? "Generating & decoding…" : asset ? `${asset.duration.toFixed(3)} s · ${asset.model}` : "Not generated"}</span></div>
          <textarea aria-label={`Dialogue turn ${index + 1}`} className={`${field} min-h-20 resize-y`} maxLength={1000} value={turn.text} disabled={busy} onChange={(e) => { stop(); project.updateTurn(turn.id, { text: e.target.value }); }} />
          <div className="mt-3 flex flex-wrap gap-2"><button className={secondary} disabled={busy || !turn.text.trim() || !project.characters.find((c) => c.id === turn.characterId)?.voiceId} onClick={() => generate(turn.id)}>{asset ? "Regenerate" : "Generate line"} {index + 1}</button><button className={secondary} disabled={busy || !asset || playing === turn.id} onClick={() => play(turn.id)}>Play line {index + 1}</button><button className={`${secondary} ml-auto`} disabled={busy || project.turns.length <= 1} onClick={() => { stop(); project.removeTurn(turn.id); }}>Remove turn {index + 1}</button></div>
        </div>;
      })}</div>
      <div className="mt-5 flex flex-wrap gap-3"><button className={button} disabled={busy || completed === project.turns.length || project.characters.some((c) => !c.voiceId)} onClick={() => generate()}>Generate Dialogue</button><button className={secondary} disabled={busy || project.turns.length >= 10} onClick={project.addTurn}>Add turn</button><button className={secondary} disabled={!playing} onClick={stop}>Stop</button></div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">Generates only missing clips, one at a time. Completed clips survive a later failure. Regenerate a line explicitly to replace it. Generation uses voice-provider credits.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/40 p-4 text-sm text-amber-200">{error}</p>}
    </section>
    <DialogueTimeline characters={project.characters} turns={project.turns} clips={rawClips} />
    <div className="mt-4 flex items-center gap-3"><button className={button} onClick={playRaw} disabled={busy || !rawClips.length || playing === "raw"}>Play Raw</button><button className={secondary} onClick={stop} disabled={!playing}>Stop playback</button><span role="status" className="text-sm text-slate-400">{playing === "raw" ? "Playing Raw" : ""}</span></div>
    <p className="mt-8 text-xs text-slate-500">This project stays in browser memory for now. Refreshing clears clips and edits.</p>
  </main>;
}
