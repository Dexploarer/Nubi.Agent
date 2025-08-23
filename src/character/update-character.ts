import { readFileSync, writeFileSync } from "fs";
import { logger } from "@elizaos/core";

const characterPath = "src/nubi-character.ts";
let content = readFileSync(characterPath, "utf-8");

// Add telegram plugin import if not present
if (
  !content.includes("import telegramPlugin from '@elizaos/plugin-telegram'")
) {
  const importLine = "import telegramPlugin from '@elizaos/plugin-telegram';\n";
  const lastImportIndex = content.lastIndexOf("import ");
  const endOfLastImport = content.indexOf("\n", lastImportIndex);
  content =
    content.slice(0, endOfLastImport + 1) +
    importLine +
    content.slice(endOfLastImport + 1);
}

// Find the plugins array and add telegramPlugin if not present
if (!content.includes("telegramPlugin")) {
  const pluginsMatch = content.match(/plugins:\s*\[([^\]]*)\]/s);
  if (pluginsMatch) {
    const currentPlugins = pluginsMatch[1];
    const updatedPlugins = currentPlugins.includes("process.env.TWITTER_")
      ? currentPlugins.replace(
          "process.env.TWITTER_USERNAME ? twitterPlugin : null",
          "process.env.TWITTER_USERNAME ? twitterPlugin : null,\n        process.env.TELEGRAM_BOT_TOKEN ? telegramPlugin : null",
        )
      : currentPlugins + ",\n        telegramPlugin";

    content = content.replace(
      /plugins:\s*\[([^\]]*)\]/s,
      `plugins: [${updatedPlugins}]`,
    );
  }
}

writeFileSync(characterPath, content);
logger.info("✅ Updated nubi-character.ts with Telegram plugin");
