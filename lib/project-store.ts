import { create } from "zustand";
import type { AudioAsset } from "@/types/audio";

interface LabState {
  voiceId: string;
  text: string;
  asset: AudioAsset | null;
  setVoiceId: (voiceId: string) => void;
  setText: (text: string) => void;
  setAsset: (asset: AudioAsset | null) => void;
}

// Session-only until the one-clip gate is verified; audio never goes to localStorage.
export const useLabStore = create<LabState>((set) => ({
  voiceId: "", text: "You heard it too, didn't you? That wasn't the wind.", asset: null,
  setVoiceId: (voiceId) => set({ voiceId }),
  setText: (text) => set({ text }),
  setAsset: (asset) => set({ asset }),
}));
