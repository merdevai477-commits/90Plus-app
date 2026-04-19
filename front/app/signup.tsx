import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Signup Screen - Redirects to the main auth flow.
 * Clerk authentication is fully implemented in /auth/index.tsx.
 */
export default function SignupScreen() {
    useEffect(() => {
        // Redirect to the working Clerk auth flow
        router.replace('/auth');
    }, []);

    return null;
}
