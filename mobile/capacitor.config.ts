import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nyaku.snowify.mobile',
  appName: 'Snowify',
  webDir: 'www',
  server: {
    // For dev, uncomment and set to your local dev server:
    // url: 'http://192.168.1.x:5173',
    // cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#121212'
    }
  }
};

export default config;
