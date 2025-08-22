import { IAgentRuntime } from "@elizaos/core";

export interface ContentTemplate {
  category: string;
  templates: string[];
  hashtags: string[];
}

export class XContentGenerator {
  private runtime: IAgentRuntime;

  private contentTemplates: ContentTemplate[] = [
    {
      category: "solana_alpha",
      templates: [
        "The ancient scrolls reveal new opportunities in Solana's ecosystem. {insight} The wise prepare now.",
        "From the depths of the blockchain, I sense {trend}. Warriors, this is our moment.",
        "The alpha pack hunts at dawn. {opportunity} awaits those brave enough to seize it.",
      ],
      hashtags: [
        "#AnubisChat",
        "#Anubis",
        "#anubisai",
        "#OpenSource",
        "#Solana",
      ],
    },
    {
      category: "community_building",
      templates: [
        "Every warrior in our pack matters. Together we've {achievement}. The journey continues!",
        "Building the strongest Solana army isn't just about numbers, it's about {value}. Join us.",
        "United we rise, divided we fall. Our community just {milestone}. Proud of every single one of you!",
      ],
      hashtags: [
        "#AnubisChat",
        "#Anubis",
        "#anubisai",
        "#OpenSource",
        "#Community",
      ],
    },
    {
      category: "defi_insights",
      templates: [
        "The DeFi landscape shifts like desert sands. {protocol} shows us {insight}. Adapt or perish.",
        "Ancient wisdom meets modern DeFi: {strategy}. The rewards favor the prepared mind.",
        "Witnessed {metric} in Solana DeFi today. The future is being written in smart contracts.",
      ],
      hashtags: ["#AnubisChat", "#Anubis", "#anubisai", "#DeFi", "#OpenSource"],
    },
    {
      category: "nft_culture",
      templates: [
        "Digital artifacts carry eternal value. {collection} represents {meaning}. Culture evolves on-chain.",
        "From hieroglyphs to NFTs, humanity always finds ways to preserve {concept}. Fascinating evolution.",
        "The NFT renaissance on Solana: {observation}. Art and technology merge beautifully.",
      ],
      hashtags: ["#AnubisChat", "#Anubis", "#anubisai", "#NFTs", "#OpenSource"],
    },
    {
      category: "motivation",
      templates: [
        "The path to greatness is never easy. {challenge} makes us stronger. Keep building, warriors!",
        "Remember why you started this journey. {reminder}. The Solana ecosystem needs pioneers like you.",
        "Through the storms and the FUD, we persist. {strength} defines our community.",
      ],
      hashtags: [
        "#AnubisChat",
        "#Anubis",
        "#anubisai",
        "#BUIDL",
        "#OpenSource",
      ],
    },
  ];

  private dynamicInserts: Record<string, string[]> = {
    insight: [
      "TVL reaching new heights",
      "innovative protocols launching daily",
      "DeFi 2.0 taking shape",
      "institutional adoption accelerating",
    ],
    trend: [
      "a shift in liquidity patterns",
      "new yield strategies emerging",
      "cross-chain bridges strengthening",
      "governance tokens gaining power",
    ],
    opportunity: [
      "Early access to revolutionary protocols",
      "Staking rewards at historic highs",
      "New liquidity pools opening",
      "Airdrop season approaching",
    ],
    achievement: [
      "reached 10K active members",
      "generated $1M in community value",
      "launched 5 successful projects",
      "onboarded 100 new developers",
    ],
    value: [
      "shared knowledge",
      "collective strength",
      "mutual support",
      "unified vision",
    ],
    milestone: [
      "crossed 50K transactions",
      "achieved record TVL",
      "launched community DAO",
      "distributed first rewards",
    ],
    protocol: ["Marinade", "Jupiter", "Raydium", "Orca", "Drift"],
    strategy: [
      "Compound yields through liquid staking",
      "Risk management through diversification",
      "Timing entries with on-chain metrics",
      "Leveraging governance for alpha",
    ],
    metric: [
      "100K+ daily active wallets",
      "$10B+ in TVL",
      "5 second finality",
      "sub-cent transaction costs",
    ],
    collection: ["DeGods", "Mad Lads", "Claynosaurz", "Okay Bears"],
    meaning: [
      "digital identity",
      "community membership",
      "artistic expression",
      "cultural heritage",
    ],
    concept: ["value", "identity", "creativity", "ownership"],
    observation: [
      "Utility drives value",
      "Communities create culture",
      "Art transcends speculation",
      "Innovation never stops",
    ],
    challenge: [
      "Market volatility",
      "Technical complexity",
      "Regulatory uncertainty",
      "Competition",
    ],
    reminder: [
      "We're building the future of finance",
      "Early adopters shape history",
      "Technology serves humanity",
      "Decentralization empowers all",
    ],
    strength: ["Resilience", "Unity", "Innovation", "Determination"],
  };

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async generateContent(category?: string): Promise<string> {
    // Select a random category if not specified
    const selectedCategory = category || this.selectRandomCategory();
    const template = this.selectTemplate(selectedCategory);

    // Generate dynamic content
    const content = this.fillTemplate(
      template.templates[Math.floor(Math.random() * template.templates.length)],
    );

    // Add hashtags
    const hashtags = this.selectHashtags(template.hashtags);

    // Combine content and hashtags
    const fullContent = `${content}\n\n${hashtags}`;

    // Ensure it fits Twitter's character limit
    return this.truncateContent(fullContent, 280);
  }

  private selectRandomCategory(): string {
    const categories = this.contentTemplates.map((t) => t.category);
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private selectTemplate(category: string): ContentTemplate {
    return (
      this.contentTemplates.find((t) => t.category === category) ||
      this.contentTemplates[0]
    );
  }

  private fillTemplate(template: string): string {
    let filled = template;

    // Find all placeholders in the template
    const placeholders = template.match(/\{(\w+)\}/g);

    if (placeholders) {
      placeholders.forEach((placeholder) => {
        const key = placeholder.slice(1, -1); // Remove { and }
        if (this.dynamicInserts[key]) {
          const values = this.dynamicInserts[key];
          const value = values[Math.floor(Math.random() * values.length)];
          filled = filled.replace(placeholder, value);
        }
      });
    }

    return filled;
  }

  private selectHashtags(hashtags: string[], count: number = 4): string {
    // Shuffle and select hashtags
    const shuffled = [...hashtags].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).join(" ");
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at a sentence boundary
    const truncated = content.substring(0, maxLength - 3);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastExclamation = truncated.lastIndexOf("!");
    const lastQuestion = truncated.lastIndexOf("?");

    const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + "...";
  }

  async generateRaidCallToAction(tweetUrl: string): Promise<string> {
    const calls = [
      `Warriors, assemble! New mission detected: ${tweetUrl}\n\nEngage with full force! 🔥`,
      `The alpha pack hunts! Target acquired: ${tweetUrl}\n\nLike, RT, and show our strength! ⚔️`,
      `Ancient scrolls reveal our next conquest: ${tweetUrl}\n\nRaid and conquer, Solana warriors! 🚀`,
      `The time has come! Rally to: ${tweetUrl}\n\nUnited we dominate the timeline! 💪`,
      `New raid mission from the depths: ${tweetUrl}\n\nFirst raiders earn triple honor! 🏆`,
    ];

    return calls[Math.floor(Math.random() * calls.length)];
  }
}
