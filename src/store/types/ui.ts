export interface SnackbarState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface ModalState {
  visible: boolean;
  modalId?: string;
  data?: any;
}

export interface UIState {
  modal: ModalState;
  loading: boolean;
  loadingMessage?: string;
  snackbar: SnackbarState;
  activeTab?: string;
  isTabBarVisible: boolean;
  statusBarStyle: 'light' | 'dark' | 'auto';
  orientation: 'portrait' | 'landscape';
}