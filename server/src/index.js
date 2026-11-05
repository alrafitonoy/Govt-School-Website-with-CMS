// A configured site starts normally. Otherwise the installation wizard runs first,
// and the site takes over from it in this same process once the settings are saved.
import { isConfigured } from './core/configFile.js';

export async function start(setHandler) {
  if (!isConfigured()) {
    const { runInstaller } = await import('./install/installer.js');
    await runInstaller(setHandler);
  }
  const { app } = await import('./app.js');
  setHandler(app);
}
