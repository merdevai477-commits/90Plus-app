export interface SecurityPermissions {
  camera: boolean;
  location: boolean;
  storage: boolean;
  contacts: boolean;
  microphone: boolean;
  notifications: boolean;
}

export interface SecurityState {
  pinEnabled: boolean;
  pin?: string; // Encrypted
  biometricEnabled: boolean;
  biometricType?: 'fingerprint' | 'face' | 'iris';
  permissions: SecurityPermissions;
  autoLockMinutes: number;
  lastLockTime?: number;
  failedAttempts: number;
  maxFailedAttempts: number;
  secureScreenshot: boolean;
}