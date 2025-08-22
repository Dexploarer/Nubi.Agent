import { ZodType } from 'zod';
/**
 * Validate input against a Zod schema
 */
export declare function validateInput<T>(schema: ZodType<T>, data: unknown): T;
/**
 * Validate that media data is properly formatted
 */
export declare function validateMediaData(mediaData: {
    data: string;
    mediaType: string;
}[]): void;
/**
 * Validate poll options
 */
export declare function validatePollOptions(options: {
    label: string;
}[]): void;
