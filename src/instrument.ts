/**
 * Starts Sentry. main.ts must import this before anything else: Sentry can
 * only instrument modules (express, http) that are required after it starts.
 */
import 'dotenv/config';
import { initializeSentry } from './config/sentry.config';

initializeSentry();
