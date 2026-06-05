-- New users should not appear "opted in" until they grant OS permission and register a push token.
ALTER TABLE "users" ALTER COLUMN "pushNotificationsConsent" SET DEFAULT false;
