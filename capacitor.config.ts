import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.tuika.uiux',
  appName: 'Tuika UI/UX',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    // fetch() goes through the native stack, so photo search/download is not blocked by CORS
    CapacitorHttp: { enabled: true },
    StatusBar: { backgroundColor: '#FFFFFF', style: 'LIGHT', overlaysWebView: false },
  },
}

export default config
