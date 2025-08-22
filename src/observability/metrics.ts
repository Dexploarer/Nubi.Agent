// Minimal Prometheus-style metrics without external dependencies

type CounterMap = Record<string, number>;

class MetricsRegistry {
  private counters: CounterMap = {};
  private gauges: Record<string, () => number> = {};
  private readonly startTimeSec: number;

  constructor() {
    this.startTimeSec = Math.floor(Date.now() / 1000);
    this.counters["nubi_app_starts_total"] = 1;
    // Uptime gauge via function
    this.gauges["nubi_uptime_seconds"] = () =>
      Math.max(0, Math.floor(Date.now() / 1000) - this.startTimeSec);
  }

  inc(name: string, value: number = 1) {
    this.counters[name] = (this.counters[name] || 0) + value;
  }

  setGauge(name: string, getter: () => number) {
    this.gauges[name] = getter;
  }

  render(): string {
    const lines: string[] = [];
    // HELP/TYPE for counters
    for (const [name, val] of Object.entries(this.counters)) {
      lines.push(`# HELP ${name} Auto-generated counter`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${val}`);
    }
    // HELP/TYPE for gauges
    for (const [name, getter] of Object.entries(this.gauges)) {
      lines.push(`# HELP ${name} Auto-generated gauge`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${getter()}`);
    }
    return lines.join("\n") + "\n";
  }
}

const registry = new MetricsRegistry();

// Public helpers
export function metricsIncrementMessageReceived() {
  registry.inc("nubi_messages_received_total", 1);
}

export function metricsIncrementErrors() {
  registry.inc("nubi_errors_total", 1);
}

export function metricsGetText(): string {
  return registry.render();
}
