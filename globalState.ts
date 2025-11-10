import { DiamondProfile } from './components/Profile/DiamondCard';

export const globalState = {
  userType: 'guest',
  username: '',
  userProfile: null as DiamondProfile | null,
  isLoggedIn: false,
  setUserType: (type: 'guest' | 'admin' | 'diamond') => {
    globalState.userType = type;
    if (type === 'admin' || type === 'diamond') {
      globalState.username = 'mahmoud_essam';
      globalState.isLoggedIn = true;
    } else {
      globalState.username = '';
      globalState.isLoggedIn = false;
    }
  },
  setUserProfile: (profile: DiamondProfile | null) => {
    globalState.userProfile = profile;
  },
  login: (username: string, password: string) => {
    // Mock login logic
    if (username === 'mahmoud_essam' && password === 'password') {
      globalState.userType = 'diamond';
      globalState.username = username;
      globalState.isLoggedIn = true;
      return true;
    }
    return false;
  },
  logout: () => {
    globalState.userType = 'guest';
    globalState.username = '';
    globalState.userProfile = null;
    globalState.isLoggedIn = false;
  }
};
