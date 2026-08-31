import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Environment-aware Expo config.
 *
 * The three environments ship as three separate apps with distinct bundle
 * identifiers, so a developer can have development, staging and production
 * installed side by side on one device without them overwriting each other or
 * sharing a keychain, database, or push token. `APP_ENV` selects which.
 */
type AppEnvironment = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV ?? 'development') as AppEnvironment;

interface EnvironmentConfig {
  name: string;
  scheme: string;
  bundleIdentifier: string;
  androidPackage: string;
  apiUrl: string;
  /** Verbose logging and the in-app debug panel. */
  enableDevTools: boolean;
  iconSuffix: string;
}

const ENVIRONMENTS: Record<AppEnvironment, EnvironmentConfig> = {
  development: {
    name: 'CarBuddy Dev',
    scheme: 'carbuddy-dev',
    bundleIdentifier: 'com.carbuddy.app.dev',
    androidPackage: 'com.carbuddy.app.dev',
    apiUrl: process.env.API_URL ?? 'http://localhost:4000',
    enableDevTools: true,
    iconSuffix: '-dev',
  },
  staging: {
    name: 'CarBuddy Staging',
    scheme: 'carbuddy-staging',
    bundleIdentifier: 'com.carbuddy.app.staging',
    androidPackage: 'com.carbuddy.app.staging',
    apiUrl: process.env.API_URL ?? 'https://staging-api.carbuddy.app',
    enableDevTools: true,
    iconSuffix: '-staging',
  },
  production: {
    name: 'CarBuddy',
    scheme: 'carbuddy',
    bundleIdentifier: 'com.carbuddy.app',
    androidPackage: 'com.carbuddy.app',
    apiUrl: process.env.API_URL ?? 'https://api.carbuddy.app',
    enableDevTools: false,
    iconSuffix: '',
  },
};

const env = ENVIRONMENTS[APP_ENV];

/**
 * `versionCode` / `buildNumber` are managed remotely by EAS (see eas.json), so
 * they are deliberately absent here — hardcoding them causes duplicate-build
 * rejections from both stores.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: env.name,
  slug: 'carbuddy',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: env.scheme,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FBF8FF',
    dark: {
      image: './assets/splash-dark.png',
      backgroundColor: '#121318',
    },
  },

  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: true,
    bundleIdentifier: env.bundleIdentifier,
    // Required for the App Store: exempts the app from export-compliance
    // paperwork on every submission, since it only uses standard HTTPS.
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription:
        'CarBuddy uses the camera so you can photograph fuel receipts, service invoices and vehicle documents.',
      NSPhotoLibraryUsageDescription:
        'CarBuddy needs access to your photos so you can attach existing receipts and vehicle images to your records.',
      NSPhotoLibraryAddUsageDescription:
        'CarBuddy saves exported reports and document copies to your photo library.',
      NSFaceIDUsageDescription:
        'CarBuddy uses Face ID to unlock your vehicle documents and keep your records private.',
      UIBackgroundModes: ['remote-notification', 'fetch', 'processing'],
      ITSAppUsesNonExemptEncryption: false,
    },
    entitlements: {
      'aps-environment': APP_ENV === 'production' ? 'production' : 'development',
    },
    associatedDomains:
      APP_ENV === 'production' ? ['applinks:carbuddy.app', 'applinks:www.carbuddy.app'] : [],
  },

  android: {
    package: env.androidPackage,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#0B57D0',
    },
    // Edge-to-edge is the Material 3 default on Android 15+, and required
    // for the expressive layouts to reach behind the system bars.
    edgeToEdgeEnabled: true,
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_BIOMETRIC',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SCHEDULE_EXACT_ALARM',
    ],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'carbuddy.app', pathPrefix: '/vehicle' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-task-manager',
    'expo-background-task',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FBF8FF',
        dark: { image: './assets/splash-dark.png', backgroundColor: '#121318' },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0B57D0',
        defaultChannel: 'general',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'CarBuddy needs access to your photos so you can attach receipts and vehicle images.',
        cameraPermission: 'CarBuddy uses the camera so you can photograph receipts and documents.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'CarBuddy uses Face ID to unlock your vehicle documents.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '15.1', useFrameworks: 'static' },
        android: { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 24 },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  /** Reachable at runtime via `expo-constants`. Never put secrets here. */
  extra: {
    appEnv: APP_ENV,
    apiUrl: env.apiUrl,
    enableDevTools: env.enableDevTools,
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '00000000-0000-0000-0000-000000000000' },
  },

  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID ?? '00000000-0000-0000-0000-000000000000'}`,
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'appVersion' },
});
