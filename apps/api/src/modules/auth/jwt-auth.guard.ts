import { Injectable, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt a route out of authentication. Everything else requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Applied globally, so authentication is the default and exposure is opt-in.
 *
 * The inverse — guarding each controller individually — means a new endpoint is
 * public until someone remembers to protect it, and the failure is silent.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
