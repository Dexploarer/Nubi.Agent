import { IAgentRuntime } from "@elizaos/core";
import { logger } from "@elizaos/core";

export interface TweetData {
  tweetId: string;
  url: string;
  username: string;
  isValid: boolean;
  extractedAt: Date;
}

export interface DetectedLink {
  originalUrl: string;
  tweetData: TweetData | null;
  userId: string;
  username: string;
  messageId: string;
  detectedAt: Date;
}

export class LinkDetectionService {
  private runtime: IAgentRuntime;
  private xUrlPatterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/gi,
    /(?:https?:\/\/)?(?:www\.)?(?:t\.co)\/([a-zA-Z0-9]+)/gi,
  ];

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async detectXLinks(message: string): Promise<string[]> {
    const links: string[] = [];

    // Reset regex state
    this.xUrlPatterns.forEach((pattern) => (pattern.lastIndex = 0));

    for (const pattern of this.xUrlPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        links.push(match[0]);
      }
    }

    return [...new Set(links)]; // Remove duplicates
  }

  async validateAndExtractTweetData(url: string): Promise<TweetData | null> {
    try {
      // Normalize URL
      let cleanUrl = url;
      if (!cleanUrl.startsWith("http")) {
        cleanUrl = "https://" + cleanUrl;
      }

      // Handle t.co redirects by following them
      if (cleanUrl.includes("t.co")) {
        cleanUrl = await this.followRedirect(cleanUrl);
      }

      // Extract tweet ID from URL
      const tweetIdMatch = cleanUrl.match(
        /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/,
      );

      if (!tweetIdMatch) {
        logger.warn(`Invalid X URL format: ${url}`);
        return null;
      }

      const username = tweetIdMatch[1];
      const tweetId = tweetIdMatch[2];

      // Validate tweet ID format (should be numeric and reasonable length)
      if (!/^\d{10,25}$/.test(tweetId)) {
        logger.warn(`Invalid tweet ID format: ${tweetId}`);
        return null;
      }

      // Construct clean URL
      const normalizedUrl = `https://x.com/${username}/status/${tweetId}`;

      return {
        tweetId,
        url: normalizedUrl,
        username,
        isValid: true,
        extractedAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to validate tweet URL:", error);
      return null;
    }
  }

  private async followRedirect(shortUrl: string): Promise<string> {
    try {
      // For now, we'll implement a basic redirect follower
      // In production, you might want to use a proper HTTP client
      const response = await fetch(shortUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.url;
    } catch (error) {
      logger.error("Failed to follow redirect:", error);
      return shortUrl; // Return original if redirect fails
    }
  }

  async processMessage(
    messageText: string,
    userId: string,
    username: string,
    messageId: string,
  ): Promise<DetectedLink[]> {
    const detectedLinks: DetectedLink[] = [];

    try {
      const links = await this.detectXLinks(messageText);

      for (const link of links) {
        const tweetData = await this.validateAndExtractTweetData(link);

        const detectedLink: DetectedLink = {
          originalUrl: link,
          tweetData,
          userId,
          username,
          messageId,
          detectedAt: new Date(),
        };

        detectedLinks.push(detectedLink);

        if (tweetData?.isValid) {
          logger.info(
            `Valid X link detected by @${username}: ${tweetData.url}`,
          );
        } else {
          logger.warn(`Invalid X link detected by @${username}: ${link}`);
        }
      }
    } catch (error) {
      logger.error("Error processing message for X links:", error);
    }

    return detectedLinks;
  }

  isValidTweetId(tweetId: string): boolean {
    // Twitter/X tweet IDs are numeric and typically 15-20 digits
    return /^\d{10,25}$/.test(tweetId);
  }

  extractTweetIdFromUrl(url: string): string | null {
    const match = url.match(
      /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/,
    );
    return match ? match[1] : null;
  }

  extractUsernameFromUrl(url: string): string | null {
    const match = url.match(
      /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/\d+/,
    );
    return match ? match[1] : null;
  }

  normalizeXUrl(url: string): string {
    // Convert twitter.com to x.com for consistency
    return url.replace(/twitter\.com/g, "x.com");
  }

  async batchValidateUrls(urls: string[]): Promise<TweetData[]> {
    const validTweets: TweetData[] = [];

    // Process in batches to avoid overwhelming the service
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map((url) =>
        this.validateAndExtractTweetData(url),
      );

      try {
        const results = await Promise.allSettled(batchPromises);

        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value?.isValid) {
            validTweets.push(result.value);
          } else if (result.status === "rejected") {
            logger.error(
              `Failed to validate URL ${batch[index]}:`,
              result.reason,
            );
          }
        });

        // Small delay between batches to be respectful
        if (i + batchSize < urls.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error("Error in batch validation:", error);
      }
    }

    return validTweets;
  }
}
