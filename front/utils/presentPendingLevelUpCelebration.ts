import { emitLevelUpCelebration } from './levelUpCelebration.events';
import { consumePendingLevelUpCelebration } from './levelUpCelebration.storage';

let modalVisible = false;

export function setLevelUpModalVisible(visible: boolean): void {
  modalVisible = visible;
}

/** Consume stored pending level-up and show the modal immediately. */
export async function presentPendingLevelUpCelebration(userId: string): Promise<void> {
  if (modalVisible) return;
  const pending = await consumePendingLevelUpCelebration(userId);
  if (pending) emitLevelUpCelebration(pending);
}

/** @deprecated Host gate removed — always presents. */
export async function tryPresentPendingLevelUpCelebration(userId: string): Promise<void> {
  await presentPendingLevelUpCelebration(userId);
}
