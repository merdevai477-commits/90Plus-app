import { create } from 'zustand';

type VoiceModeState = {
  active: boolean;
  /** Window Y of the composer's center, where the welcome bubble gets pulled to. */
  targetY: number | null;
  enter: (targetY: number) => void;
  exit: () => void;
};

export const useVoiceModeStore = create<VoiceModeState>()((set) => ({
  active: false,
  targetY: null,
  enter: (targetY) => set({ active: true, targetY }),
  exit: () => set({ active: false }),
}));
