import { create } from "zustand";
import type { Course, ScoringType } from "@/types";

interface PlayerDraft {
  name: string;
  handicap: number;
}

interface NewRoundState {
  step: 1 | 2;
  course: Course | null;
  scoringType: ScoringType;
  holes: 9 | 18;
  players: PlayerDraft[];
  setCourse: (course: Course) => void;
  setScoringType: (type: ScoringType) => void;
  setHoles: (holes: 9 | 18) => void;
  setStep: (step: 1 | 2) => void;
  addPlayer: () => void;
  removePlayer: (index: number) => void;
  updatePlayer: (index: number, field: keyof PlayerDraft, value: string | number) => void;
  reset: () => void;
}

const initialPlayers: PlayerDraft[] = [{ name: "", handicap: 18 }];

export const useNewRoundStore = create<NewRoundState>((set) => ({
  step: 1,
  course: null,
  scoringType: "stableford",
  holes: 18,
  players: [...initialPlayers],
  setCourse: (course) => set({ course }),
  setScoringType: (scoringType) => set({ scoringType }),
  setHoles: (holes) => set({ holes }),
  setStep: (step) => set({ step }),
  addPlayer: () =>
    set((state) => ({
      players:
        state.players.length < 4
          ? [...state.players, { name: "", handicap: 18 }]
          : state.players,
    })),
  removePlayer: (index) =>
    set((state) => ({
      players:
        state.players.length > 1
          ? state.players.filter((_, i) => i !== index)
          : state.players,
    })),
  updatePlayer: (index, field, value) =>
    set((state) => ({
      players: state.players.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    })),
  reset: () =>
    set({
      step: 1,
      course: null,
      scoringType: "stableford",
      holes: 18,
      players: [...initialPlayers],
    }),
}));
