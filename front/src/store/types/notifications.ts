export interface NotificationTypes {
  marketing: boolean;
  system: boolean;
  messages: boolean;
  updates: boolean;
  reminders: boolean;
}

export interface NotificationSchedule {
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
  daysEnabled: boolean[];   // [Mon, Tue, Wed, ...]
}

export interface NotificationsState {
  enabled: boolean;
  types: NotificationTypes;
  pushToken?: string;
  sound: boolean;
  vibration: boolean;
  badge: boolean;
  schedule?: NotificationSchedule;
  lastNotificationId?: string;
}