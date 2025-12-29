import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.4ffc1df1cee04ff6b9847001b5ad1ea1',
  appName: 'S-Life Health',
  webDir: 'dist',
  server: {
    url: 'https://4ffc1df1-cee0-4ff6-b984-7001b5ad1ea1.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#14b8a6",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
