import { getPB } from './pocketbase';
import type { RecordAuthResponse, RecordModel } from 'pocketbase';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'developer' | 'admin' | 'kasir' | 'agen' | 'spk';
  isActive: boolean;
  avatar?: string;
  created: string;
  updated: string;
}

export interface AuthState {
  user: RecordModel | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAnonymous: boolean;
}

// PocketBase Auth wrapper
export const auth = {
  // Current user state
  currentUser: null as RecordModel | null,
  
  // Check if authenticated
  get isAuthenticated(): boolean {
    const pb = getPB();
    return pb.authStore.isValid;
  },

  // Current user
  get currentUser(): RecordModel | null {
    const pb = getPB();
    return pb.authStore.model;
  },

  // Check if authenticated
  get isAuthenticated(): boolean {
    const pb = getPB();
    return pb.authStore.isValid;
  },

  // Check if anonymous
  get isAnonymous(): boolean {
    const user = this.currentUser;
    return user ? user.collectionName === 'users' && user.email?.includes('anonymous') : false;
  },

  // Initialize auth (call on app startup)
  async initialize(): Promise<void> {
    const pb = getPB();
    
    // Load from localStorage
    if (pb.authStore.isValid) {
      try {
        await pb.collection('users').authRefresh();
        console.log('[Auth] Session restored');
      } catch (e) {
        console.warn('[Auth] Session expired, clearing...');
        pb.authStore.clear();
      }
    }
  },

  // Anonymous login (for guest access)
  async signInAnonymously(): Promise<void> {
    const pb = getPB();
    try {
      // PocketBase doesn't have true anonymous auth like Firebase
      // Use a shared anonymous account or create temporary user
      await pb.collection('users').authWithPassword(
        'anonymous@bejo.local',
        'anonymous_password_123'
      );
    } catch (e) {
      // If anonymous user doesn't exist, create it
      try {
        await pb.collection('users').create({
          email: 'anonymous@bejo.local',
          password: 'anonymous_password_123',
          passwordConfirm: 'anonymous_password_123',
          name: 'Anonymous User',
          role: 'kasir',
          isActive: true
        });
        await pb.collection('users').authWithPassword(
          'anonymous@bejo.local',
          'anonymous_password_123'
        );
      } catch (e) {
        console.warn('[Auth] Anonymous login failed:', e);
      }
    }
  },

  // Email/Password Login
  async signInWithEmail(email: string, password: string): Promise<RecordModel> {
    const pb = getPB();
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  },

  // Register new user
  async signUp(email: string, password: string, name: string, role: string = 'kasir'): Promise<void> {
    const pb = getPB();
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
      role,
      isActive: true
    });
  },

  // Logout
  signOut(): void {
    const pb = getPB();
    pb.authStore.clear();
  },

  // Get current user
  getCurrentUser(): RecordModel | null {
    const pb = getPB();
    return pb.authStore.model;
  },

  // Check if authenticated
  isAuthenticated(): boolean {
    const pb = getPB();
    return pb.authStore.isValid;
  },

  // Get current user data
  getCurrentUser() {
    const pb = getPB();
    return pb.authStore.model;
  },

  // Refresh auth
  async refreshAuth(): Promise<boolean> {
    const pb = getPB();
    if (!pb.authStore.isValid) return false;
    
    try {
      await pb.collection('users').authRefresh();
      return true;
    } catch {
      pb.authStore.clear();
      return false;
    }
  },

  // Listen to auth changes
  onAuthChange(callback: (user: RecordModel | null) => void): () => void {
    const pb = getPB();
    return pb.authStore.onChange((token, model) => {
      callback(model);
    });
  }
};

// React hook untuk auth (jika pakai React)
export function useAuth() {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pb = getPB();
    
    // Initial load
    const checkAuth = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
          setUser(pb.authStore.model);
        } catch (e) {
          console.warn('[Auth] Session expired');
          pb.authStore.clear();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const pb = getPB();
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  }, []);

  const logout = useCallback(() => {
    const pb = getPB();
    pb.authStore.clear();
  }, []);

  const logout = useCallback(() => {
    const pb = getPB();
    pb.authStore.clear();
  }, []);

  return {
    user: pb.authStore.model,
    isAuthenticated: pb.authStore.isValid,
    isLoading: false,
    login,
    logout,
    signOut: logout,
  };
}