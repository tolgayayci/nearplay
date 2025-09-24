import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { LandingPage } from '@/pages/LandingPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { EditorPage } from '@/pages/EditorPage';
import { SharedProjectPage } from '@/pages/SharedProjectPage';
import { GAPageView } from '@/components/analytics/GAPageView';
import { initGA } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { User } from '@/lib/types';
import { createInitialProjects } from '@/lib/auth';

// Auth context for centralized state management
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Auth guard component - now uses centralized auth state
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if loading is complete and user is not authenticated
    if (!isLoading && !isAuthenticated) {
      console.log('PrivateRoute: User not authenticated, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}

// Auth Provider component for centralized authentication state
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
      if (session?.user) {
        await refreshUser();
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  // Initial auth check - runs only once
  useEffect(() => {
    // Skip if already initialized or currently initializing
    if (isInitialized || !isLoading) return;
    
    let isMounted = true;
    
    const checkInitialAuth = async () => {
      console.log('AuthProvider: Starting initial auth check');
      
      try {
        // First check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (!session?.user) {
          console.log('AuthProvider: No session found');
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }

        console.log('AuthProvider: Session found, fetching database user:', session.user.id);
        setIsAuthenticated(true);

        // Get or create user with retry logic
        let userData = null;
        let retries = 0;
        const maxRetries = 3;
        
        while (!userData && retries < maxRetries && isMounted) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (data) {
            userData = data;
            break;
          }
          
          if (error?.code === 'PGRST116') {
            // User doesn't exist, create it
            const { data: newUser } = await supabase
              .from('users')
              .insert({
                id: session.user.id,
                email: session.user.email,
              })
              .select()
              .single();
            
            if (newUser) {
              userData = newUser;
              // Create initial projects for new user
              try {
                await createInitialProjects(session.user.id);
                console.log('AuthProvider: Initial projects created');
              } catch (projectError) {
                console.error('AuthProvider: Failed to create initial projects:', projectError);
              }
              break;
            }
          }
          
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
        
        if (!isMounted) return;
        
        if (userData) {
          console.log('AuthProvider: User ready:', userData.email);
          setUser(userData);
        } else {
          console.error('AuthProvider: Failed to get/create user after retries');
          setUser(null);
        }
        
        setIsLoading(false);
        setIsInitialized(true);
      } catch (error) {
        console.error('AuthProvider: Initial auth check failed:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    checkInitialAuth();

    return () => {
      isMounted = false;
    };
  }, []); // Empty deps - runs only once

  // Separate effect for auth state listener
  useEffect(() => {
    // Refresh session periodically to prevent expiry
    const refreshInterval = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Failed to refresh session:', error);
        // If refresh fails, check auth state
        await checkAuth();
      } else if (session) {
        console.log('Session refreshed successfully');
        // Update user data on refresh
        await refreshUser();
      }
    }, 10 * 60 * 1000); // Refresh every 10 minutes

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthProvider: Auth state changed:', event, !!session?.user);
      
      const isAuthed = !!session?.user;
      setIsAuthenticated(isAuthed);

      // Only handle actual sign-in events, not initial page loads
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is a real sign-in event (not initial page load)
        // Initial page load is handled by the initial auth check
        if (!user && isInitialized) {
          try {
            // Check if user record exists in our database
            const { data: existingUser, error: checkError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError;
            }

            if (!existingUser) {
              // Create user record for new user
              const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                })
                .select()
                .single();

              if (insertError) throw insertError;

              // Create initial projects for new user
              try {
                await createInitialProjects(session.user.id);
                console.log('AuthProvider: New user created with initial projects:', newUser.email);
              } catch (projectError) {
                console.error('AuthProvider: Failed to create initial projects:', projectError);
              }
              
              setUser(newUser);
            } else {
              setUser(existingUser);
            }
            
            // Important: Set loading states to false after successfully handling sign in
            setIsLoading(false);
            setIsInitialized(true);
          } catch (error) {
            console.error('AuthProvider: Error handling sign in:', error);
            setUser(null);
            setIsLoading(false);
            setIsInitialized(true);
          }

          // Navigate to projects if on landing page
          if (location.pathname === '/' && !location.state?.fromAuth) {
            navigate('/projects', { replace: true, state: { fromAuth: true } });
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        setIsInitialized(true);
        navigate('/', { replace: true });
      }
    });

    return () => {
      clearInterval(refreshInterval);
      subscription.unsubscribe();
    };
  }, []); // Empty deps - prevent re-runs

  // Loading timeout fallback - preserve authenticated state
  useEffect(() => {
    if (!isLoading) return;
    
    const timeout = setTimeout(() => {
      if (isLoading && !isInitialized) {
        console.warn('AuthProvider: Loading timeout reached');
        setIsLoading(false);
        setIsInitialized(true);
        // Keep existing auth state, don't force logout
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, isInitialized]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, refreshUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function App() {
  const location = useLocation();
  const isPublicRoute = location.pathname === '/';

  useEffect(() => {
    // Initialize GA on public routes
    if (isPublicRoute) {
      initGA();
    }
  }, [isPublicRoute]);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const isPublicRoute = location.pathname === '/' || location.pathname.includes('/shared') || location.pathname.startsWith('/s/');

  // Show loading state while checking initial auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Redirect authenticated users to projects page if they try to access landing page
  if (isAuthenticated && location.pathname === '/') {
    return <Navigate to="/projects" replace />;
  }

  // For public routes (landing page and shared projects), don't use ThemeProvider
  if (isPublicRoute) {
    return (
      <>
        {location.pathname === '/' && <GAPageView />}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/projects/:id/shared" element={<SharedProjectPage />} />
          <Route path="/s/:token" element={<SharedProjectPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </>
    );
  }

  // For authenticated routes, use ThemeProvider for dark/light mode support
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Routes>
        {/* Protected routes */}
        <Route path="/projects" element={
          <PrivateRoute>
            <ProjectsPage />
          </PrivateRoute>
        } />
        <Route path="/projects/:id" element={
          <PrivateRoute>
            <EditorPage />
          </PrivateRoute>
        } />

        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;