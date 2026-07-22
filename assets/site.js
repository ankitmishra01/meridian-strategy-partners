document.documentElement.classList.add('js');

/* ---------- reveal on scroll ---------- */
const revealEls = document.querySelectorAll('.reveal');
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealEls.forEach(el => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));
  // safety net: never leave content permanently invisible if the observer misses an element
  window.addEventListener('load', () => setTimeout(() => revealEls.forEach(el => el.classList.add('in')), 1200));
}

/* ---------- nav ---------- */
const navpill = document.getElementById('navpill');
if (navpill) {
  window.addEventListener('scroll', () => navpill.classList.toggle('solid', window.scrollY > 40), { passive: true });
  const hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.addEventListener('click', () => navpill.classList.toggle('menu-open'));
}
/* mark the current page's nav link active */
document.querySelectorAll('.navlink').forEach(a => {
  const href = a.getAttribute('href');
  if (href === location.pathname.split('/').pop() || (href === 'index.html' && (location.pathname === '/' || location.pathname.endsWith('/index.html')))) {
    a.classList.add('active');
  }
});

/* ---------- ambient particle field (original, canvas-based) ---------- */
function initField(canvasId, dotColor) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
    const count = Math.min(60, Math.floor((w * h) / 22000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.6,
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = dotColor.replace(')', `,${0.12 * (1 - d / 110)})`).replace('rgb', 'rgba');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    if (!reduced) requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();
  tick();
}
initField('field', 'rgb(37,99,235)');
initField('field-dark', 'rgb(125,168,255)');

/* ---------- concierge chat (available site-wide, bilingual) ---------- */
const bot = document.getElementById('bot');
if (bot) {
  const lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
  const strings = {
    en: {
      greeting: "Questions about AI strategy, adoption, or how we work? Ask me anything — I'll answer honestly.",
      error: "Couldn't reach the concierge right now — please try again shortly, or email hello@parallel.ai.",
    },
    fr: {
      greeting: "Des questions sur la stratégie IA, l'adoption ou notre façon de travailler? Demandez-moi n'importe quoi — je répondrai honnêtement.",
      error: "Impossible de joindre le service en ce moment — veuillez réessayer bientôt, ou écrivez à hello@parallel.ai.",
    },
  }[lang];

  const botThread = document.getElementById('bot-thread');
  const botInput = document.getElementById('bot-input');
  const chatHistory = [{ role: 'assistant', text: strings.greeting }];

  document.querySelector('.bot-icon').addEventListener('click', () => bot.classList.add('open'));
  const botClose = document.getElementById('bot-close');
  if (botClose) botClose.addEventListener('click', (e) => { e.stopPropagation(); bot.classList.remove('open'); });

  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user-m' : 'bot-m');
    div.textContent = text;
    botThread.appendChild(div);
    botThread.scrollTop = botThread.scrollHeight;
    return div;
  }

  const leadStrings = {
    en: { prompt: 'Want Ankit or Alex to follow up on this directly? Leave your email (optional).', placeholder: 'you@company.com', send: 'Send', invalid: 'Enter a valid email address.', sending: 'Sending…', ok: "Done — we'll follow up.", fail: "Couldn't send that — try again shortly." },
    fr: { prompt: 'Souhaitez-vous qu’Ankit ou Alex vous recontacte directement? Laissez votre courriel (facultatif).', placeholder: 'vous@entreprise.com', send: 'Envoyer', invalid: 'Entrez une adresse courriel valide.', sending: 'Envoi…', ok: 'Fait — nous vous recontacterons.', fail: "Impossible d'envoyer — réessayez bientôt." },
  }[lang];

  let leadPromptShown = false;
  function showChatLeadPrompt() {
    const div = document.createElement('div');
    div.className = 'msg bot-m lead-inline';
    div.innerHTML = `${leadStrings.prompt}`
      + `<div class="lead-row"><input type="email" id="chat-lead-email" placeholder="${leadStrings.placeholder}">`
      + '<input type="text" id="chat-lead-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;">'
      + `<button id="chat-lead-send">${leadStrings.send}</button></div>`
      + '<span class="lead-status" id="chat-lead-status"></span>';
    botThread.appendChild(div);
    botThread.scrollTop = botThread.scrollHeight;
    const emailEl = div.querySelector('#chat-lead-email');
    const hpEl = div.querySelector('#chat-lead-hp');
    const statusEl = div.querySelector('#chat-lead-status');
    div.querySelector('#chat-lead-send').addEventListener('click', async () => {
      const email = emailEl.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        statusEl.textContent = leadStrings.invalid;
        return;
      }
      statusEl.textContent = leadStrings.sending;
      try {
        const res = await fetch('/api/lead', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'chat', lang, hp: hpEl.value, context: { transcript: chatHistory.slice(-6) } }),
        });
        statusEl.textContent = res.ok ? leadStrings.ok : leadStrings.fail;
      } catch {
        statusEl.textContent = leadStrings.fail;
      }
    });
  }

  window.sendChat = async function sendChat(text) {
    if (!text) return;
    bot.classList.add('open');
    addMsg('user', text);
    chatHistory.push({ role: 'user', text });
    const thinking = addMsg('assistant', lang === 'fr' ? 'Réflexion…' : 'Thinking…');
    thinking.classList.add('thinking');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, lang }),
      });
      const data = await res.json();
      thinking.remove();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      addMsg('assistant', data.reply);
      chatHistory.push({ role: 'assistant', text: data.reply });
      if (!leadPromptShown && chatHistory.filter(m => m.role === 'assistant').length >= 3) {
        leadPromptShown = true;
        showChatLeadPrompt();
      }
    } catch (err) {
      thinking.remove();
      addMsg('assistant', strings.error);
    }
  };
  document.getElementById('bot-send').addEventListener('click', () => { const v = botInput.value.trim(); botInput.value = ''; sendChat(v); });
  botInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = botInput.value.trim(); botInput.value = ''; sendChat(v); } });
  document.querySelectorAll('.bot-chip').forEach(b => b.addEventListener('click', () => sendChat(b.textContent)));
}

/* ---------- hero ask bar seeds the concierge (home page only) ---------- */
document.querySelectorAll('.ask-chip').forEach(b => b.addEventListener('click', () => window.sendChat && window.sendChat(b.dataset.q)));
const heroAskSend = document.getElementById('hero-ask-send');
if (heroAskSend) {
  heroAskSend.addEventListener('click', () => {
    const el = document.getElementById('hero-ask-input');
    const v = el.value.trim(); el.value = '';
    window.sendChat && window.sendChat(v);
  });
  document.getElementById('hero-ask-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = e.target.value.trim(); e.target.value = ''; window.sendChat && window.sendChat(v); }
  });
}

/* ---------- newsletter (no ESP configured — honest no-op success state) ---------- */
const newsForm = document.getElementById('news-form');
if (newsForm) {
  newsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.documentElement.lang === 'fr' ? 'Merci — vous êtes inscrit.' : "Thanks — you're on the list.";
    newsForm.innerHTML = `<p style="color:#fff;font-weight:600;font-size:14px;">${msg}</p>`;
  });
}
