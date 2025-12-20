import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { initDatabase } from '@/lib/database';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
  isWeb: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      await initDatabase();
      setIsReady(true);
    } catch (err) {
      console.error('Database initialization error:', err);
      // On web, we use mock database, so just set ready
      if (isWeb) {
        setIsReady(true);
      } else {
        setError(err instanceof Error ? err : new Error('Unknown database error'));
      }
    }
  };

  return (
    <DatabaseContext.Provider value={{ isReady, error, isWeb }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

