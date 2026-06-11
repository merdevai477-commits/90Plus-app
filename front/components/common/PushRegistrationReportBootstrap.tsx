/**
 * Logs one push registration report on cold start (before sign-in).
 */
import { useEffect, useRef } from 'react';
import { logPushRegistrationReport } from '../../services/pushRegistrationReport.service';
import { pushStep } from '../../utils/pushTrace';

export function PushRegistrationReportBootstrap() {
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        pushStep('1', 'App started — cold start (before sign-in)');
        void logPushRegistrationReport('app-cold-start');
    }, []);

    return null;
}
