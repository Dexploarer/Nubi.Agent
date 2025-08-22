import { ZodType, ZodError } from 'zod';
import { TwitterMcpError } from '../types.js';
import { Buffer } from 'node:buffer';

/**
 * Validate input against a Zod schema
 */
export function validateInput<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      throw new TwitterMcpError(`Validation error: ${issues}`, 'validation_error', 400);
    }
    throw new TwitterMcpError(
      `Unexpected validation error: ${(error as Error).message}`,
      'validation_error',
      400
    );
  }
}

/**
 * Validate that media data is properly formatted
 */
export function validateMediaData(mediaData: { data: string; mediaType: string }[]): void {
  // Check number of media items
  if (mediaData.length > 4) {
    throw new TwitterMcpError(
      'Maximum of 4 media items allowed per tweet',
      'media_validation_error',
      400
    );
  }

  // Check if there's more than one video
  const videoCount = mediaData.filter((item) => item.mediaType.startsWith('video/')).length;

  if (videoCount > 1) {
    throw new TwitterMcpError('Only one video allowed per tweet', 'media_validation_error', 400);
  }

  // If we have both video and images, reject
  if (videoCount > 0 && mediaData.length > videoCount) {
    throw new TwitterMcpError(
      'Cannot mix videos and images in the same tweet',
      'media_validation_error',
      400
    );
  }

  // Validate each media item
  for (const item of mediaData) {
    // Check media type
    if (!isValidMediaType(item.mediaType)) {
      throw new TwitterMcpError(
        `Unsupported media type: ${item.mediaType}`,
        'media_validation_error',
        400
      );
    }

    // Validate base64 data
    try {
      // Use Node.js Buffer for base64 validation
      const buffer = Buffer.from(item.data, 'base64');
      // Basic size check (512MB max for videos, 5MB max for images)
      const maxSize = item.mediaType.startsWith('video/') ? 512 * 1024 * 1024 : 5 * 1024 * 1024;
      if (buffer.length > maxSize) {
        throw new TwitterMcpError(
          `Media file too large (max ${maxSize / (1024 * 1024)}MB)`,
          'media_validation_error',
          400
        );
      }
    } catch (error) {
      throw new TwitterMcpError(
        `Invalid base64 data for media: ${error instanceof Error ? error.message : String(error)}`,
        'media_validation_error',
        400
      );
    }
  }
}

/**
 * Check if the media type is supported
 */
function isValidMediaType(mediaType: string): boolean {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4'];

  return supportedTypes.includes(mediaType);
}

/**
 * Validate poll options
 */
export function validatePollOptions(options: { label: string }[]): void {
  if (options.length < 2 || options.length > 4) {
    throw new TwitterMcpError(
      'Polls must have between 2 and 4 options',
      'poll_validation_error',
      400
    );
  }

  // Check for duplicate options
  const labels = options.map((option) => option.label);
  const uniqueLabels = new Set(labels);
  if (uniqueLabels.size !== labels.length) {
    throw new TwitterMcpError('Poll options must be unique', 'poll_validation_error', 400);
  }

  // Check label lengths
  for (const option of options) {
    if (option.label.length > 25) {
      throw new TwitterMcpError(
        'Poll option labels cannot exceed 25 characters',
        'poll_validation_error',
        400
      );
    }
  }
}
