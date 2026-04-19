import * as Haptics from 'expo-haptics';

export const useReelHaptics = () => {
    const lightImpact = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const mediumImpact = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const heavyImpact = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    };

    const notificationSuccess = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    return {
        lightImpact,
        mediumImpact,
        heavyImpact,
        notificationSuccess,
    };
};
