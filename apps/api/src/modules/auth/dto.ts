import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignUpDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @MaxLength(320)
  email!: string;

  /**
   * Minimum 8, maximum 128.
   *
   * The upper bound is not cosmetic: Argon2 hashing cost grows with input
   * length, so an unbounded password field is a cheap denial-of-service vector.
   * There is deliberately no composition rule — length beats a mandated symbol,
   * which just produces `Password1!`.
   */
  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters.' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @Length(1, 80)
  @Transform(({ value }) => String(value).trim())
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}

export class SignInDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}

export class RefreshDto {
  @IsString()
  @MaxLength(512)
  refreshToken!: string;
}

export interface AuthTokensResponse {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}
