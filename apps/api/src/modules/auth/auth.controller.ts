import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService, type RequestContext } from './auth.service';
import { Public } from './jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RefreshDto, SignInDto, SignUpDto, type AuthTokensResponse } from './dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Create an account and return a session.' })
  // Tighter than the global limit: account creation is the endpoint bots hit.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  signUp(@Body() dto: SignUpDto, @Req() request: Request): Promise<AuthTokensResponse> {
    return this.authService.signUp(dto, contextFrom(request));
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a session.' })
  // Slows credential stuffing without inconveniencing a user who mistypes.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  signIn(@Body() dto: SignInDto, @Req() request: Request): Promise<AuthTokensResponse> {
    return this.authService.signIn(dto, contextFrom(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new session.' })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() request: Request): Promise<AuthTokensResponse> {
    return this.authService.refresh(dto.refreshToken, contextFrom(request));
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session.' })
  async signOut(
    @CurrentUser('userId') userId: string,
    @Body() dto: Partial<RefreshDto>,
  ): Promise<void> {
    await this.authService.signOut(userId, dto.refreshToken);
  }
}

function contextFrom(request: Request): RequestContext {
  return {
    // `x-forwarded-for` is only trustworthy behind a proxy configured with
    // `trust proxy`; main.ts sets that explicitly rather than assuming it.
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
