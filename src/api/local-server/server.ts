import { HttpServer } from 'react-native-nitro-http-server';

import { createRouter } from './router';
import { WEB_UI_HTML } from './web-ui';

const PORT = 7676;

let serverInstance: HttpServer | null = null;

export async function startLocalServer(pin: string): Promise<void> {
  if (serverInstance) return;

  const router = createRouter(pin, WEB_UI_HTML);
  serverInstance = new HttpServer();
  await serverInstance.start(PORT, router, '0.0.0.0');
}

export async function stopLocalServer(): Promise<void> {
  if (!serverInstance) return;
  await serverInstance.stop();
  serverInstance = null;
}

export const LOCAL_SERVER_PORT = PORT;
