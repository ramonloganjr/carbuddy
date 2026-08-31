import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Biometric app lock.
 *
 * Guards the app itself, not the API tokens — see `lib/auth/session.ts` for why
 * gating the tokens would break background sync. The lock exists because a
 * phone left on a table is the realistic threat here: the app holds
 * registration documents, insurance policies and spending history.
 */

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  /** Human name for the prompt: "Face ID", "Touch ID", "fingerprint". */
  label: string;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [available, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  const label =
    Platform.OS === 'ios'
      ? hasFace
        ? 'Face ID'
        : 'Touch ID'
      : hasFace
        ? 'face unlock'
        : hasFingerprint
          ? 'fingerprint'
          : 'screen lock';

  return { available, enrolled, label };
}

export type UnlockResult = 'success' | 'cancelled' | 'failed' | 'unavailable';

export async function authenticate(reason = 'Unlock CarBuddy'): Promise<UnlockResult> {
  const capability = await getBiometricCapability();
  if (!capability.available || !capability.enrolled) return 'unavailable';

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // Falling back to the device passcode matters: a user with a wet thumb or a
    // mask on must still be able to get into their own records.
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });

  if (result.success) return 'success';
  if ('error' in result && (result.error === 'user_cancel' || result.error === 'system_cancel')) {
    return 'cancelled';
  }
  return 'failed';
}
