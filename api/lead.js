const RECIPIENT = 'ankit@ankitmishra.ca';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CONTEXT_CHARS = 4000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'RESEND_API_KEY is not configured' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  // Honeypot: real visitors never fill this field. Look successful, send nothing.
  if (body?.hp) {
    res.status(200).json({ ok: true });
    return;
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address' });
    return;
  }

  const source = body?.source === 'quiz' || body?.source === 'chat' ? body.source : 'unknown';
  const lang = body?.lang === 'fr' ? 'fr' : 'en';
  let contextText = '';
  try {
    contextText = JSON.stringify(body?.context ?? {}, null, 2);
  } catch {
    contextText = String(body?.context ?? '');
  }
  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = contextText.slice(0, MAX_CONTEXT_CHARS) + '\n…(truncated)';
  }

  const timestamp = new Date().toISOString();
  // Free audit trail: even if the Resend call below fails, the lead is recoverable from Vercel's function logs.
  console.log(JSON.stringify({ event: 'lead', email, source, lang, timestamp, context: body?.context }));

  const subject = `New lead — Parallel AI — ${source} — ${email}`;
  const text = `New lead from the Parallel AI site\n\nEmail: ${email}\nSource: ${source}\nLanguage: ${lang}\nTime: ${timestamp}\n\nContext:\n${contextText}`;

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Parallel AI Leads <onboarding@resend.dev>',
        to: [RECIPIENT],
        subject,
        text,
      }),
    });

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      res.status(upstream.status).json({ error: data?.message || 'Upstream error' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'Lead notification failed', detail: String(err) });
  }
};
