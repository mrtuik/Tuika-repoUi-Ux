import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.tuika.uiux',
  appName: 'Tuika UI/UX',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: { StatusBar: { backgroundColor: '#FFFFFF', style: 'LIGHT', overlaysWebView: false } },
}

export default config
