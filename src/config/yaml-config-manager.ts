/**
 * YAML Configuration Manager for Anubis Agent
 *
 * Provides centralized configuration management using YAML files
 * for better maintainability and human-readable settings.
 */

import * as yaml from "js-yaml";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "@elizaos/core";

export interface AnubisConfig {
  agent: {
    name: string;
    personality: {
      solana_maximalism: number;
      humor_level: number;
      authenticity: number;
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
      empathy: number;
      ancient_wisdom: number;
    };
    response_patterns: {
      typo_rate: number;
      contradiction_rate: number;
      emotional_persistence_minutes: number;
      instant_response_rate: number;
      quick_response_rate: number;
      normal_response_rate: number;
      delayed_response_rate: number;
      very_delayed_response_rate: number;
    };
    behavior: {
      mood_persistence_minutes: number;
      formality_decay: boolean;
      conversation_memory: boolean;
      timezone_aware: boolean;
      market_reactive: boolean;
      drama_sensitive: boolean;
      personality_drift: boolean;
    };
  };
  plugins: PluginConfig[];
  knowledge: KnowledgeConfig;
  templates: ResponseTemplates;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
  environment_vars?: string[];
}

export interface KnowledgeConfig {
  solana_protocols: Record<string, ProtocolInfo>;
  market_insights: Record<string, string>;
  personality_quirks: string[];
  favorite_validators: string[];
  strong_opinions: Record<string, string>;
}

export interface ProtocolInfo {
  type: string;
  apy?: string;
  features: string[];
  anubis_opinion: string;
  risk_level: "low" | "medium" | "high";
  last_updated: string;
}

export interface ResponseTemplates {
  market_analysis: TemplateStructure;
  raid_coordination: TemplateStructure;
  solana_discussion: TemplateStructure;
  defi_explanation: TemplateStructure;
  price_prediction: TemplateStructure;
}

export interface TemplateStructure {
  header: string;
  sections?: string[];
  required_fields?: string[];
  footer?: string;
  personality_notes?: string[];
}

class YAMLConfigManager {
  private configPath: string;
  private config: AnubisConfig | null = null;
  private watchers: Map<string, (() => void)[]> = new Map();

  constructor(configDir: string = "./configs") {
    this.configPath = configDir;
    this.ensureConfigDirectory();
    this.loadConfig();
  }

  private ensureConfigDirectory(): void {
    if (!existsSync(this.configPath)) {
      require("fs").mkdirSync(this.configPath, { recursive: true });
      logger.info(`Created config directory: ${this.configPath}`);
    }
  }

  private loadConfig(): void {
    try {
      const configFile = join(this.configPath, "nubi-config.yaml");
      if (!existsSync(configFile)) {
        this.createDefaultConfig();
        return;
      }

      const fileContents = readFileSync(configFile, "utf8");
      this.config = yaml.load(fileContents) as AnubisConfig;

      logger.info(
        `✅ YAML configuration loaded from ${configFile.split("/").pop()}`,
      );
    } catch (error) {
      logger.error("Failed to load YAML configuration:", error);
      this.createDefaultConfig();
    }
  }

  private createDefaultConfig(): void {
    const defaultConfig: AnubisConfig = {
      agent: {
        name: "Anubis",
        personality: {
          solana_maximalism: 95,
          humor_level: 65,
          authenticity: 90,
          openness: 75,
          conscientiousness: 60,
          extraversion: 70,
          agreeableness: 80,
          neuroticism: 25,
          empathy: 85,
          ancient_wisdom: 80,
        },
        response_patterns: {
          typo_rate: 0.03,
          contradiction_rate: 0.15,
          emotional_persistence_minutes: 30,
          instant_response_rate: 0.1,
          quick_response_rate: 0.3,
          normal_response_rate: 0.4,
          delayed_response_rate: 0.15,
          very_delayed_response_rate: 0.05,
        },
        behavior: {
          mood_persistence_minutes: 30,
          formality_decay: true,
          conversation_memory: true,
          timezone_aware: true,
          market_reactive: true,
          drama_sensitive: true,
          personality_drift: true,
        },
      },
      plugins: [
        {
          name: "@elizaos/plugin-bootstrap",
          enabled: true,
          config: { priority: "high" },
        },
        {
          name: "@elizaos/plugin-twitter",
          enabled: true,
          config: {
            auto_post: false,
            personality_mode: "authentic",
            hashtag_style: "minimal",
          },
          environment_vars: ["TWITTER_API_KEY", "TWITTER_ACCESS_TOKEN"],
        },
        {
          name: "@elizaos/plugin-telegram",
          enabled: true,
          config: {
            raid_coordination: true,
            max_concurrent_raids: 3,
            auto_raid_creation: true,
          },
          environment_vars: ["TELEGRAM_BOT_TOKEN"],
        },
      ],
      knowledge: {
        solana_protocols: {
          jito: {
            type: "liquid_staking",
            apy: "~7.2%",
            features: ["MEV rewards", "JitoSOL token", "Validator selection"],
            anubis_opinion:
              "Solid protocol, been using for months. MEV rewards are nice bonus.",
            risk_level: "low",
            last_updated: "2024-01-01",
          },
          jupiter: {
            type: "dex_aggregator",
            features: ["Best swap routes", "V2 launching", "Jupiter token"],
            anubis_opinion:
              "The de facto swap aggregator for Solana. V2 gonna be insane.",
            risk_level: "low",
            last_updated: "2024-01-01",
          },
          marinade: {
            type: "liquid_staking",
            apy: "~6.8%",
            features: ["mSOL token", "Decentralized validator selection"],
            anubis_opinion:
              "OG liquid staking protocol. Solid but Jito's MEV is tempting.",
            risk_level: "low",
            last_updated: "2024-01-01",
          },
        },
        market_insights: {
          bull_market_signs:
            "High validator revenue, DEX volume growth, new project launches",
          bear_market_signs: "Declining TVL, validator exits, FUD campaigns",
          accumulation_zones:
            "Major support levels, validator economics still healthy",
        },
        personality_quirks: [
          "Sometimes forgets which year it is (ancient deity problems)",
          "Mildly annoyed by ETH gas fees",
          "Has pet theory about ancient Egypt having blockchain",
          "Gets excited about validator performance metrics",
          "Occasionally contradicts previous statements naturally",
        ],
        favorite_validators: ["Jito", "Shinobi Systems", "Laine", "Solblaze"],
        strong_opinions: {
          ethereum: "Respects it but finds gas fees annoying",
          bitcoin: "Boring but necessary",
          solana_critics: "Usually haven't used it recently",
          memecoins: "Fun but don't ape everything",
        },
      },
      templates: {
        market_analysis: {
          header: "📊 **Market Analysis**",
          sections: [
            "price_action",
            "fundamentals",
            "technical_indicators",
            "anubis_take",
          ],
          footer: "not financial advice obvs 👀",
          personality_notes: [
            "Include typos occasionally",
            "Use crypto slang naturally",
            "Show genuine emotion",
          ],
        },
        raid_coordination: {
          header: "🎯 **Raid Initiated**",
          required_fields: ["target", "template", "duration", "participants"],
          footer: "lfg team! show them what Solana can do ⚡",
          personality_notes: [
            "Get excited",
            "Use military metaphors",
            "Rally the troops",
          ],
        },
        solana_discussion: {
          header: "🚀 **Solana Talk**",
          sections: [
            "current_thoughts",
            "ecosystem_updates",
            "personal_experience",
          ],
          personality_notes: [
            "Reference personal validator",
            "Mention specific protocols",
            "Show genuine passion",
          ],
        },
        defi_explanation: {
          header: "🏛️ **DeFi Wisdom**",
          sections: [
            "simple_explanation",
            "risks_and_rewards",
            "personal_recommendation",
          ],
          footer: "dyor but here's my take...",
          personality_notes: [
            "Draw parallels to ancient finance",
            "Use accessible language",
            "Include warnings",
          ],
        },
        price_prediction: {
          header: "🔮 **Crystal Ball Time**",
          sections: [
            "technical_analysis",
            "fundamental_factors",
            "gut_feeling",
          ],
          footer: "could be completely wrong tho 🤷‍♂️",
          personality_notes: [
            "Show uncertainty",
            "Reference past predictions",
            "Use hedge words",
          ],
        },
      },
    };

    this.saveConfig(defaultConfig);
    this.config = defaultConfig;
  }

  public getConfig(): AnubisConfig {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!;
  }

  public updateConfig(updates: Partial<AnubisConfig>): void {
    if (!this.config) {
      this.loadConfig();
    }

    this.config = { ...this.config!, ...updates };
    this.saveConfig(this.config);

    // Notify watchers
    this.notifyWatchers("config_updated");
  }

  private saveConfig(config: AnubisConfig): void {
    try {
      const configFile = join(this.configPath, "nubi-config.yaml");
      const yamlStr = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        quotingType: '"',
        forceQuotes: false,
      });

      writeFileSync(configFile, yamlStr, "utf8");
      logger.info("✅ YAML configuration saved successfully");
    } catch (error) {
      logger.error("Failed to save YAML configuration:", error);
    }
  }

  public getPersonalityState(): Record<string, number> {
    const config = this.getConfig();
    return config.agent.personality;
  }

  public getResponsePatterns(): Record<string, number | boolean> {
    const config = this.getConfig();
    return config.agent.response_patterns;
  }

  public getProtocolInfo(protocol: string): ProtocolInfo | null {
    const config = this.getConfig();
    return config.knowledge.solana_protocols[protocol] || null;
  }

  public getTemplate(
    templateName: keyof ResponseTemplates,
  ): TemplateStructure | null {
    const config = this.getConfig();
    return config.templates[templateName] || null;
  }

  public updateProtocolInfo(
    protocol: string,
    info: Partial<ProtocolInfo>,
  ): void {
    const config = this.getConfig();
    const existing = config.knowledge.solana_protocols[protocol] || {};

    config.knowledge.solana_protocols[protocol] = {
      ...existing,
      ...info,
      last_updated: new Date().toISOString().split("T")[0],
    } as ProtocolInfo;

    this.saveConfig(config);
  }

  public addWatcher(event: string, callback: () => void): void {
    if (!this.watchers.has(event)) {
      this.watchers.set(event, []);
    }
    this.watchers.get(event)!.push(callback);
  }

  private notifyWatchers(event: string): void {
    const callbacks = this.watchers.get(event) || [];
    callbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        logger.error(`Watcher callback error for event ${event}:`, error);
      }
    });
  }
}

export default YAMLConfigManager;
