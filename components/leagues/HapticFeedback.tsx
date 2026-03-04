import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export class HapticManager {
  private static instance: HapticManager;
  private isEnabled: boolean = true;
  private intensity: 'light' | 'medium' | 'heavy' = 'medium';

  private constructor() {
    this.checkHapticSupport();
  }

  public static getInstance(): HapticManager {
    if (!HapticManager.instance) {
      HapticManager.instance = new HapticManager();
    }
    return HapticManager.instance;
  }

  private async checkHapticSupport() {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      this.isEnabled = false;
    }
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public setIntensity(intensity: 'light' | 'medium' | 'heavy') {
    this.intensity = intensity;
  }

  public async light() {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async medium() {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async heavy() {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async success() {
    if (!this.isEnabled) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async warning() {
    if (!this.isEnabled) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async error() {
    if (!this.isEnabled) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async selection() {
    if (!this.isEnabled) return;
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async custom(pattern: number[]) {
    if (!this.isEnabled) return;
    try {
      // Custom haptic pattern
      for (let i = 0; i < pattern.length; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (i < pattern.length - 1) {
          await new Promise(resolve => setTimeout(resolve, pattern[i]));
        }
      }
    } catch (error) {
      console.log('Haptic feedback not supported');
    }
  }

  public async buttonPress() {
    await this.light();
  }

  public async buttonRelease() {
    await this.selection();
  }

  public async cardTap() {
    await this.light();
  }

  public async cardLongPress() {
    await this.medium();
  }

  public async swipe() {
    await this.light();
  }

  public async pullToRefresh() {
    await this.medium();
  }

  public async predictionSubmit() {
    await this.success();
  }

  public async predictionError() {
    await this.error();
  }

  public async matchUpdate() {
    await this.medium();
  }

  public async achievement() {
    await this.custom([100, 50, 100, 50, 200]);
  }

  public async levelUp() {
    await this.custom([200, 100, 200, 100, 300]);
  }

  public async streak() {
    await this.custom([50, 50, 50, 50, 50, 50]);
  }

  public async correctPrediction() {
    await this.success();
  }

  public async incorrectPrediction() {
    await this.warning();
  }

  public async search() {
    await this.light();
  }

  public async filter() {
    await this.medium();
  }

  public async sort() {
    await this.light();
  }

  public async refresh() {
    await this.medium();
  }

  public async loadMore() {
    await this.light();
  }

  public async errorBoundary() {
    await this.error();
  }

  public async networkError() {
    await this.custom([200, 100, 200]);
  }

  public async validationError() {
    await this.warning();
  }

  public async formSubmit() {
    await this.medium();
  }

  public async formReset() {
    await this.light();
  }

  public async tabSwitch() {
    await this.light();
  }

  public async modalOpen() {
    await this.medium();
  }

  public async modalClose() {
    await this.light();
  }

  public async drawerOpen() {
    await this.medium();
  }

  public async drawerClose() {
    await this.light();
  }

  public async notification() {
    await this.medium();
  }

  public async alert() {
    await this.heavy();
  }

  public async confirmation() {
    await this.medium();
  }

  public async cancellation() {
    await this.light();
  }

  public async start() {
    await this.medium();
  }

  public async stop() {
    await this.light();
  }

  public async pause() {
    await this.light();
  }

  public async resume() {
    await this.medium();
  }

  public async complete() {
    await this.success();
  }

  public async progress() {
    await this.light();
  }

  public async milestone() {
    await this.medium();
  }

  public async celebration() {
    await this.custom([100, 50, 100, 50, 100, 50, 200]);
  }

  public async disappointment() {
    await this.custom([300, 100, 300]);
  }

  public async surprise() {
    await this.custom([50, 100, 50, 100, 50]);
  }

  public async excitement() {
    await this.custom([25, 25, 25, 25, 25, 25, 25, 25]);
  }

  public async relief() {
    await this.custom([200, 100, 200]);
  }

  public async frustration() {
    await this.custom([100, 50, 100, 50, 100]);
  }

  public async satisfaction() {
    await this.custom([150, 75, 150]);
  }

  public async anticipation() {
    await this.custom([100, 100, 100, 100]);
  }
}

// Hook for easy use in components
export const useHapticFeedback = () => {
  const haptic = HapticManager.getInstance();

  return {
    light: () => haptic.light(),
    medium: () => haptic.medium(),
    heavy: () => haptic.heavy(),
    success: () => haptic.success(),
    warning: () => haptic.warning(),
    error: () => haptic.error(),
    selection: () => haptic.selection(),
    buttonPress: () => haptic.buttonPress(),
    buttonRelease: () => haptic.buttonRelease(),
    cardTap: () => haptic.cardTap(),
    cardLongPress: () => haptic.cardLongPress(),
    swipe: () => haptic.swipe(),
    pullToRefresh: () => haptic.pullToRefresh(),
    predictionSubmit: () => haptic.predictionSubmit(),
    predictionError: () => haptic.predictionError(),
    matchUpdate: () => haptic.matchUpdate(),
    achievement: () => haptic.achievement(),
    levelUp: () => haptic.levelUp(),
    streak: () => haptic.streak(),
    correctPrediction: () => haptic.correctPrediction(),
    incorrectPrediction: () => haptic.incorrectPrediction(),
    search: () => haptic.search(),
    filter: () => haptic.filter(),
    sort: () => haptic.sort(),
    refresh: () => haptic.refresh(),
    loadMore: () => haptic.loadMore(),
    errorBoundary: () => haptic.errorBoundary(),
    networkError: () => haptic.networkError(),
    validationError: () => haptic.validationError(),
    formSubmit: () => haptic.formSubmit(),
    formReset: () => haptic.formReset(),
    tabSwitch: () => haptic.tabSwitch(),
    modalOpen: () => haptic.modalOpen(),
    modalClose: () => haptic.modalClose(),
    drawerOpen: () => haptic.drawerOpen(),
    drawerClose: () => haptic.drawerClose(),
    notification: () => haptic.notification(),
    alert: () => haptic.alert(),
    confirmation: () => haptic.confirmation(),
    cancellation: () => haptic.cancellation(),
    start: () => haptic.start(),
    stop: () => haptic.stop(),
    pause: () => haptic.pause(),
    resume: () => haptic.resume(),
    complete: () => haptic.complete(),
    progress: () => haptic.progress(),
    milestone: () => haptic.milestone(),
    celebration: () => haptic.celebration(),
    disappointment: () => haptic.disappointment(),
    surprise: () => haptic.surprise(),
    excitement: () => haptic.excitement(),
    frustration: () => haptic.frustration(),
    satisfaction: () => haptic.satisfaction(),
    anticipation: () => haptic.anticipation(),
    relief: () => haptic.relief(),
    setEnabled: (enabled: boolean) => haptic.setEnabled(enabled),
    setIntensity: (intensity: 'light' | 'medium' | 'heavy') => haptic.setIntensity(intensity),
  };
};

export default HapticManager;
