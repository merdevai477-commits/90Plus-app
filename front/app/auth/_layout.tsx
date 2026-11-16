import { Stack } from 'expo-router';

const AUTH_STACK_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#F8F7FF' },
  animation: 'slide_from_right' as const,
};

export default function AuthLayout() {
  return (
    <Stack initialRouteName="index" screenOptions={AUTH_STACK_OPTIONS}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
