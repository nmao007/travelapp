import * as Sentry from '@sentry/react-native';

// Crash reporting with Sentry. It stays off until a DSN is set in
// apps/mobile/.env (EXPO_PUBLIC_SENTRY_DSN), and it never runs in development
// builds. Reports carry the error, app version and device model: no email,
// trips or location (sendDefaultPii is off), as the privacy policy says.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const crashReportsOn = Boolean(dsn) && !__DEV__;

if (crashReportsOn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
  });
}

// Wraps the root component so render errors are reported too. Without a DSN
// it changes nothing.
export const withCrashReports = (component: () => React.ReactNode) =>
  crashReportsOn ? Sentry.wrap(component) : component;
