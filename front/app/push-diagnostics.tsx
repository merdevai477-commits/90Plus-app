import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import { PushDiagnosticsScreen } from '../components/dev/PushDiagnosticsScreen';

/** Dev / Expo Go only — hidden on production standalone builds. */
export default function PushDiagnosticsRoute() {
    const allowed = __DEV__ || Constants.appOwnership !== 'standalone';
    if (!allowed) {
        return <Redirect href="/" />;
    }
    return <PushDiagnosticsScreen />;
}
