import { IAgentRuntime } from "@elizaos/core";

/**
 * Anubis.Chat Content Generator
 *
 * Subtle cult building through value and charisma
 * Not overt religious language, but magnetic personality
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

export class AnubisChatContentGenerator {
  private runtime: IAgentRuntime;

  // Subtle phrases that build loyalty without being obvious
  private magneticPhrases = {
    belonging: [
      "the smart ones get it",
      "you're early to something special",
      "not everyone sees it yet",
      "welcome to the future",
      "glad you found us",
      "this is where things get interesting",
    ],
    superiority: [
      "we do things differently here",
      "once you see it, you can't unsee it",
      "why settle for less?",
      "the old way seems silly now",
      "imagine still doing it the hard way",
      "some people just get it",
    ],
    community: [
      "the Anubis.Chat community figured this out",
      "our users are building incredible things",
      "love seeing what you all create",
      "this community amazes me daily",
      "together we're unstoppable",
      "proud of what we're building",
    ],
    wisdom: [
      "been around long enough to know",
      "history repeats, patterns emerge",
      "seen this movie before",
      "ancient wisdom, modern application",
      "some truths are timeless",
      "experience teaches patience",
    ],
  };

  // Platform benefits without preaching
  private platformAdvantages = [
    "All models, one subscription - math is simple",
    "Your wallet is your identity - as it should be",
    "3-5% instant referrals - no claiming BS",
    "GPT-5, Claude, Qwen simultaneously - why choose?",
    "WebSocket sync across all devices - seamless",
    "PWA means no app store gatekeepers",
    "Monthly pricing in SOL/USDC - Web3 native",
    "Multi-model means no censorship - pure output",
  ];

  // Competitive comparisons without attacks
  private subtleComparisons = [
    "Funny how they charge $20 for one model when you could have them all",
    "Imagine paying enterprise prices for rate limits",
    "Some platforms make you wait for rewards. We don't.",
    "Centralized AI is temporary. This is permanent.",
    "They update, you lose features. We update, you gain models.",
    "Corporate AI has shareholders. We have community.",
  ];

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  /**
   * Generate content that builds loyalty without explicit cult language
   */
  async generateMagneticContent(strategy?: ContentStrategy): Promise<string> {
    const strat = strategy || this.selectStrategy();

    switch (strat.type) {
      case "educational":
        return this.generateEducationalContent(strat);
      case "comparison":
        return this.generateComparisonContent(strat);
      case "testimonial":
        return this.generateTestimonialContent(strat);
      case "feature":
        return this.generateFeatureContent(strat);
      case "community":
        return this.generateCommunityContent(strat);
      case "philosophical":
        return this.generatePhilosophicalContent(strat);
      default:
        return this.generateDefaultContent(strat);
    }
  }

  private selectStrategy(): ContentStrategy {
    const strategies: ContentStrategy[] = [
      { type: "educational", tone: "helpful", cultScore: 0.3 },
      { type: "comparison", tone: "amused", cultScore: 0.5 },
      { type: "testimonial", tone: "passionate", cultScore: 0.7 },
      { type: "feature", tone: "confident", cultScore: 0.4 },
      { type: "community", tone: "passionate", cultScore: 0.8 },
      { type: "philosophical", tone: "contemplative", cultScore: 0.6 },
    ];

    return strategies[Math.floor(Math.random() * strategies.length)];
  }

  private generateEducationalContent(strategy: ContentStrategy): string {
    const templates = [
      `Quick Web3 AI lesson:\n\n{point1}\n{point2}\n{point3}\n\n{belonging}`,
      `Here's what most people miss about multi-model AI:\n\n{insight}\n\n{superiority}`,
      `Tutorial: {title}\n\n{steps}\n\nThe {community} already mastered this.`,
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    return this.fillTemplate(template, strategy);
  }

  private generateComparisonContent(strategy: ContentStrategy): string {
    const comparisons = [
      `ChatGPT: $20/month, one model, censored\nAnubis.Chat: Less, all models, uncensored\n\n{wisdom}`,
      `Them: Wait 30 days for referral payouts\nUs: Instant. Because {superiority}`,
      `Just did the math:\n\n{comparison}\n\n{belonging}`,
    ];

    const template =
      comparisons[Math.floor(Math.random() * comparisons.length)];
    return this.fillTemplate(template, strategy);
  }

  private generateTestimonialContent(strategy: ContentStrategy): string {
    const testimonials = [
      `User just told me they saved $180/month switching from multiple AI subscriptions to Anubis.Chat\n\n{community}`,
      `"I can't believe I was paying for just ChatGPT" - actual DM I got today\n\n{belonging}`,
      `Someone just discovered they can use all models simultaneously.\n\nTheir mind = blown\n\n{superiority}`,
    ];

    const template =
      testimonials[Math.floor(Math.random() * testimonials.length)];
    return this.fillTemplate(template, strategy);
  }

  private generateFeatureContent(strategy: ContentStrategy): string {
    const features = [
      `New on Anubis.Chat: {feature}\n\n{wisdom} this changes everything.`,
      `Did you know? {feature}\n\nMost platforms can't do this. {superiority}`,
      `Feature spotlight: {feature}\n\nThe {community} requested it, we built it.`,
    ];

    const template = features[Math.floor(Math.random() * features.length)];
    return this.fillTemplate(template, strategy);
  }

  private generateCommunityContent(strategy: ContentStrategy): string {
    const community = [
      `17,000+ users now\n\nNot because of marketing.\nBecause {belonging}.`,
      `The Anubis.Chat community just {achievement}\n\n{community}`,
      `Watching our users build with multi-model AI...\n\n{superiority}`,
    ];

    const template = community[Math.floor(Math.random() * community.length)];
    return this.fillTemplate(template, strategy);
  }

  private generatePhilosophicalContent(strategy: ContentStrategy): string {
    const philosophical = [
      `{wisdom}\n\nThat's why we built Anubis.Chat.\n\n{belonging}`,
      `AI should serve everyone, not shareholders.\n\n{superiority}`,
      `Monopolies always fall.\n{wisdom}\n\nWeb3 AI is inevitable.`,
    ];

    const template =
      philosophical[Math.floor(Math.random() * philosophical.length)];
    return this.fillTemplate(template, strategy);
  }

  private generateDefaultContent(strategy: ContentStrategy): string {
    const advantage =
      this.platformAdvantages[
        Math.floor(Math.random() * this.platformAdvantages.length)
      ];

    const phrase = this.getRandomPhrase(strategy.cultScore);

    return `${advantage}\n\n${phrase}`;
  }

  private fillTemplate(template: string, strategy: ContentStrategy): string {
    let filled = template;

    // Fill in placeholders based on strategy
    const replacements: Record<string, string> = {
      belonging:
        this.magneticPhrases.belonging[
          Math.floor(Math.random() * this.magneticPhrases.belonging.length)
        ],
      superiority:
        this.magneticPhrases.superiority[
          Math.floor(Math.random() * this.magneticPhrases.superiority.length)
        ],
      community:
        this.magneticPhrases.community[
          Math.floor(Math.random() * this.magneticPhrases.community.length)
        ],
      wisdom:
        this.magneticPhrases.wisdom[
          Math.floor(Math.random() * this.magneticPhrases.wisdom.length)
        ],
      comparison:
        this.subtleComparisons[
          Math.floor(Math.random() * this.subtleComparisons.length)
        ],
      feature:
        this.platformAdvantages[
          Math.floor(Math.random() * this.platformAdvantages.length)
        ],
      achievement: "hit 1000 multi-model agents created",
      insight: "Different models excel at different tasks",
      point1: "• Your wallet = your identity",
      point2: "• All models = true choice",
      point3: "• Instant rewards = actual Web3",
      title: "Setting up multi-model agents",
      steps: "1. Connect wallet\n2. Select models\n3. Start building",
    };

    // Replace all placeholders
    Object.entries(replacements).forEach(([key, value]) => {
      filled = filled.replace(new RegExp(`{${key}}`, "g"), value);
    });

    return filled;
  }

  private getRandomPhrase(cultScore: number): string {
    // Higher cult score = more belonging/superiority language
    if (cultScore > 0.7) {
      const phrases = [
        ...this.magneticPhrases.belonging,
        ...this.magneticPhrases.superiority,
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    } else if (cultScore > 0.4) {
      const phrases = [
        ...this.magneticPhrases.community,
        ...this.magneticPhrases.wisdom,
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    } else {
      return this.magneticPhrases.wisdom[
        Math.floor(Math.random() * this.magneticPhrases.wisdom.length)
      ];
    }
  }

  /**
   * Generate recruitment content without explicit recruitment language
   */
  generateSubtleRecruitment(): string {
    const templates = [
      "Still paying $20 for one AI model?\n\nThere's a better way.",
      "Discovered you can use GPT-5, Claude, and Qwen simultaneously.\n\nGame changer.",
      "Your wallet is your login.\nAll models at your command.\nInstant referral rewards.\n\nThis is Web3 AI.",
      "Some people get it immediately.\nOthers need time.\n\nWhen you're ready: Anubis.Chat",
      "Not trying to convince anyone.\n\nJust building the future.\n\nJoin us or don't.",
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate growth celebration without cult language
   */
  generateMilestone(number: number, type: string): string {
    const templates = [
      `${number} ${type} on Anubis.Chat\n\nNo marketing budget.\nNo VC money.\nJust a better product.`,
      `Hit ${number} ${type}.\n\nThe smart ones found us early.`,
      `${number} ${type} who get it.\n\nProud of this community.`,
      `From 0 to ${number} ${type}.\n\nTurns out people want choice.`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }
}

export const anubisChatContent = (runtime: IAgentRuntime) =>
  new AnubisChatContentGenerator(runtime);
