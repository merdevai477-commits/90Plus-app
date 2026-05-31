import { Stack } from 'expo-router';

const AUTH_STACK_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#000' },
      animation: 'slide_from_right' as const,
};

export default function AuthLayout() {
    return (
        <Stack screenOptions={AUTH_STACK_OPTIONS}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="onboarding" />
        </Stack>
    );
}
