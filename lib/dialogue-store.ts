import { create } from "zustand";
import type { AudioAsset } from "@/types/audio";
import type { Character, DialogueTurn } from "@/types/project";

const lines = [
  "You heard it too, didn't you? That wasn't the wind.",
  "Keep your voice down. Someone's still in here.",
  "The door was locked. I checked it myself.",
  "Then tell me why there's light under it.",
  "Wait. That shadow… it stopped moving.",
  "Don't touch the handle.",
  "I think they're waiting for us.",
  "Maya. Step away from the door. Now.",
];
export const initialCharacters: Character[] = [{ id: "a", name: "Maya", voiceId: "" }, { id: "b", name: "David", voiceId: "" }];
export const initialTurns: DialogueTurn[] = lines.map((text, index) => ({ id: `turn-${index + 1}`, characterId: index % 2 ? "b" : "a", text }));

interface ProjectState {
  characters: Character[];
  turns: DialogueTurn[];
  assets: Record<string, AudioAsset>;
  updateCharacter: (id: string, change: Partial<Pick<Character, "name" | "voiceId">>) => void;
  updateTurn: (id: string, change: Partial<Pick<DialogueTurn, "characterId" | "text">>) => void;
  addTurn: () => void;
  removeTurn: (id: string) => void;
  setAsset: (turnId: string, asset: AudioAsset) => void;
  clearAudio: () => void;
}

export const useDialogueStore = create<ProjectState>((set) => ({
  characters: initialCharacters,
  turns: initialTurns,
  assets: {},
  updateCharacter: (id, change) => set((state) => ({
    characters: state.characters.map((c) => c.id === id ? { ...c, ...change } : c),
    turns: change.voiceId === undefined ? state.turns : state.turns.map((t) => t.characterId === id ? { ...t, generatedAssetId: undefined } : t),
  })),
  updateTurn: (id, change) => set((state) => ({ turns: state.turns.map((t) => t.id === id ? { ...t, ...change, generatedAssetId: undefined } : t) })),
  addTurn: () => set((state) => state.turns.length >= 10 ? state : ({ turns: [...state.turns, { id: crypto.randomUUID(), characterId: state.turns.at(-1)?.characterId === "a" ? "b" : "a", text: "" }] })),
  removeTurn: (id) => set((state) => ({ turns: state.turns.length <= 1 ? state.turns : state.turns.filter((t) => t.id !== id) })),
  setAsset: (turnId, asset) => set((state) => ({ assets: { ...state.assets, [asset.id]: asset }, turns: state.turns.map((t) => t.id === turnId ? { ...t, generatedAssetId: asset.id } : t) })),
  clearAudio: () => set((state) => ({ assets: {}, turns: state.turns.map((t) => ({ ...t, generatedAssetId: undefined })) })),
}));
