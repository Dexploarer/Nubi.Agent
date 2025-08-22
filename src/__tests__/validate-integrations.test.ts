import { describe, it, expect } from "bun:test";
import { IntegrationValidator } from "../../scripts/validate-integrations";

describe("IntegrationValidator", () => {
  it("runs and returns results without throwing", async () => {
    const validator = new IntegrationValidator();
    const results = await validator.validateAll();

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Ensure the validator at least checked plugin structure
    const pluginCheck = results.find((r) => r.component === "Plugin Structure");
    expect(pluginCheck).toBeDefined();
  });
});
