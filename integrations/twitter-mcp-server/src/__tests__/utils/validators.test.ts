import { validateInput, validateMediaData, validatePollOptions } from '../../utils/validators.js';
import { TwitterMcpError } from '../../types.js';
import * as zod from 'zod';

describe('Validators', () => {
  describe('validateInput', () => {
    const schema = zod.object({
      username: zod.string().min(1),
      count: zod.number().min(1).max(100).default(20)
    });

    test('should validate valid input', () => {
      const input = { username: 'testuser' };
      const result = validateInput(schema, input);
      expect(result).toEqual({ username: 'testuser', count: 20 });
    });

    test('should throw error for invalid input', () => {
      const input = { username: '' };
      expect(() => validateInput(schema, input)).toThrow(TwitterMcpError);
    });
  });

  describe('validateMediaData', () => {
    test('should validate valid media data', () => {
      const media = [
        { data: Buffer.from('test').toString('base64'), mediaType: 'image/jpeg' }
      ];
      expect(() => validateMediaData(media)).not.toThrow();
    });

    test('should throw error for too many media items', () => {
      const media = Array(5).fill({ data: Buffer.from('test').toString('base64'), mediaType: 'image/jpeg' });
      expect(() => validateMediaData(media)).toThrow(/Maximum of 4 media items/);
    });

    test('should throw error for multiple videos', () => {
      const media = [
        { data: Buffer.from('test').toString('base64'), mediaType: 'video/mp4' },
        { data: Buffer.from('test').toString('base64'), mediaType: 'video/mp4' }
      ];
      expect(() => validateMediaData(media)).toThrow(/Only one video allowed/);
    });

    test('should throw error for mixing videos and images', () => {
      const media = [
        { data: Buffer.from('test').toString('base64'), mediaType: 'video/mp4' },
        { data: Buffer.from('test').toString('base64'), mediaType: 'image/jpeg' }
      ];
      expect(() => validateMediaData(media)).toThrow(/Cannot mix videos and images/);
    });

    test('should throw error for unsupported media type', () => {
      const media = [
        { data: Buffer.from('test').toString('base64'), mediaType: 'application/pdf' }
      ];
      expect(() => validateMediaData(media)).toThrow(/Unsupported media type/);
    });
  });

  describe('validatePollOptions', () => {
    test('should validate valid poll options', () => {
      const options = [
        { label: 'Option 1' },
        { label: 'Option 2' }
      ];
      expect(() => validatePollOptions(options)).not.toThrow();
    });

    test('should throw error for too few options', () => {
      const options = [
        { label: 'Option 1' }
      ];
      expect(() => validatePollOptions(options)).toThrow(/Polls must have between 2 and 4 options/);
    });

    test('should throw error for too many options', () => {
      const options = [
        { label: 'Option 1' },
        { label: 'Option 2' },
        { label: 'Option 3' },
        { label: 'Option 4' },
        { label: 'Option 5' }
      ];
      expect(() => validatePollOptions(options)).toThrow(/Polls must have between 2 and 4 options/);
    });

    test('should throw error for duplicate options', () => {
      const options = [
        { label: 'Option 1' },
        { label: 'Option 1' }
      ];
      expect(() => validatePollOptions(options)).toThrow(/Poll options must be unique/);
    });

    test('should throw error for options that are too long', () => {
      const options = [
        { label: 'Option 1' },
        { label: 'This option label is way too long and exceeds the maximum length of twenty-five characters' }
      ];
      expect(() => validatePollOptions(options)).toThrow(/Poll option labels cannot exceed 25 characters/);
    });
  });
});