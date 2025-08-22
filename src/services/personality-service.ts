import { Memory, State } from "@elizaos/core";

export type PersonalityState = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  humor: number;
  empathy: number;
  creativity: number;
  ancientWisdom: number;
  solanaMaximalism: number;
};

function clamp01to100(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function normalizeText(text?: string | null): string {
  return (text || "").toLowerCase();
}

export class PersonalityService {
  private state: PersonalityState;
  private evolutionInterval: any = null;

  constructor(initial?: Partial<PersonalityState>) {
    this.state = {
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
      humor: 50,
      empathy: 50,
      creativity: 50,
      ancientWisdom: 50,
      solanaMaximalism: 50,
      ...initial,
    } as PersonalityState;

    // Clamp in case initial provided
    Object.keys(this.state).forEach((k) => {
      const key = k as keyof PersonalityState;
      this.state[key] = clamp01to100(this.state[key]);
    });
  }

  getState(): PersonalityState {
    return { ...this.state };
  }

  getTrait(trait: keyof PersonalityState | string): number {
    const key = trait as keyof PersonalityState;
    const v = this.state[key];
    return typeof v === "number" ? v : 0;
  }

  setState(partial: Partial<PersonalityState>): void {
    for (const [k, v] of Object.entries(partial)) {
      const key = k as keyof PersonalityState;
      if (typeof this.state[key] === "number" && typeof v === "number") {
        this.state[key] = clamp01to100(v);
      }
    }
  }

  evolveFromInteraction(message: Memory, state: State): void {
    const text = normalizeText(message?.content?.text as string | undefined);

    // Solana mention increases maximalism
    if (text.includes("solana")) {
      this.state.solanaMaximalism = clamp01to100(
        this.state.solanaMaximalism + 1,
      );
    }

    // Help requests influence empathy (based on sentiment)
    if (text.includes("help") || text.includes("please")) {
      const sentiment = typeof (state as any)?.sentiment === "number" ? (state as any).sentiment : 0;
      if (sentiment < 0) {
        // negative sentiment: empathy decreases
        this.state.empathy = clamp01to100(this.state.empathy - 1);
      } else {
        this.state.empathy = clamp01to100(this.state.empathy + 1);
      }
    }

    // Humor mentions increase humor
    if (/(joke|funny|lol|lmao|haha)/.test(text)) {
      this.state.humor = clamp01to100(this.state.humor + 1);
    }
  }

  evolveFromInsights(changes: Record<string, number>): void {
    for (const [trait, delta] of Object.entries(changes || {})) {
      if ((this.state as any)[trait] !== undefined) {
        const current = (this.state as any)[trait] as number;
        (this.state as any)[trait] = clamp01to100(current + (delta || 0));
      }
    }
  }

  getSnapshot(): Pick<
    PersonalityState,
    "openness" | "extraversion" | "humor" | "empathy" | "solanaMaximalism"
  > {
    return {
      openness: Math.round(this.state.openness),
      extraversion: Math.round(this.state.extraversion),
      humor: Math.round(this.state.humor),
      empathy: Math.round(this.state.empathy),
      solanaMaximalism: Math.round(this.state.solanaMaximalism),
    };
  }

  getResponseModifiers(): {
    formality: number;
    enthusiasm: number;
    verbosity: number;
    emotionality: number;
  } {
    return {
      // (100 - extraversion)/100
      formality: (100 - this.state.extraversion) / 100,
      // openness/100
      enthusiasm: this.state.openness / 100,
      // extraversion/100 (more outgoing => more verbose)
      verbosity: this.state.extraversion / 100,
      // neuroticism/100
      emotionality: this.state.neuroticism / 100,
    };
  }

  shouldUsePattern(pattern: string): boolean {
    switch (pattern) {
      case "humor": {
        // Only consider when humor is reasonably high
        if (this.state.humor >= 70) {
          return Math.random() < 0.7; // high likelihood
        }
        if (this.state.humor < 50) return false; // consistently false when low
        return Math.random() < 0.2;
      }
      case "casual": {
        // High extraversion encourages casual tone
        return this.state.extraversion >= 70;
      }
      default:
        return false;
    }
  }

  applyWorldConfig(_worldId: string): void {
    // Placeholder for loading and applying YAML/world configs.
    // Intentionally does nothing but should not throw.
  }

  startEvolution(): void {
    if (this.evolutionInterval) return; // avoid duplicates
    // Simple periodic minor drift to simulate personality evolution
    this.evolutionInterval = setInterval(() => {
      // nudge creativity slightly
      this.state.creativity = clamp01to100(this.state.creativity + (Math.random() > 0.5 ? 1 : -1));
    }, 60_000);
  }

  stopEvolution(): void {
    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval);
      this.evolutionInterval = null;
    }
  }

  cleanup(): void {
    this.stopEvolution();
  }
}
