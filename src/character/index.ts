/**
 * Character Module - NUBI character definition and personality management
 *
 * This module defines the NUBI character, personality traits, templates,
 * and character-related functionality.
 */

import { Content } from "@elizaos/core";

// Re-export core types
export type { Character, Memory, State, Content } from "../core";

// Character types
export interface CharacterTraits {
  personality: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  adjectives: string[];
  topics: string[];
  knowledge: CharacterKnowledge;
}

export interface CharacterKnowledge {
  core: string[];
  files: string[];
  settings: {
    chunkSize: number;
    chunkOverlap: number;
    retrievalLimit: number;
    similarityThreshold: number;
  };
}

export interface CharacterConfig {
  name: string;
  username: string;
  bio: string[];
  system: string;
  messageExamples: Array<
    Array<{
      name: string;
      content: Content;
    }>
  >;
  traits: CharacterTraits;
  plugins: string[];
  settings: CharacterSettings;
}

export interface CharacterSettings {
  secrets: Record<string, unknown>;
  model: string;
  embeddingModel: string;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  adapters: string[];
  databaseUrl: string;
}

// Template types
export interface MessageTemplate {
  name: string;
  content: string;
  variables: string[];
  context: string[];
}

export interface ResponseTemplate {
  pattern: string;
  responses: string[];
  context: string[];
  priority: number;
}

// Character exports
export { nubiCharacter } from "./nubi-character";
export { nubiTemplates } from "./nubi-templates";

// Utility functions
export function createCharacterConfig(
  name: string,
  username: string,
  bio: string[],
  system: string,
): CharacterConfig {
  return {
    name,
    username,
    bio,
    system,
    messageExamples: [],
    traits: {
      personality: [],
      style: { all: [], chat: [], post: [] },
      adjectives: [],
      topics: [],
      knowledge: {
        core: [],
        files: [],
        settings: {
          chunkSize: 1000,
          chunkOverlap: 200,
          retrievalLimit: 5,
          similarityThreshold: 0.7,
        },
      },
    },
    plugins: [],
    settings: {
      secrets: {},
      model: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-small",
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0.6,
      presencePenalty: 0.6,
      adapters: ["postgres"],
      databaseUrl: "",
    },
  };
}

export function validateCharacterConfig(config: CharacterConfig): boolean {
  return !!(
    config.name &&
    config.username &&
    config.bio.length > 0 &&
    config.system &&
    config.traits &&
    config.plugins &&
    config.settings
  );
}

export function createMessageTemplate(
  name: string,
  content: string,
  variables: string[] = [],
  context: string[] = [],
): MessageTemplate {
  return {
    name,
    content,
    variables,
    context,
  };
}

export function createResponseTemplate(
  pattern: string,
  responses: string[],
  context: string[] = [],
  priority: number = 1,
): ResponseTemplate {
  return {
    pattern,
    responses,
    context,
    priority,
  };
}
