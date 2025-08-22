/**
 * Content Strategy Module
 *
 * Defines content generation strategies and types for X/Twitter integration
 */

export interface ContentStrategy {
  type:
    | "educational"
    | "comparison"
    | "testimonial"
    | "feature"
    | "community"
    | "philosophical";
  tone: "confident" | "helpful" | "amused" | "passionate" | "contemplative";
  cultScore: number; // 0-1, how subtly we're building loyalty
}

export type ContentType = ContentStrategy["type"];

export interface ContentTemplate {
  template: string;
  variables: Record<string, string>;
  maxLength: number;
  hashtags: string[];
}

export interface ContentGenerationOptions {
  category?: string;
  tone?: ContentStrategy["tone"];
  includeHashtags?: boolean;
  maxLength?: number;
  targetAudience?: string;
  cultScore?: number;
}
