import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisaabai.app',
  appName: 'Hisaab AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['192.168.43.48', 'localhost']
  }
};

export default config;
