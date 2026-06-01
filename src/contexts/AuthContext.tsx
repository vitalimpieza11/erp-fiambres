import React, {
  createContext,
  useContext,
  useState
} from 'react';

interface AuthContextType {
  currentUser: any;
  loading: boolean;
  login: (
    email: string,
    pass: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return context;
}

export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}) {
  // USUARIO FALSO PARA DEBUG
  const [currentUser] = useState({
    uid: 'debug-user',
    email: 'debug@local.com'
  });

  async function login() {
    return;
  }

  async function logout() {
    return;
  }

  const value = {
    currentUser,
    loading: false,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}