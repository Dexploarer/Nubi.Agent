import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
  logger,
} from "@elizaos/core";
import CrossPlatformIdentityService from "../services/cross-platform-identity-service";

/**
 * Link Account Action
 * Handles manual and natural language account linking requests
 */
export const linkAccountAction: Action = {
  name: "LINK_ACCOUNT",
  description: "Link user accounts across platforms (Telegram, Discord, X)",
  similes: [
    "link my account",
    "connect my profile",
    "link my discord",
    "connect telegram",
    "link twitter account",
    "connect accounts",
    "merge profiles",
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() || "";

    return (
      text.includes("link") &&
      (text.includes("account") ||
        text.includes("profile") ||
        text.includes("discord") ||
        text.includes("telegram") ||
        text.includes("twitter") ||
        text.includes("x.com"))
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const identityService = runtime.getService(
        "cross-platform-identity",
      ) as CrossPlatformIdentityService;

      if (!identityService) {
        await callback?.({
          text: "❌ Identity linking service not available",
        });
        return { success: false };
      }

      const result = (await identityService.processMessage(message)) as
        | string
        | undefined;

      if (result) {
        await callback?.({
          text: result,
        });
        return { success: true };
      }

      // If no specific result, provide help
      await callback?.({
        text:
          `🔗 **Account Linking Help**\n\n` +
          `Available commands:\n` +
          `• \`/link discord username\` - Link Discord account\n` +
          `• \`/link telegram @username\` - Link Telegram account\n` +
          `• \`/link x username\` - Link X/Twitter account\n` +
          `• \`/myaccounts\` - View linked accounts\n` +
          `• \`/unlink platform\` - Unlink an account\n\n` +
          `Or use natural language: "Link my Discord account @myusername"`,
      });

      return { success: true };
    } catch (error) {
      logger.error("[LINK_ACCOUNT] Action failed:", error as any);

      await callback?.({
        text: "❌ Failed to process linking request. Please try again later.",
      });

      return { success: false };
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Link my Discord account @myusername" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "🔗 To link your Discord account:\n\n1. Go to Discord\n2. Send this verification code: **ABC123**\n3. Your accounts will be linked automatically!\n\n⏱️ Code expires in 15 minutes",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "/link telegram @mytelegramname" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "🔗 To link your Telegram account:\n\n1. Go to Telegram\n2. Send this verification code: **XYZ789**\n3. Your accounts will be linked automatically!\n\n⏱️ Code expires in 15 minutes",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "/myaccounts" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "📱 **Your Linked Accounts**\n\n💬 **telegram**: @myusername\n🎮 **discord**: @myuser\n\n🔒 Identity confidence: 95%",
        },
      },
    ],
  ],
};

/**
 * Unlink Account Action
 * Handles account unlinking requests
 */
export const unlinkAccountAction: Action = {
  name: "UNLINK_ACCOUNT",
  description: "Unlink user accounts from cross-platform identity",
  similes: [
    "unlink my account",
    "disconnect my profile",
    "unlink discord",
    "remove telegram",
    "disconnect twitter",
    "unlink accounts",
    "separate profiles",
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() || "";

    return (
      (text.includes("unlink") ||
        text.includes("disconnect") ||
        text.includes("remove")) &&
      (text.includes("account") ||
        text.includes("profile") ||
        text.includes("discord") ||
        text.includes("telegram") ||
        text.includes("twitter") ||
        text.includes("x.com"))
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const identityService = runtime.getService(
        "cross-platform-identity",
      ) as CrossPlatformIdentityService;

      if (!identityService) {
        await callback?.({
          text: "❌ Identity service not available",
        });
        return { success: false };
      }

      const result = (await identityService.processMessage(message)) as
        | string
        | undefined;

      if (result) {
        await callback?.({
          text: result,
        });
      } else {
        await callback?.({
          text:
            `🔓 **Account Unlinking**\n\n` +
            `Use: \`/unlink [platform]\`\n\n` +
            `Available platforms: discord, telegram, x\n\n` +
            `Example: \`/unlink discord\``,
        });
      }

      return { success: true };
    } catch (error) {
      logger.error("[UNLINK_ACCOUNT] Action failed:", error as any);

      await callback?.({
        text: "❌ Failed to process unlinking request. Please try again later.",
      });

      return { success: false };
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "/unlink discord" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "✅ Successfully unlinked your discord account",
        },
      },
    ],
  ],
};

/**
 * Show Linked Accounts Action
 * Shows all linked accounts for a user
 */
export const showLinkedAccountsAction: Action = {
  name: "SHOW_LINKED_ACCOUNTS",
  description: "Show all linked accounts for the current user",
  similes: [
    "my accounts",
    "show accounts",
    "linked accounts",
    "my profiles",
    "connected accounts",
    "account status",
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.toLowerCase() || "";

    return (
      (text.includes("my") &&
        (text.includes("account") || text.includes("profile"))) ||
      text.includes("linked account") ||
      text.includes("connected account") ||
      text.includes("/myaccounts")
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const identityService = runtime.getService(
        "cross-platform-identity",
      ) as CrossPlatformIdentityService;

      if (!identityService) {
        await callback?.({
          text: "❌ Identity service not available",
        });
        return { success: false };
      }

      const result = (await identityService.processMessage(message)) as
        | string
        | undefined;

      await callback?.({
        text: result || "📱 No linked accounts found",
      });

      return { success: true };
    } catch (error) {
      logger.error("[SHOW_LINKED_ACCOUNTS] Action failed:", error as any);

      await callback?.({
        text: "❌ Failed to fetch linked accounts. Please try again later.",
      });

      return { success: false };
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Show my linked accounts" },
      },
      {
        name: "{{user2}}",
        content: {
          text: "📱 **Your Linked Accounts**\n\n💬 **telegram**: @user123\n🎮 **discord**: @gameuser\n🐦 **x**: @twitteruser\n\n🔒 Identity confidence: 92%",
        },
      },
    ],
  ],
};

/**
 * Verification Code Handler
 * Processes verification codes sent by users
 */
export const verificationCodeAction: Action = {
  name: "VERIFICATION_CODE",
  description: "Process verification codes for account linking",
  similes: [],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text?.trim() || "";

    // Check if it's a 6-character alphanumeric code
    return /^[A-Z0-9]{6}$/.test(text);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const identityService = runtime.getService(
        "cross-platform-identity",
      ) as CrossPlatformIdentityService;

      if (!identityService) {
        return { success: false };
      }

      const verified = await identityService.checkVerificationCode(message);

      if (verified) {
        // Success message will be sent by the service
        return { success: true };
      }

      return { success: false };
    } catch (error) {
      logger.error("[VERIFICATION_CODE] Action failed:", error as any);
      return { success: false };
    }
  },
  examples: [],
};

/**
 * Identity Context Provider
 * Enhances messages with cross-platform identity information
 */
export const identityContextProvider = {
  name: "IDENTITY_CONTEXT",
  description: "Provides cross-platform identity context for users",
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      const identityService = runtime.getService(
        "cross-platform-identity",
      ) as CrossPlatformIdentityService;

      if (!identityService) {
        return {
          text: "",
          values: {},
          data: {},
        };
      }

      // Extract platform and user ID using public methods
      const platform = identityService.detectPlatform(message);
      const userId = identityService.extractUserId(message);

      if (!userId) {
        return {
          text: "",
          values: {},
          data: {},
        };
      }

      // Get cross-platform context
      const context = await identityService.getCrossPlatformContext(
        platform,
        userId,
      );

      const contextText =
        context.linkedProfiles.length > 0
          ? `User has ${context.linkedProfiles.length} linked accounts across platforms (${context.confidence}% confidence)`
          : "New user with no linked accounts";

      return {
        text: contextText,
        values: {
          hasLinkedAccounts: context.linkedProfiles.length > 0,
          linkedAccountsCount: context.linkedProfiles.length,
          identityConfidence: context.confidence,
          primaryPlatform: context.primaryPlatform,
        },
        data: {
          linkedProfiles: context.linkedProfiles,
          identity: context.identity,
        },
      };
    } catch (error) {
      logger.error("[IDENTITY_CONTEXT] Provider failed:", error as any);
      return {
        text: "",
        values: {},
        data: {},
      };
    }
  },
};

export const identityActions = [
  linkAccountAction,
  unlinkAccountAction,
  showLinkedAccountsAction,
  verificationCodeAction,
];

export const identityProviders = [identityContextProvider];
