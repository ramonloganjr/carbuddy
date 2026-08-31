import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  deviceId?: string;
}

/**
 * Injects the authenticated user from the validated JWT.
 *
 * Controllers take the id from here and never from a route parameter or a
 * request body. That single rule removes an entire class of IDOR bugs: there is
 * no path by which a client can nominate whose data it is asking for.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
