import { create } from 'zustand';

/** How long the welcome bubble takes to be pulled down into the composer. */
export const VOICE_PULL_MS = 520;
/** Landing wobble after the pull, while the voice orb takes over. */
export const VOICE_SETTLE_MS = 420;

type VoiceModeState = {
  active: boolean;
  /** Window Y of the composer's center, where the welcome bubble gets pulled to. */
  targetY: number | null;
  /** Diameter of the voice orb the bubble lands as. */
  targetSize: number;
  /** The welcome bubble is on screen, so the voice orb waits for it to land. */
  welcomeShown: boolean;
  enter: (targetY: number, targetSize: number) => void;
  exit: () => void;
  setWelcomeShown: (shown: boolean) => void;
};

export const useVoiceModeStore = create<VoiceModeState>()((set) => ({
  active: false,
  targetY: null,
  targetSize: 0,
  welcomeShown: false,
  enter: (targetY, targetSize) => set({ active: true, targetY, targetSize }),
  exit: () => set({ active: false }),
  setWelcomeShown: (welcomeShown) => set({ welcomeShown }),
}));
