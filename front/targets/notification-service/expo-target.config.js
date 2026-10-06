/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'notification-service',
  name: 'NotificationService',
  bundleIdentifier: '.NotificationService',
  // Must not exceed the main app's deployment target (expo-build-properties ios.deploymentTarget).
  deploymentTarget: '16.0',
  frameworks: ['UserNotifications'],
});
