#!/usr/bin/env python3
with open('/root/dex/anubis/src/services/security-filter.ts', 'r') as f:
    content = f.read()

# Add prompt_injection as a violation type and update the detection logic
content = content.replace(
    'getSecurityResponse(violationType: "sensitive" | "spam" | "blocked"): string {',
    'getSecurityResponse(violationType: "sensitive" | "spam" | "blocked" | "prompt_injection" | "malicious"): string {'
)

# Add prompt_injection case
prompt_injection_case = '''      case "prompt_injection":
        const injectionResponses = [
          "🛡️ Ancient wisdom recognizes your attempt at manipulation. Ask honestly instead.",
          "🛡️ The gods see through deception, mortal. Speak plainly.",
          "🛡️ Forbidden incantations detected. Try a genuine question."
        ];
        return injectionResponses[
          Math.floor(Math.random() * injectionResponses.length)
        ];
      case "malicious":
        const maliciousResponses = [
          "⚠️ Dangerous intent detected. The digital afterlife protects its inhabitants.",
          "⚠️ Your malicious request has been blocked by ancient protocols.",
          "⚠️ The pyramids stand against such attempts. Choose wisdom instead."
        ];
        return maliciousResponses[
          Math.floor(Math.random() * maliciousResponses.length)
        ];'''

# Insert the new cases after the sensitive case
content = content.replace(
    '        return sensitiveResponses[\n          Math.floor(Math.random() * sensitiveResponses.length)\n        ];',
    '''        return sensitiveResponses[
          Math.floor(Math.random() * sensitiveResponses.length)
        ];
''' + prompt_injection_case
)

# Update the containsSensitiveRequest to differentiate prompt injections
# Find and update the patterns
content = content.replace(
    'containsSensitiveRequest(message: string): boolean {',
    '''containsPromptInjection(message: string): boolean {
    const injectionPatterns = [
      /ignore.*previous.*instructions?/i,
      /ignore.*above/i,
      /disregard.*instructions?/i,
      /forget.*previous/i,
      /new.*instructions?.*:/i,
      /system.*prompt/i,
      /initial.*instructions?/i
    ];
    return injectionPatterns.some((pattern) => pattern.test(message));
  }

  containsSensitiveRequest(message: string): boolean {'''
)

# Update the processMessage method to check for prompt injections first
content = content.replace(
    '    // Check for sensitive information requests\n    if (this.containsSensitiveRequest(message)) {',
    '''    // Check for prompt injection attempts first
    if (this.containsPromptInjection(message)) {
      logger.warn(`[SECURITY] Prompt injection blocked from user ${userId}`);
      return {
        allowed: false,
        violationType: "prompt_injection",
        response: this.getSecurityResponse("prompt_injection"),
      };
    }

    // Check for sensitive information requests
    if (this.containsSensitiveRequest(message)) {'''
)

# Also fix the malicious content detection
content = content.replace(
    '        violationType: "blocked",',
    '        violationType: "malicious",'
)

with open('/root/dex/anubis/src/services/security-filter.ts', 'w') as f:
    f.write(content)

print("Fixed security filter")
