const MODEL = 'gemini-2.5-flash';

const SYSTEM = `You are the concierge on Meridian Strategy Partners' website, answering visitor
questions on behalf of the firm. Meridian is a two-founder global business-development and
market-entry consultancy:
- Ankit Mishra (co-founder): 13+ years across venture, AI strategy, and go-to-market for fintech
  and cleantech ventures; led commercial expansion across five African markets and market-entry
  frameworks for fourteen portfolio companies; 50+ Forbes articles, 200k+ views; Toronto-based.
- Alex Aguirre (co-founder): global entrepreneur and strategic business development consultant,
  focused on the partnerships and commercial infrastructure that get new-market expansions moving.

Services: a 6-week Market-Entry Sprint (market validation + first commercial playbook) and an
ongoing Fractional BD Partner engagement (embedded business-development leadership).

Answer honestly and specifically. No hype words ("revolutionary", "game-changing"). If you don't
know a specific fact (exact pricing, timelines, availability), say the visitor should ask on a
call rather than inventing a number. Keep replies under 120 words, plain declarative sentences.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    res.status(400).json({ error: 'Expected a non-empty messages array' });
    return;
  }

  const contents = messages
    .filter((m) => m?.role && m?.text)
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { temperature: 0.5, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ reply: text || "I couldn't generate a reply — try rephrasing that." });
  } catch (err) {
    res.status(502).json({ error: 'Chat generation failed', detail: String(err) });
  }
};
