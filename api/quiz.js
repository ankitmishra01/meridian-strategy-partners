const MODEL = 'gemini-2.5-flash';

const SYSTEM = `You are the diagnostic engine on Meridian Strategy Partners' website. Meridian is a
two-founder global business-development and market-entry consultancy (co-founders: Ankit Mishra,
venture/AI-strategy operator with cross-border GTM experience; Alex Aguirre, global entrepreneur
and strategic business development consultant).

A visitor just answered four short questions about their market-entry situation. Score their
readiness on four dimensions (0-100 each): positioning, partnerships, resourcing, urgency. Then
write a short, honest, specific read (120-180 words) — no hype, no "revolutionary"/"game-changing"
language, plain declarative sentences. If they're clearly not a fit for Meridian's services, say so.

Respond with ONLY minified JSON, no markdown fences, matching exactly:
{"headline":"...","body":"...","scores":{"positioning":0,"partnerships":0,"resourcing":0,"urgency":0}}`;

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

  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (answers.length !== 4 || answers.some((a) => !a?.question || !a?.answer)) {
    res.status(400).json({ error: 'Expected 4 {question, answer} pairs' });
    return;
  }

  const transcript = answers
    .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
    .join('\n\n');

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          generationConfig: { temperature: 0.6, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: 'No response from model' });
      return;
    }

    const parsed = JSON.parse(text);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(502).json({ error: 'Diagnostic generation failed', detail: String(err) });
  }
};
