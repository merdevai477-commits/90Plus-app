import React from 'react';
import NotificationScreen from '../components/notifications/NotificationScreen';
import { NotificationErrorBoundary } from '../components/notifications/NotificationErrorBoundary';

export default function NotificationsScreen() {
  return (
    <NotificationErrorBoundary>
      <NotificationScreen />
    </NotificationErrorBoundary>
  );
}
