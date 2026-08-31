import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, randomUUID } from 'node:crypto';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/current-user.decorator';

/** 15 MB. Large enough for a phone photo, small enough to bound storage cost. */
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * An allow-list, not a deny-list.
 *
 * Users upload receipt photos and PDF policies. Accepting arbitrary types would
 * let the bucket become a file host, and a stored SVG or HTML file served from
 * the same origin is a stored-XSS vector.
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
] as const;

export class CreateUploadUrlDto {
  @IsIn(['fuel_record', 'maintenance_record', 'document', 'expense', 'vehicle'])
  ownerType!: 'fuel_record' | 'maintenance_record' | 'document' | 'expense' | 'vehicle';

  @IsString() @MaxLength(64) ownerId!: string;
  @IsString() @MaxLength(255) fileName!: string;

  @IsIn(ALLOWED_MIME_TYPES)
  mimeType!: (typeof ALLOWED_MIME_TYPES)[number];

  @IsInt() @Min(1) @Max(MAX_ATTACHMENT_BYTES) byteSize!: number;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issue a short-lived, single-purpose upload URL.
   *
   * The file goes from the device straight to object storage and never through
   * the API. That keeps multi-megabyte photos off the application servers
   * entirely, and means write access is granted by a URL that expires in
   * minutes rather than by a credential shipped inside the app.
   *
   * The storage key is server-generated. Letting a client choose it would allow
   * one user to overwrite another's object by guessing a path.
   */
  async createUploadUrl(userId: string, dto: CreateUploadUrlDto) {
    await this.assertOwnsParent(userId, dto.ownerType, dto.ownerId);

    const attachmentId = randomUUID();
    const extension = extensionFor(dto.mimeType);
    const storageKey = `u/${userId}/${dto.ownerType}/${dto.ownerId}/${attachmentId}${extension}`;

    await this.prisma.attachment.create({
      data: {
        id: attachmentId,
        userId,
        fileName: sanitiseFileName(dto.fileName),
        mimeType: dto.mimeType,
        byteSize: dto.byteSize,
        storageKey,
        uploadState: 'pending',
        ...this.parentLink(dto.ownerType, dto.ownerId),
      },
    });

    const ttl = this.config.get<number>('storage.signedUrlTtlSeconds') ?? 900;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      attachmentId,
      uploadUrl: this.sign('PUT', storageKey, expiresAt, dto.mimeType),
      expiresAt: expiresAt.toISOString(),
      maxBytes: MAX_ATTACHMENT_BYTES,
    };
  }

  async getDownloadUrl(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, userId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    const ttl = this.config.get<number>('storage.signedUrlTtlSeconds') ?? 900;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      url: this.sign('GET', attachment.storageKey, expiresAt),
      expiresAt: expiresAt.toISOString(),
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    };
  }

  /**
   * Confirm the record the attachment is being pinned to belongs to this user.
   *
   * Without this an authenticated user could attach a file to someone else's
   * service record simply by supplying its id.
   */
  private async assertOwnsParent(
    userId: string,
    ownerType: CreateUploadUrlDto['ownerType'],
    ownerId: string,
  ): Promise<void> {
    const owned = await (async () => {
      switch (ownerType) {
        case 'vehicle':
          return this.prisma.vehicle.findFirst({
            where: { id: ownerId, userId },
            select: { id: true },
          });
        case 'document':
          return this.prisma.document.findFirst({
            where: { id: ownerId, userId },
            select: { id: true },
          });
        case 'fuel_record':
          return this.prisma.fuelRecord.findFirst({
            where: { id: ownerId, vehicle: { userId } },
            select: { id: true },
          });
        case 'maintenance_record':
          return this.prisma.maintenanceRecord.findFirst({
            where: { id: ownerId, vehicle: { userId } },
            select: { id: true },
          });
        case 'expense':
          return this.prisma.expense.findFirst({
            where: { id: ownerId, vehicle: { userId } },
            select: { id: true },
          });
      }
    })();

    if (!owned) throw new BadRequestException('That record does not exist on this account.');
  }

  private parentLink(ownerType: CreateUploadUrlDto['ownerType'], ownerId: string) {
    switch (ownerType) {
      case 'fuel_record':
        return { fuelRecordId: ownerId };
      case 'maintenance_record':
        return { maintenanceRecordId: ownerId };
      case 'document':
        return { documentId: ownerId };
      case 'expense':
        return { expenseId: ownerId };
      case 'vehicle':
        return {};
    }
  }

  /**
   * Build a pre-signed URL.
   *
   * This is an HMAC-based signature in the shape S3 and compatible services
   * expect. Swapping in the AWS SDK's own signer is a change confined to this
   * method — everything above it only ever sees a URL string.
   */
  private sign(method: 'GET' | 'PUT', key: string, expiresAt: Date, contentType?: string): string {
    const endpoint = this.config.get<string>('storage.endpoint') ?? '';
    const bucket = this.config.get<string>('storage.bucket') ?? '';
    const secret = this.config.get<string>('storage.secretAccessKey') ?? '';
    const accessKeyId = this.config.get<string>('storage.accessKeyId') ?? '';
    const expires = Math.floor(expiresAt.getTime() / 1000);

    // Content type is part of the signed payload for uploads, so a client
    // cannot obtain a URL for a PDF and then upload an HTML file with it.
    const payload = [method, bucket, key, String(expires), contentType ?? ''].join('\n');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');

    const params = new URLSearchParams({
      'X-Amz-Credential': accessKeyId,
      'X-Amz-Expires': String(expires),
      'X-Amz-Signature': signature,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    });

    return `${endpoint}/${bucket}/${key}?${params.toString()}`;
  }
}

/** Strip path separators so a filename cannot escape its prefix. */
function sanitiseFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').slice(0, 255);
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

@ApiTags('attachments')
@Controller({ path: 'attachments', version: '1' })
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Get a short-lived URL to upload a receipt or document scan.' })
  createUploadUrl(@CurrentUser('userId') userId: string, @Body() dto: CreateUploadUrlDto) {
    return this.attachments.createUploadUrl(userId, dto);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get a short-lived URL to download an attachment.' })
  getDownloadUrl(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachments.getDownloadUrl(userId, id);
  }
}

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
