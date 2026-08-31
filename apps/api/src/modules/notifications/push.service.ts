import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

export interface PushResult {
  ok: boolean;
  reason?: string;
  /** Tokens the service reported as permanently dead. */
  invalidTokens: string[];
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

/**
 * Push delivery through Expo's service, which fans out to APNs and FCM.
 *
 * Using Expo rather than talking to APNs and FCM directly keeps one code path
 * for both platforms and means the p8 key and FCM service account live with the
 * build service rather than in this repository. Swapping to direct delivery
 * later is a change confined to this file, because everything above it works in
 * terms of `PushMessage`.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly config: ConfigService) {}

  async send(tokens: string[], message: PushMessage): Promise<PushResult> {
    if (tokens.length === 0) return { ok: true, invalidTokens: [] };

    const invalidTokens: string[] = [];
    let ok = true;
    let reason: string | undefined;

    for (let index = 0; index < tokens.length; index += BATCH_SIZE) {
      const batch = tokens.slice(index, index + BATCH_SIZE);
      const messages = batch.map((token) => ({
        to: token,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: 'default',
        ...(message.channelId ? { channelId: message.channelId } : {}),
        priority: 'high' as const,
      }));

      try {
        const accessToken = this.config.get<string>('expoAccessToken');
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          ok = false;
          reason = `push_http_${response.status}`;
          continue;
        }

        const payload = (await response.json()) as {
          data?: { status: string; message?: string; details?: { error?: string } }[];
        };

        payload.data?.forEach((ticket, ticketIndex) => {
          if (ticket.status === 'error') {
            // `DeviceNotRegistered` means the app was uninstalled — the only
            // error worth retiring a token over. Everything else is transient.
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const token = batch[ticketIndex];
              if (token) invalidTokens.push(token);
            } else {
              ok = false;
              reason = ticket.details?.error ?? ticket.message ?? 'push_failed';
            }
          }
        });
      } catch (error) {
        ok = false;
        reason = 'push_network_error';
        this.logger.warn(`Push delivery failed: ${String(error)}`);
      }
    }

    return { ok, ...(reason ? { reason } : {}), invalidTokens };
  }
}
