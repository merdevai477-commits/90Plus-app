import BlockedUsersScreen from '../../components/Settings/BlockedUsersScreen';
import { Stack } from 'expo-router';

export default function BlockedUsersPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BlockedUsersScreen />
    </>
  );
}
