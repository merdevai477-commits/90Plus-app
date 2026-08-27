import { Redirect } from 'expo-router';

/** Old Home tab — landing is Matches now. */
export default function RetiredHome() {
  return <Redirect href="/(tabs)/matches" />;
}
