import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { LOCAL_SERVER_PORT, startLocalServer, stopLocalServer } from '@/api/local-server/server';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('LocalServer');

interface LocalServerState {
  pin: string;
  isRunning: boolean;
  port: number;
  generatePin: () => void;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
}

function generateRandomPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const useLocalServerStore = create<LocalServerState>()(
  persist(
    (set, get) => ({
      pin: generateRandomPin(),
      isRunning: false,
      port: LOCAL_SERVER_PORT,
      generatePin: () => {
        const newPin = generateRandomPin();
        set({ pin: newPin });

        if (get().isRunning) {
          debug('generatePin: server running, restarting with new pin');
          stopLocalServer()
            .then(() => startLocalServer(newPin))
            .catch(() => {
              debug('generatePin: restart failed, marking server stopped');
              set({ isRunning: false });
            });
        }
      },
      startServer: async () => {
        const { pin } = get();
        debug('startServer: starting on port', LOCAL_SERVER_PORT);
        await startLocalServer(pin);
        set({ isRunning: true });
        debug('startServer: started successfully');
      },
      stopServer: async () => {
        try {
          await stopLocalServer();
        } catch (err) {
          debug('stopServer: stopLocalServer failed', err);
        } finally {
          set({ isRunning: false });
        }
      },
    }),
    {
      name: 'local-server-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ pin: state.pin }),
    }
  )
);
