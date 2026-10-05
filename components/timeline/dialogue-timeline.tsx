import type { Character, DialogueTurn, TimelineClip } from "@/types/project";

export function DialogueTimeline({ characters, turns, clips }: { characters: Character[]; turns: DialogueTurn[]; clips: TimelineClip[] }) {
  const duration = Math.max(...clips.map((c) => c.startTime + c.duration), 0);
  return <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5" aria-labelledby="timeline-heading">
    <div className="mb-5 flex justify-between gap-4"><h2 id="timeline-heading" className="text-xl font-semibold">Raw timeline</h2><span className="text-sm tabular-nums text-slate-400">{duration.toFixed(3)} s</span></div>
    {!clips.length ? <p className="text-sm text-slate-500">Generate every dialogue turn to place the clips using their real durations.</p> : <div className="overflow-x-auto"><div className="min-w-[600px]">
      <div className="mb-3 ml-24 flex justify-between text-xs tabular-nums text-slate-500">{Array.from({ length: 5 }, (_, i) => <span key={i}>{(duration * i / 4).toFixed(2)}s</span>)}</div>
      {characters.map((character, track) => <div key={character.id} className="mb-3 flex items-center gap-4"><span className="w-20 shrink-0 truncate text-sm text-slate-400">{character.name || character.id}</span><div className="relative h-16 flex-1 rounded-lg bg-slate-950">
        {clips.filter((clip) => turns.find((t) => t.id === clip.dialogueTurnId)?.characterId === character.id).map((clip) => {
          const index = turns.findIndex((t) => t.id === clip.dialogueTurnId);
          return <div key={clip.id} data-clip-id={clip.id} data-start={clip.startTime} data-duration={clip.duration} className={`absolute top-2 flex h-12 items-center overflow-hidden rounded border px-2 text-xs font-semibold ${track ? "border-violet-400/50 bg-violet-900/60 text-violet-100" : "border-teal-400/50 bg-teal-900/60 text-teal-100"}`} style={{ left: `${clip.startTime / duration * 100}%`, width: `${clip.duration / duration * 100}%` }} title={`Turn ${index + 1}: ${turns[index].text} — ${clip.startTime.toFixed(3)}s, duration ${clip.duration.toFixed(3)}s`} aria-label={`${character.name}, turn ${index + 1}, starts at ${clip.startTime.toFixed(3)} seconds, lasts ${clip.duration.toFixed(3)} seconds`}>{index + 1} · {clip.duration.toFixed(2)}s</div>;
        })}
      </div></div>)}
      <p className="mt-4 text-xs text-slate-500">Clips touch end-to-start. Raw adds no silence; any pauses inside the generated speech remain part of the audio.</p>
    </div></div>}
  </section>;
}
