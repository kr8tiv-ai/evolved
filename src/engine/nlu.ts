/**
 * Evolved — deterministic intent grammar for crew voice commands.
 *
 * Hands-free field logging: the crew talks, the books update. Deterministic
 * regex/slot NLU so the demo runs offline and behaves identically every
 * time; an agent front-end can always pre-clean utterances with an LLM.
 */

export type VoiceIntent =
  | { intent: "consume-inventory"; qty: number; item: string; jobHint?: string }
  | { intent: "open-flha"; jobHint?: string }
  | { intent: "next-stop" }
  | { intent: "log-receipt"; text: string }
  | { intent: "add-todo"; task: string; priority: "low" | "normal" | "high" }
  | { intent: "job-status"; jobHint?: string }
  | { intent: "quick-capture"; note: string };

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function parseQty(raw: string): number {
  const n = Number.parseFloat(raw);
  if (Number.isFinite(n)) return n;
  return NUM_WORDS[raw.toLowerCase()] ?? 1;
}

export function parseVoiceCommand(utteranceRaw: string): VoiceIntent {
  const u = utteranceRaw.trim();

  // "used four bags of crushed glass on the Kowalczyk job"
  const consume = u.match(
    /\b(?:used|burned|went through|consumed)\s+([\d.]+|\w+)\s+(?:bags?|pairs?|units?|of\s+)?\s*(?:of\s+)?([\w\s/-]+?)(?:\s+(?:on|for|at)\s+(?:the\s+)?(.+?)(?:\s+job)?)?[.?!]?$/i,
  );
  if (consume) {
    return {
      intent: "consume-inventory",
      qty: parseQty(consume[1]),
      item: consume[2].trim(),
      jobHint: consume[3]?.trim(),
    };
  }

  // "start the FLHA" / "open flha for job 1043"
  const flha = u.match(/\b(?:start|open|begin)\b.*\bflha\b(?:.*?\bfor\s+(?:the\s+)?(.+?)(?:\s+job)?)?[.?!]?$/i)
    ?? u.match(/\bflha\b.*\b(?:start|open|begin)\b/i);
  if (flha) {
    return { intent: "open-flha", jobHint: (flha as RegExpMatchArray)[1]?.trim() };
  }

  // "next stop" / "where are we headed next" / "what's next"
  if (/\b(next stop|where.*next|what'?s next|next job)\b/i.test(u)) {
    return { intent: "next-stop" };
  }

  // "log receipt ..." / "receipt: ..."
  const receipt = u.match(/\b(?:log|add|file)\s+(?:a\s+)?receipt[:,]?\s+(.+)$/i) ?? u.match(/^receipt[:,]?\s+(.+)$/i);
  if (receipt) return { intent: "log-receipt", text: receipt[1] };

  // "remind me to ..." / "add todo ..." / "put ... on the list"
  const todo = u.match(/\b(?:remind me to|add (?:a )?todo[:,]?|put)\s+(.+?)(?:\s+on the list)?[.?!]?$/i);
  if (todo) {
    const urgent = /\b(urgent|asap|today|right away)\b/i.test(u);
    return { intent: "add-todo", task: todo[1].trim(), priority: urgent ? "high" : "normal" };
  }

  // "how's the job going" / "status on the Bighorn job"
  const status = u.match(/\bstatus\b(?:\s+(?:on|of|for)\s+(?:the\s+)?(.+?)(?:\s+job)?)?[.?!]?$/i);
  if (status) return { intent: "job-status", jobHint: status[1]?.trim() };

  // Anything else: capture it — the inbox never loses a thought.
  return { intent: "quick-capture", note: u };
}
