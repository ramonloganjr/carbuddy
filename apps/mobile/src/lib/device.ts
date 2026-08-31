import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'carbuddy.device_id';
let cached: string | null = null;

/**
 * A stable per-install identifier.
 *
 * Generated locally and kept in the secure store rather than derived from any
 * hardware id: platform identifiers are either unavailable, unstable across
 * reinstalls, or restricted, and using one would tie a user's data to a device
 * fingerprint we have no business collecting. This value exists only to give
 * sync a deterministic tie-break between two devices writing at the same
 * instant, and to name push tokens.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // Secure store can be unavailable before first unlock on iOS.
  }

  const generated = Crypto.randomUUID();
  cached = generated;
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  } catch {
    // Fall through: an in-memory id still works for this session.
  }
  return generated;
}

export function describeDevice(): { name: string; platform: string; osVersion: string } {
  return {
    name: Device.deviceName ?? 'Unknown device',
    platform: Platform.OS,
    osVersion: String(Device.osVersion ?? ''),
  };
}
