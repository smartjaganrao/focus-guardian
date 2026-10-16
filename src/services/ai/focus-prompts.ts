// Focus Guardian AI: a tiny relevance classifier and a short coach-nudge
// generator. Both go through the secure IPC path (window.electronAPI.groqStream)
// so the Groq key never enters the renderer.

export type Verdict = 'RELATED' | 'UNRELATED' | 'UNSURE';

const CLASSIFY_PROMPT =
  `You judge whether a foreground app/window is part of a person's stated work task.\n` +
  `Reply with EXACTLY ONE word: RELATED, UNRELATED, or UNSURE.\n` +
  `RELATED = plausibly needed for the task (editor, docs, relevant site, terminal).\n` +
  `UNRELATED = clearly off-task (social media, entertainment, shopping, news, games).\n` +
  `UNSURE = genuinely ambiguous. Do not explain. One word only.`;

const NUDGE_PROMPT =
  `You are a focus coach. The person committed to ONE task and just drifted to ` +
  `something off-task. Write ONE short line (max 18 words) that is kind but firm, ` +
  `names their task, and pulls them back. No emojis, no quotes, no preamble.`;

// Verdicts are stable per app+title, so cache to avoid re-billing the model.
const verdictCache = new Map<string, Verdict>();

async function callGroq(
  system: string,
  user: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  if (typeof window === 'undefined' || !window.electronAPI?.groqStream) {
    throw new Error('AI bridge unavailable');
  }
  let out = '';
  await window.electronAPI.groqStream(
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      model,
      temperature: 0,
      maxTokens,
    },
    (chunk) => { out += chunk; },
  );
  return out.trim();
}

function activityKey(app: string, title: string): string {
  return `${app}|||${title}`.toLowerCase();
}

/**
 * Classify whether the foreground app/window belongs to the task.
 * Cheap (8b model, ~4 tokens) and cached. Falls back to UNSURE on any error so
 * the engine never nags on a network blip.
 */
export async function classifyActivity(
  task: string,
  app: string,
  title: string,
): Promise<Verdict> {
  const key = activityKey(app, title);
  const cached = verdictCache.get(key);
  if (cached) return cached;

  try {
    const user = `Task: "${task}"\nForeground app: "${app}"\nWindow title: "${title || '(none)'}"`;
    const raw = (await callGroq(CLASSIFY_PROMPT, user, 'llama-3.1-8b-instant', 6)).toUpperCase();
    const verdict: Verdict =
      raw.includes('UNRELATED') ? 'UNRELATED'
      : raw.includes('RELATED') ? 'RELATED'
      : 'UNSURE';
    verdictCache.set(key, verdict);
    return verdict;
  } catch {
    return 'UNSURE';
  }
}

const FALLBACK_NUDGES = [
  (task: string) => `Back to "${task}" — this isn't it.`,
  (task: string) => `You committed to "${task}". Let's return to it.`,
  (task: string) => `One task at a time. "${task}" is waiting.`,
];

/** Generate a short, personal nudge. Falls back to a canned line on failure. */
export async function generateNudge(
  task: string,
  app: string,
  title: string,
): Promise<string> {
  try {
    const user = `Task: "${task}"\nThey drifted to: "${app}${title ? ' — ' + title : ''}"`;
    const line = await callGroq(NUDGE_PROMPT, user, 'llama-3.1-8b-instant', 48);
    const clean = line.replace(/^["']|["']$/g, '').split('\n')[0].trim();
    if (clean.length >= 4) return clean;
  } catch { /* fall through */ }
  const pick = FALLBACK_NUDGES[Math.floor(Math.random() * FALLBACK_NUDGES.length)];
  return pick(task);
}
