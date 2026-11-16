import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAppSettings } from '@/src/store/useAppSettings';

export default function AuthLayout() {
  const preference = useAppSettings((s) => s.theme?.mode);
  const system = useColorScheme();
  const isDark =
    preference === 'dark' || (preference !== 'light' && system === 'dark');

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? '#08060F' : '#FCFCFC' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
