import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Redirect } from 'expo-router';
import { PushDiagnosticsScreen } from '../components/dev/PushDiagnosticsScreen';

/** Dev / Expo Go only — hidden on production standalone builds. */
export default function PushDiagnosticsRoute() {
    const allowed =
        __DEV__ || Constants.executionEnvironment !== ExecutionEnvironment.Standalone;
    if (!allowed) {
        return <Redirect href="/" />;
    }
    return <PushDiagnosticsScreen />;
}
