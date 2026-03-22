/* ============================================
   MUSE - Static Ads Chat App + OpenAI
   ============================================ */

const chatMessages = document.getElementById('chatMessages');
const chatEmpty = document.getElementById('chatEmpty');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const newChatMobile = document.getElementById('newChatMobile');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

// Conversation history for OpenAI context
let conversationHistory = [];

// Ad template system
const AD_TEMPLATES = [
  { id: 'testimonial', label: 'Testimonial', prompt: 'Structure as a testimonial ad: large customer quote as hero text, product shot, star rating, short CTA. Social proof driven.' },
  { id: 'feature-benefit', label: 'Features', prompt: 'Structure as a feature & benefits ad: highlight 2-3 key features with icons or bullets, product image, clear CTA. Informative and clean.' },
  { id: 'before-after', label: 'Before/After', prompt: 'Structure as a before/after comparison ad: split layout showing the problem (left/top, muted) vs. the solution (right/bottom, vibrant). Dramatic contrast.' },
  { id: 'social-proof', label: 'Social Proof', prompt: 'Structure as a social proof ad: customer count, rating badge, review snippets, trust signals. "Join X people who..." angle.' },
  { id: 'problem-solution', label: 'Problem/Solution', prompt: 'Structure as a problem/solution ad: lead with the pain point (bold, attention-grabbing), then reveal the product as the answer. Two-part narrative.' },
  { id: 'product-showcase', label: 'Showcase', prompt: 'Structure as a product showcase ad: hero product photography, minimal text, premium feel. Let the product be the star. Clean, aspirational.' },
  { id: 'ugc-style', label: 'UGC Style', prompt: 'Structure as a UGC-style ad: make it look like organic user content, casual language, real-feeling photo style. Anti-polished, authentic.' },
  { id: 'advertorial', label: 'Advertorial', prompt: 'Structure as an advertorial ad: editorial/article style, informative headline, body text with facts, subtle product integration. Feels like content, not an ad.' },
  { id: 'offer-discount', label: 'Offer/Deal', prompt: 'Structure as a promotional offer ad: bold discount/offer as hero element (e.g. "50% OFF"), urgency cues, CTA button, product shot. Sale-driven.' },
  { id: 'comparison', label: 'Comparison', prompt: 'Structure as a comparison ad: "Us vs. Them" or feature comparison table/chart. Show clear superiority on key metrics. Data-driven.' },
  { id: 'stat-callout', label: 'Stat Callout', prompt: 'Structure as a stat/data callout ad: one bold statistic as the hero ("92% saw results"), supporting context below, product shot, CTA.' },
  { id: 'ingredients', label: 'Ingredients', prompt: 'Structure as an ingredients/what\'s inside ad: spotlight key ingredients with visuals, explain benefits, clean scientific-yet-approachable layout.' }
];

let selectedTemplate = null;

// Ad size options
const AD_SIZES = [
  { label: 'Feed 1:1', value: '1024x1024', ratio: '1/1' },
  { label: 'Portrait 4:5', value: '1024x1792', ratio: '4/5' },
  { label: 'Story 9:16', value: '1024x1792', ratio: '9/16' }
];

// Generate controls HTML (reused everywhere)
function createGenerateControls() {
  const defaultQuality = getDefaultQuality();
  const sizePills = AD_SIZES.map((s, i) =>
    `<button class="size-pill${i === 0 ? ' active' : ''}" data-size="${s.value}" data-ratio="${s.ratio}">${s.label}</button>`
  ).join('');
  const qualityPills = ['fast', 'quality', 'pro'].map(q =>
    `<button class="quality-pill${q === defaultQuality ? ' active' : ''}" data-quality="${q}">${q.charAt(0).toUpperCase() + q.slice(1)}</button>`
  ).join('');

  return `
    <div class="generate-controls">
      <div class="gen-row">
        <div class="size-pills">${sizePills}</div>
        <div class="quality-pills">${qualityPills}</div>
      </div>
      <div class="gen-row">
        <button class="generate-btn" onclick="handleGenerateAd(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          Generate this ad
        </button>
        <button class="generate-btn generate-btn--outline" onclick="handleBatchGenerate(this, 3)">Generate 3</button>
        <button class="generate-btn generate-btn--outline" onclick="handleBatchGenerate(this, 5)">Generate 5</button>
        <button class="action-btn" onclick="copyToClipboard(this)">Copy all</button>
      </div>
    </div>`;
}

// --- API Key Management ---
function getClaudeKey() { return localStorage.getItem('muse_claude_key') || ''; }
function setClaudeKey(key) { localStorage.setItem('muse_claude_key', key); updateApiStatus(); }
function getGeminiKey() { return localStorage.getItem('muse_gemini_key') || ''; }
function setGeminiKey(key) { localStorage.setItem('muse_gemini_key', key); updateApiStatus(); }
function getDefaultModel() { return localStorage.getItem('muse_default_model') || 'claude-sonnet-4-6'; }
function setDefaultModel(m) { localStorage.setItem('muse_default_model', m); }
function getDefaultQuality() { return localStorage.getItem('muse_default_quality') || 'quality'; }
function setDefaultQuality(q) { localStorage.setItem('muse_default_quality', q); }

function updateApiStatus() {
  const el = document.getElementById('apiStatus');
  const hasClaude = !!getClaudeKey();
  const hasGem = !!getGeminiKey();
  if (hasClaude && hasGem) { el.textContent = '2 keys'; el.classList.add('connected'); }
  else if (hasClaude || hasGem) { el.textContent = hasClaude ? 'Claude' : 'Gemini'; el.classList.add('connected'); }
  else { el.textContent = 'No API key'; el.classList.remove('connected'); }
}
updateApiStatus();

// Pill group helper
function initPillGroup(containerId, storageValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.pill-option').forEach(p => {
    p.classList.toggle('active', p.dataset.value === storageValue);
    p.addEventListener('click', () => {
      container.querySelectorAll('.pill-option').forEach(o => o.classList.remove('active'));
      p.classList.add('active');
    });
  });
}
function getPillValue(containerId) {
  const active = document.querySelector(`#${containerId} .pill-option.active`);
  return active ? active.dataset.value : null;
}

// Event delegation for inline pill clicks in generate controls
document.addEventListener('click', (e) => {
  const pill = e.target.closest('.size-pill, .quality-pill, .engine-pill');
  if (!pill) return;
  const group = pill.parentElement;
  group.querySelectorAll(`.${pill.className.split(' ')[0]}`).forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
});

// --- Brand DNA Context ---
function getBrandDnaContext() {
  const tone = document.getElementById('toneVoice')?.value?.trim() || '';
  const website = document.getElementById('websiteUrl')?.value?.trim() || '';
  const headingFont = document.querySelector('.dna-font-row .form-group-inline:first-child input')?.value || '';
  const bodyFont = document.querySelector('.dna-font-row .form-group-inline:last-child input')?.value || '';
  const colors = [];
  document.querySelectorAll('.color-swatch:not(.add-color)').forEach(s => {
    const hex = s.querySelector('span')?.textContent;
    if (hex) colors.push(hex);
  });

  let ctx = '';
  if (tone) ctx += `Brand tone & voice: ${tone}\n`;
  if (website) ctx += `Brand website: ${website}\n`;
  if (colors.length) ctx += `Brand colors: ${colors.join(', ')}\n`;
  if (headingFont) ctx += `Heading font: ${headingFont}\n`;
  if (bodyFont) ctx += `Body font: ${bodyFont}\n`;
  return ctx;
}

function buildSystemPrompt() {
  const brandDna = getBrandDnaContext();
  let prompt = `You are Muse, an expert AI creative strategist specialized in static advertising (single images, carousels, banners, display ads). You help create ad copy, concepts, and visual direction.

Your responses should be structured and actionable. Use these formatting rules for your output:
- Use markdown-style formatting: **bold** for emphasis, line breaks for structure
- For ad concepts, organize output into clear sections: Headline, Body Copy, CTA, Visual Direction, Layout Notes
- When giving multiple options, label them clearly (Concept A, Concept B, etc. or numbered lists)
- Keep your tone confident, creative, and concise - like a senior creative director
- Always include specific visual direction (colors, composition, typography placement, imagery description)
- When suggesting text for ads, put it in quotes

Available ad format templates you can use:
${AD_TEMPLATES.map(t => `- ${t.label}: ${t.prompt}`).join('\n')}

Select the most appropriate format based on the user's brief. Mention the format name at the top of your response (e.g. "Format: Testimonial").

Always end your responses with 2-3 suggested follow-up actions the user might want to take next.`;

  if (selectedTemplate) {
    prompt += `\n\nIMPORTANT: The user has selected the "${selectedTemplate.label}" format. ${selectedTemplate.prompt}`;
  }

  if (brandDna) {
    prompt += `\n\nThe user has configured their Brand DNA. Always align your suggestions with these brand guidelines:\n${brandDna}`;
  }

  return prompt;
}

// --- Claude Chat API ---
async function callClaude(userMessage) {
  const apiKey = getClaudeKey();
  if (!apiKey) return null;

  conversationHistory.push({ role: 'user', content: userMessage });

  // Claude Messages API uses separate system param, no system role in messages
  const messages = conversationHistory.slice(-20).map(m => ({
    role: m.role,
    content: m.content
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: getDefaultModel(),
      system: buildSystemPrompt(),
      messages,
      max_tokens: 2048
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude error: ${res.status}`);
  }

  const data = await res.json();
  const reply = data.content[0].text;
  conversationHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// --- Image Generation (Gemini) ---
async function generateAdImage(strategyText, size, qualityTier) {
  size = size || '1024x1024';
  qualityTier = qualityTier || getDefaultQuality();

  const brandDna = getBrandDnaContext();
  const imagePrompt = `Create a professional static advertisement image based on this creative brief. This should look like a real, polished ad ready for social media or display advertising.

Creative Brief:
${strategyText}

${brandDna ? `Brand Guidelines:\n${brandDna}\n` : ''}
Requirements:
- Professional advertising quality
- Clean, modern layout
- Text should be minimal and readable
- Commercial product photography style
- High contrast, eye-catching composition
- Do NOT include any watermarks or AI artifacts`;

  return generateWithGemini(imagePrompt, size, qualityTier);
}

async function generateWithGemini(prompt, size, qualityTier) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('No Gemini API key set. Add one in Settings.');

  // Model selection: pro = best quality, quality = balanced, fast = fastest
  const model = qualityTier === 'pro' ? 'gemini-3-pro-image-preview' : qualityTier === 'fast' ? 'gemini-2.5-flash-image' : 'gemini-3.1-flash-image-preview';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || JSON.stringify(err).slice(0, 200);
    throw new Error(`Gemini error: ${msg}`);
  }

  const data = await res.json();

  // Extract base64 image from Gemini response
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData);
  if (!imgPart) throw new Error('Gemini returned no image. Try a different prompt or a different quality tier.');
  const b64 = imgPart.inlineData.data;
  const mime = imgPart.inlineData.mimeType || 'image/png';

  if (!b64) throw new Error('No image data in Gemini response.');

  const blob = await fetch(`data:${mime};base64,${b64}`).then(r => r.blob());
  return URL.createObjectURL(blob);
}

// --- Batch Generation ---
async function handleBatchGenerate(btn, count) {
  const controls = btn.closest('.generate-controls');
  const msgContent = controls?.closest('.msg-content') || controls?.closest('.msg-body');
  const strategyText = msgContent ? msgContent.innerText.replace(/Generate this ad|Generate \d|Copy all/g, '').trim() : '';

  const size = controls?.querySelector('.size-pill.active')?.dataset.size || '1024x1024';
  const quality = controls?.querySelector('.quality-pill.active')?.dataset.quality || getDefaultQuality();

  // Replace controls with progress
  const parent = controls.parentElement;
  const progressEl = document.createElement('div');
  progressEl.innerHTML = `
    <div class="batch-progress"><div class="batch-bar" style="width:0%"></div></div>
    <div class="generating-spinner"><div class="spin"></div> Generating ${count} variations... <span class="batch-count">0/${count}</span></div>`;
  parent.appendChild(progressEl);

  const gallery = document.createElement('div');
  gallery.className = 'batch-gallery';
  gallery.innerHTML = '<div class="batch-gallery-scroll"></div>';
  parent.appendChild(gallery);
  const scroll = gallery.querySelector('.batch-gallery-scroll');

  let completed = 0;
  const maxConcurrent = 3;
  let running = 0;
  const queue = [];

  for (let i = 0; i < count; i++) {
    const variationPrompt = strategyText + `\n\n[Variation ${i + 1} of ${count} — create a distinctly different visual approach, different composition and color treatment]`;
    queue.push(variationPrompt);
  }

  async function runNext() {
    if (queue.length === 0) return;
    const prompt = queue.shift();
    running++;
    try {
      const imgUrl = await generateAdImage(prompt, size, quality, engine);
      const card = document.createElement('div');
      card.className = 'batch-image-card';
      card.innerHTML = `<img src="${imgUrl}" alt="Generated ad variation" loading="lazy">
        <div class="generated-image-actions">
          <button class="action-btn" onclick="downloadImage('${imgUrl}')">Download</button>
        </div>`;
      scroll.appendChild(card);
    } catch (err) {
      const card = document.createElement('div');
      card.className = 'batch-image-card';
      card.innerHTML = `<div style="padding:16px;color:var(--red);font-size:0.82rem">Failed: ${err.message}</div>`;
      scroll.appendChild(card);
    }
    completed++;
    running--;
    const pct = Math.round((completed / count) * 100);
    progressEl.querySelector('.batch-bar').style.width = pct + '%';
    progressEl.querySelector('.batch-count').textContent = `${completed}/${count}`;
    if (completed === count) {
      progressEl.querySelector('.generating-spinner').innerHTML = `Done! ${count} variations generated.`;
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Concurrent execution with semaphore
  const workers = [];
  for (let i = 0; i < Math.min(maxConcurrent, count); i++) {
    workers.push((async () => {
      while (queue.length > 0 || running > maxConcurrent) {
        if (queue.length > 0) await runNext();
        else await new Promise(r => setTimeout(r, 100));
      }
    })());
  }
  await Promise.all(workers);
}

// --- Format AI text to HTML ---
function formatAiResponse(text) {
  // Convert markdown-ish formatting to HTML
  let html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<div class="script-label">$1</div>')
    .replace(/^## (.+)$/gm, '<h4 style="margin:16px 0 8px;font-size:0.95rem">$1</h4>')
    .replace(/^# (.+)$/gm, '<h3 style="margin:20px 0 10px">$1</h3>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em">$1</code>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');

  // Wrap sections that look like output cards
  html = html.replace(/<div class="script-label">(.+?)<\/div>/g, (match, label) => {
    return `<div class="script-section"><div class="script-label">${label}</div>`;
  });

  return html;
}

// --- Textarea auto-resize ---
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
  sendBtn.disabled = chatInput.value.trim() === '';
});

// --- Send message ---
async function sendMessage(text) {
  const msg = text || chatInput.value.trim();
  if (!msg) return;

  chatEmpty.classList.add('hidden');
  chatMessages.classList.add('visible');

  addMessage('user', msg);

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Clear attachments
  attachmentsStrip.innerHTML = '';
  updateStripVisibility();

  const typingEl = showTyping();

  if (getClaudeKey()) {
    // Real AI response via Claude
    try {
      const reply = await callClaude(msg);
      typingEl.remove();
      const formattedHtml = formatAiResponse(reply);
      addMessage('bot', formattedHtml + createGenerateControls());
    } catch (err) {
      typingEl.remove();
      addMessage('bot', `<p style="color:var(--red)">Error: ${escapeHtml(err.message)}</p><p>Check your Claude API key in Settings.</p>`);
    }
  } else {
    // Fallback: simulated responses
    setTimeout(() => {
      typingEl.remove();
      const response = generateFallbackResponse(msg);
      addMessage('bot', response);
    }, 1200 + Math.random() * 1200);
  }
}

sendBtn.addEventListener('click', () => sendMessage());
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function useStarter(text) {
  chatInput.value = text;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
  sendBtn.disabled = false;
  chatInput.focus();
  sendMessage(text);
}

// --- Handle "Generate this ad" button ---
async function handleGenerateAd(btn) {
  if (!getGeminiKey()) {
    openSettings();
    return;
  }

  const controls = btn.closest('.generate-controls');
  const msgContent = controls?.closest('.msg-content') || btn.closest('.msg-content') || btn.closest('.msg-body');
  const strategyText = msgContent ? msgContent.innerText.replace(/Generate this ad|Generate \d|Copy all|Feed 1:1|Portrait 4:5|Story 9:16|Fast|Quality|Pro/g, '').trim() : '';

  const size = controls?.querySelector('.size-pill.active')?.dataset.size || '1024x1024';
  const quality = controls?.querySelector('.quality-pill.active')?.dataset.quality || getDefaultQuality();

  // Replace controls with spinner
  const actionsDiv = controls || btn.closest('.msg-actions');
  const originalHtml = actionsDiv.innerHTML;
  actionsDiv.innerHTML = `
    <div class="generating-spinner">
      <div class="spin"></div>
      Generating your ad...
    </div>`;

  try {
    const imageUrl = await generateAdImage(strategyText, size, quality);

    const imageCard = document.createElement('div');
    imageCard.className = 'generated-image-card';
    imageCard.innerHTML = `
      <img src="${imageUrl}" alt="Generated static ad" loading="lazy">
      <div class="generated-image-actions">
        <button class="action-btn" onclick="downloadImage('${imageUrl}')">Download</button>
        <button class="generate-btn" onclick="regenerateAd(this, ${JSON.stringify(strategyText).replace(/"/g, '&quot;')}, '${size}', '${quality}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Regenerate
        </button>
      </div>`;

    actionsDiv.innerHTML = originalHtml;
    actionsDiv.parentElement.appendChild(imageCard);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    actionsDiv.innerHTML = originalHtml;
    // Show error inline
    const errEl = document.createElement('p');
    errEl.style.cssText = 'color:var(--red);font-size:0.85rem;margin-top:8px';
    errEl.textContent = `Image generation failed: ${err.message}`;
    actionsDiv.parentElement.appendChild(errEl);
  }
}

async function regenerateAd(btn, strategyText, size, quality) {
  const card = btn.closest('.generated-image-card');
  const img = card.querySelector('img');
  const actionsDiv = card.querySelector('.generated-image-actions');
  const originalHtml = actionsDiv.innerHTML;

  actionsDiv.innerHTML = `<div class="generating-spinner"><div class="spin"></div>Regenerating...</div>`;
  img.style.opacity = '0.4';

  try {
    const imageUrl = await generateAdImage(strategyText, size, quality);
    img.src = imageUrl;
    img.style.opacity = '1';
    actionsDiv.innerHTML = originalHtml;
    const dlBtn = actionsDiv.querySelector('.action-btn');
    if (dlBtn) dlBtn.setAttribute('onclick', `downloadImage('${imageUrl}')`);
  } catch (err) {
    img.style.opacity = '1';
    actionsDiv.innerHTML = originalHtml;
  }
}

function downloadImage(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = `muse-ad-${Date.now()}.png`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- Add message ---
function addMessage(type, content) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (type === 'user') {
    div.innerHTML = `
      <div class="message-inner">
        <div class="msg-avatar user">H</div>
        <div class="msg-body">
          <div class="msg-content"><p>${escapeHtml(content)}</p></div>
        </div>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="message-inner">
        <div class="msg-avatar bot">M</div>
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-name">Muse</span>
            <span class="msg-time">${time}</span>
          </div>
          <div class="msg-content">${content}</div>
        </div>
      </div>`;
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Typing indicator ---
function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `
    <div class="message-inner">
      <div class="msg-avatar bot">M</div>
      <div class="msg-body">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// --- Fallback response router (no API key) ---
function generateFallbackResponse(userMsg) {
  const lower = userMsg.toLowerCase();

  if (lower.includes('carousel'))                         return carouselResponse();
  if (lower.includes('single image') || lower.includes('facebook') || lower.includes('meta'))
                                                          return singleImageResponse();
  if (lower.includes('headline') || lower.includes('variation') || lower.includes('copy'))
                                                          return copyVariationsResponse();
  if (lower.includes('concept') || lower.includes('visual') || lower.includes('layout'))
                                                          return adConceptResponse();
  if (lower.includes('banner') || lower.includes('display') || lower.includes('google'))
                                                          return bannerResponse();
  if (lower.includes('competitor') || lower.includes('analyze') || lower.includes('spy'))
                                                          return competitorResponse();
  return defaultResponse();
}

/* ---------- fallback response templates ---------- */

function singleImageResponse() {
  return `
    <p>Here's a complete single-image static ad ready for production:</p>
    <div class="output-card">
      <div class="output-card-header">
        <span class="output-badge">AD CONCEPT</span>
        <span class="output-type">Single Image &middot; 1080&times;1080</span>
      </div>
      <div class="script-section">
        <div class="script-label">Headline</div>
        <p>"Your skin deserves better than guesswork."</p>
      </div>
      <div class="script-section">
        <div class="script-label">Body Copy</div>
        <p>Lightweight, fragrance-free, and clinically tested for sensitive skin. Finally, a moisturizer that works without the irritation.</p>
      </div>
      <div class="script-section">
        <div class="script-label">CTA</div>
        <p>Shop Now &rarr;</p>
      </div>
      <div class="script-section">
        <div class="script-label">Visual Direction</div>
        <p>Close-up of the product on a soft, neutral surface (marble or linen). Dewy water droplets on the jar. Warm, natural lighting. Minimal text overlay.</p>
      </div>
    </div>
    ${createGenerateControls()}`;
}

function carouselResponse() {
  return `
    <p>Here's a 5-slide carousel ad with copy and visual direction for each card:</p>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">SLIDE 1</span><span class="output-type">Hook Slide</span></div>
      <div class="script-section"><div class="script-label">Text</div><p>"You're spending 2 hours a day on food you don't even enjoy."</p></div>
      <div class="script-section"><div class="script-label">Visual</div><p>Bold white text on a dark background. Full-bleed, high contrast to stop the scroll.</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">SLIDE 2</span><span class="output-type">Problem</span></div>
      <div class="script-section"><div class="script-label">Text</div><p>"Grocery shopping. Meal planning. Cooking. Cleaning up. Repeat."</p></div>
      <div class="script-section"><div class="script-label">Visual</div><p>Split-grid showing tedious tasks. Muted, desaturated tones to convey the drag.</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">SLIDE 3</span><span class="output-type">Solution</span></div>
      <div class="script-section"><div class="script-label">Text</div><p>"What if healthy meals showed up at your door, ready in 3 minutes?"</p></div>
      <div class="script-section"><div class="script-label">Visual</div><p>Bright, vibrant product shot. Warm, inviting colors - total mood shift from slide 2.</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">SLIDE 4</span><span class="output-type">Social Proof</span></div>
      <div class="script-section"><div class="script-label">Text</div><p>"Join 15,000+ busy professionals who got their evenings back."</p></div>
      <div class="script-section"><div class="script-label">Visual</div><p>Collage of real customer photos. Star rating badge. Keep it authentic.</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">SLIDE 5</span><span class="output-type">CTA Slide</span></div>
      <div class="script-section"><div class="script-label">Text</div><p>"First week free. No commitment." <strong>Try it now &rarr;</strong></p></div>
      <div class="script-section"><div class="script-label">Visual</div><p>Product lineup shot with clean background. Big, bold CTA button graphic.</p></div>
    </div>
    ${createGenerateControls()}`;
}

function copyVariationsResponse() {
  return `
    <p>Here are 10 headline + body copy pairs ready to test:</p>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">BENEFIT-LED</span></div>
      <p><strong>1.</strong> "Your team just found 5 extra hours a week." <em>&mdash; See how teams ship 2x faster.</em></p>
      <p><strong>2.</strong> "One tool. Every project. Zero confusion." <em>&mdash; Stop juggling 6 apps.</em></p>
      <p><strong>3.</strong> "Deadlines hit, sanity intact." <em>&mdash; Built for teams that finish things.</em></p>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">PAIN POINT</span></div>
      <p><strong>4.</strong> "Still tracking projects in spreadsheets?" <em>&mdash; There's a better way.</em></p>
      <p><strong>5.</strong> "Meetings about meetings about the project." <em>&mdash; Replace updates with visibility.</em></p>
      <p><strong>6.</strong> "If your PM tool needs a tutorial, it's the wrong tool." <em>&mdash; Set up in 2 minutes.</em></p>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">SOCIAL PROOF</span></div>
      <p><strong>7.</strong> "10,000+ teams switched this quarter." <em>&mdash; They're shipping faster.</em></p>
      <p><strong>8.</strong> "Rated #1 on G2 for a reason." <em>&mdash; 4.9 stars from 3,400+ reviews.</em></p>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">URGENCY / DIRECT</span></div>
      <p><strong>9.</strong> "Start for free. No credit card." <em>&mdash; See what organized feels like.</em></p>
      <p><strong>10.</strong> "Your competitors are already using this." <em>&mdash; Don't find out last.</em></p>
    </div>
    ${createGenerateControls()}`;
}

function adConceptResponse() {
  return `
    <p>Here are 3 distinct ad concepts for your protein powder:</p>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">CONCEPT A</span><span class="output-type">"The Milkshake Test"</span></div>
      <div class="script-section"><div class="script-label">Headline</div><p>"68 people thought this was a milkshake. It's 30g of protein."</p></div>
      <div class="script-section"><div class="script-label">Body</div><p>Dessert-level taste. Zero compromise on macros.</p></div>
      <div class="script-section"><div class="script-label">Visual Direction</div><p>Side-by-side: milkshake vs. protein shake in identical glasses. Clean white background. Challenge-style layout.</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">CONCEPT B</span><span class="output-type">"Chalky is cancelled"</span></div>
      <div class="script-section"><div class="script-label">Headline</div><p>"Life's too short for chalky protein."</p></div>
      <div class="script-section"><div class="script-label">Visual Direction</div><p>Generic powder (desaturated, crossed out) vs. your product (creamy, mid-pour). Bold, dark background.</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">CONCEPT C</span><span class="output-type">"The review speaks"</span></div>
      <div class="script-section"><div class="script-label">Headline</div><p>"Honestly tastes like a chocolate milkshake" &mdash; @jake_lifts</p></div>
      <div class="script-section"><div class="script-label">Visual Direction</div><p>Large pull-quote as hero. Product shot below. Textured gym/concrete aesthetic.</p></div>
    </div>
    ${createGenerateControls()}`;
}

function bannerResponse() {
  return `
    <p>Here are Google Display banner ad variations:</p>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">300&times;250</span><span class="output-type">Medium Rectangle</span></div>
      <div class="script-section"><div class="script-label">Headline</div><p>"Your team. One tool. Zero chaos."</p></div>
      <div class="script-section"><div class="script-label">Body</div><p>Project management that actually works. Free to start.</p></div>
      <div class="script-section"><div class="script-label">CTA</div><p>Try Free &rarr;</p></div>
    </div>
    <div class="output-card">
      <div class="output-card-header"><span class="output-badge">728&times;90</span><span class="output-type">Leaderboard</span></div>
      <div class="script-section"><div class="script-label">Copy</div><p><strong>"Stop managing chaos. Start managing projects."</strong> &mdash; Trusted by 10,000+ teams.</p></div>
    </div>
    ${createGenerateControls()}`;
}

function competitorResponse() {
  return `
    <p>Here's my static ad analysis:</p>
    <div class="output-card">
      <div class="script-section">
        <div class="script-label">Ad Formats They Use</div>
        <p><strong>1. Before/After static</strong> &mdash; Side-by-side comparisons. Most-used on Meta.<br>
        <strong>2. Review screenshot ads</strong> &mdash; Real reviews with product overlay.<br>
        <strong>3. Ingredient spotlight</strong> &mdash; Single-ingredient hero, clinical layout.</p>
      </div>
      <div class="script-section">
        <div class="script-label">Gaps You Can Exploit</div>
        <p><strong>1. Zero personality</strong> &mdash; Warm, relatable tone would stand out.<br>
        <strong>2. No real social proof</strong> &mdash; Real customer quotes are missing.<br>
        <strong>3. Same layout every time</strong> &mdash; Bold, colorful design would catch attention.</p>
      </div>
    </div>
    <p>Want me to create static ads that exploit these gaps?</p>
    <div class="msg-actions">
      <button class="action-btn" onclick="sendMessage('Create a warm, personality-driven single image ad')">Warm personality ad</button>
      <button class="action-btn" onclick="sendMessage('Create a review-based static ad')">Social proof ad</button>
      <button class="action-btn" onclick="sendMessage('Create a bold, colorful ad concept')">Bold design concept</button>
    </div>`;
}

function defaultResponse() {
  return `
    <p>Great, I can work with that! For static ads, here are the strongest angles:</p>
    <div class="output-card">
      <div class="script-section">
        <div class="script-label">Recommended Angles</div>
        <p><strong>1. Pain point headline</strong> &mdash; Lead with the frustration your audience feels.<br>
        <strong>2. Social proof card</strong> &mdash; Feature a real customer quote as the hero text.<br>
        <strong>3. Before/After or Versus</strong> &mdash; Visual comparison for instant benefit clarity.</p>
      </div>
    </div>
    <p>What should I create first?</p>
    <div class="msg-actions">
      <button class="action-btn" onclick="sendMessage('Create a single-image ad with a pain point headline')">Single image ad</button>
      <button class="action-btn" onclick="sendMessage('Create a 5-slide carousel ad')">Carousel ad</button>
      <button class="action-btn" onclick="sendMessage('Give me 10 headline and body copy variations')">Copy variations</button>
      <button class="action-btn" onclick="sendMessage('Give me 3 distinct ad concepts with visual direction')">Ad concepts</button>
    </div>`;
}

/* ---------- utilities ---------- */

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function copyToClipboard(btn) {
  const card = btn.closest('.msg-content') || btn.closest('.message');
  const text = card ? card.innerText : '';
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

function newChat() {
  chatMessages.innerHTML = '';
  chatMessages.classList.remove('visible');
  chatEmpty.classList.remove('hidden');
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  conversationHistory = [];
  chatInput.focus();
  sidebar.classList.remove('open');
  document.querySelector('.overlay')?.classList.remove('visible');
}

newChatBtn.addEventListener('click', newChat);
newChatMobile?.addEventListener('click', newChat);

sidebarToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  let overlay = document.querySelector('.overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }
  overlay.classList.toggle('visible');
});

document.querySelectorAll('.chat-list-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.chat-list-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    sidebar.classList.remove('open');
    document.querySelector('.overlay')?.classList.remove('visible');
  });
});

// --- Settings modal ---
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsCancel = document.getElementById('settingsCancel');
const settingsSave = document.getElementById('settingsSave');
const apiKeyInput = document.getElementById('apiKeyInput');

const claudeKeyInput = document.getElementById('claudeKeyInput');
const geminiKeyInput = document.getElementById('geminiKeyInput');

function openSettings() {
  settingsModal.classList.add('open');
  claudeKeyInput.value = getClaudeKey();
  geminiKeyInput.value = getGeminiKey();
  initPillGroup('modelSelector', getDefaultModel());
  initPillGroup('qualitySelector', getDefaultQuality());
  setTimeout(() => claudeKeyInput.focus(), 100);
}
function closeSettings() { settingsModal.classList.remove('open'); }

settingsBtn.addEventListener('click', openSettings);
settingsCancel.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });
settingsSave.addEventListener('click', () => {
  setClaudeKey(claudeKeyInput.value.trim());
  setGeminiKey(geminiKeyInput.value.trim());
  const model = getPillValue('modelSelector');
  const quality = getPillValue('qualitySelector');
  if (model) setDefaultModel(model);
  if (quality) setDefaultQuality(quality);
  closeSettings();
});

// --- Brand DNA panel ---
const dnaPanel = document.getElementById('dnaPanel');
const dnaOverlay = document.getElementById('dnaOverlay');
const dnaClose = document.getElementById('dnaClose');
const brandDnaBtn = document.getElementById('brandDnaBtn');
const dnaSave = document.getElementById('dnaSave');

function openDna() {
  dnaPanel.classList.add('open');
  dnaOverlay.classList.add('open');
}
function closeDna() {
  dnaPanel.classList.remove('open');
  dnaOverlay.classList.remove('open');
}

brandDnaBtn.addEventListener('click', openDna);
dnaClose.addEventListener('click', closeDna);
dnaOverlay.addEventListener('click', closeDna);
dnaSave.addEventListener('click', () => {
  closeDna();
  const status = brandDnaBtn.querySelector('.dna-status');
  status.textContent = 'Configured';
  status.classList.add('configured');
});

// --- Upload zones (Brand DNA) ---
document.querySelectorAll('.dna-upload-zone').forEach(zone => {
  const input = zone.querySelector('.file-input');
  const zoneId = zone.id;
  const filesContainer = document.getElementById(zoneId.replace('Zone', 'Files'));

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (filesContainer) handleDnaFiles(e.dataTransfer.files, filesContainer);
  });

  input.addEventListener('change', () => {
    if (filesContainer) handleDnaFiles(input.files, filesContainer);
    input.value = '';
  });
});

function handleDnaFiles(files, container) {
  Array.from(files).forEach(file => {
    const item = document.createElement('div');
    item.className = 'dna-file-item';
    item.innerHTML = `
      <svg class="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="file-name">${file.name}</span>
      <button class="file-remove" title="Remove">&times;</button>`;
    item.querySelector('.file-remove').addEventListener('click', () => item.remove());
    container.appendChild(item);
  });
}

// --- Website save button + Brand Research ---
const websiteSave = document.getElementById('websiteSave');
const websiteUrl = document.getElementById('websiteUrl');
const websiteResearch = document.getElementById('websiteResearch');
const brandResearchResults = document.getElementById('brandResearchResults');

websiteUrl.addEventListener('input', () => { websiteSave.textContent = 'Save'; });
websiteSave.addEventListener('click', () => { websiteSave.textContent = 'Saved'; });

// One-shot Claude call (no conversation history)
async function callClaudeOneShot(systemPrompt, userMsg) {
  const apiKey = getClaudeKey();
  if (!apiKey) throw new Error('No Claude API key set.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      system: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, no other text.',
      messages: [{ role: 'user', content: userMsg }],
      max_tokens: 1024
    })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Claude error: ${res.status}`); }
  const data = await res.json();
  const text = data.content[0].text;
  // Extract JSON from response (Claude may wrap in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON from response');
  return JSON.parse(jsonMatch[0]);
}

websiteResearch?.addEventListener('click', async () => {
  const url = websiteUrl.value.trim();
  if (!url) return;
  if (!getClaudeKey()) { openSettings(); return; }

  brandResearchResults.classList.add('visible');
  brandResearchResults.innerHTML = '<div class="generating-spinner"><div class="spin"></div> Researching brand...</div>';

  try {
    const data = await callClaudeOneShot(
      `You are a brand research analyst. Given a website URL, use your training knowledge to analyze the brand. Return JSON with these fields:
      { "name": "brand name", "category": "e.g. Skincare, SaaS, Fashion", "tone": "description of brand voice and tone (2-3 sentences)", "colors": ["#hex1", "#hex2", "#hex3"], "targetAudience": "who they sell to", "keyBenefits": "top 3 benefits, comma separated", "photographyStyle": "description of their visual style" }
      If you don't know the brand, make reasonable inferences from the URL/domain name. Always return valid JSON.`,
      `Analyze this brand: ${url}`
    );

    const colorsHtml = (data.colors || []).map(c => `<div class="research-color" style="background:${c}" title="${c}"></div>`).join('');

    brandResearchResults.innerHTML = `
      <div class="research-card">
        <div class="research-field"><div class="research-field-label">Brand Name</div><div class="research-field-value">${data.name || 'Unknown'}</div></div>
        <div class="research-field"><div class="research-field-label">Category</div><div class="research-field-value">${data.category || ''}</div></div>
        <div class="research-field"><div class="research-field-label">Tone & Voice</div><div class="research-field-value">${data.tone || ''}</div></div>
        <div class="research-field"><div class="research-field-label">Colors</div><div class="research-colors">${colorsHtml}</div></div>
        <div class="research-field"><div class="research-field-label">Target Audience</div><div class="research-field-value">${data.targetAudience || ''}</div></div>
        <div class="research-field"><div class="research-field-label">Key Benefits</div><div class="research-field-value">${data.keyBenefits || ''}</div></div>
        <div class="research-field"><div class="research-field-label">Photography Style</div><div class="research-field-value">${data.photographyStyle || ''}</div></div>
        <button class="research-apply-btn" onclick="applyBrandResearch(${escapeHtml(JSON.stringify(data)).replace(/'/g, '\\\'')})">Apply to Brand DNA</button>
      </div>`;
  } catch (err) {
    brandResearchResults.innerHTML = `<p style="color:var(--red);font-size:0.82rem">Research failed: ${err.message}</p>`;
  }
});

function applyBrandResearch(data) {
  if (typeof data === 'string') data = JSON.parse(data);

  // Apply tone
  const toneEl = document.getElementById('toneVoice');
  if (toneEl && data.tone) toneEl.value = data.tone;

  // Apply colors — replace existing swatches
  if (data.colors?.length) {
    const colorsContainer = document.querySelector('.dna-colors');
    const addBtn = colorsContainer.querySelector('.add-color');
    colorsContainer.querySelectorAll('.color-swatch:not(.add-color)').forEach(s => s.remove());
    data.colors.forEach(hex => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = hex;
      swatch.title = hex;
      swatch.innerHTML = `<span>${hex}</span>`;
      colorsContainer.insertBefore(swatch, addBtn);
    });
  }

  // Flash the apply button
  brandResearchResults.querySelector('.research-apply-btn').textContent = 'Applied!';
  setTimeout(() => {
    brandResearchResults.classList.remove('visible');
    brandResearchResults.innerHTML = '';
  }, 1500);
}

// --- Attachment dropdown ---
const attachBtn = document.getElementById('attachBtn');
const attachMenu = document.getElementById('attachMenu');
const photoInput = document.getElementById('photoInput');
const fileInput = document.getElementById('fileInput');
const refInput = document.getElementById('refInput');
const linkModal = document.getElementById('linkModal');
const linkInput = document.getElementById('linkInput');
const linkCancel = document.getElementById('linkCancel');
const linkAdd = document.getElementById('linkAdd');
const attachmentsStrip = document.getElementById('attachmentsStrip');

attachBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  attachMenu.classList.toggle('open');
});

document.addEventListener('click', () => attachMenu.classList.remove('open'));
attachMenu.addEventListener('click', (e) => e.stopPropagation());

document.querySelectorAll('.attach-option').forEach(opt => {
  opt.addEventListener('click', () => {
    attachMenu.classList.remove('open');
    const type = opt.dataset.type;
    if (type === 'photo') photoInput.click();
    else if (type === 'file') fileInput.click();
    else if (type === 'reference') refInput.click();
    else if (type === 'link') openLinkModal();
  });
});

photoInput.addEventListener('change', () => { addFileChips(photoInput.files, 'photo'); photoInput.value = ''; });
fileInput.addEventListener('change', () => { addFileChips(fileInput.files, 'file'); fileInput.value = ''; });
refInput.addEventListener('change', () => { addFileChips(refInput.files, 'ref'); refInput.value = ''; });

function addFileChips(files, type) {
  Array.from(files).forEach(file => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    if (type === 'photo' || type === 'ref') {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      chip.appendChild(img);
    }
    const name = document.createElement('span');
    name.textContent = file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name;
    chip.appendChild(name);
    const remove = document.createElement('button');
    remove.className = 'chip-remove';
    remove.innerHTML = '&times;';
    remove.addEventListener('click', () => { chip.remove(); updateStripVisibility(); });
    chip.appendChild(remove);
    attachmentsStrip.appendChild(chip);
  });
  updateStripVisibility();
}

function addLinkChip(url) {
  const chip = document.createElement('div');
  chip.className = 'attachment-chip';
  chip.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
    <span>${url.length > 30 ? url.slice(0, 27) + '...' : url}</span>
    <button class="chip-remove">&times;</button>`;
  chip.querySelector('.chip-remove').addEventListener('click', () => { chip.remove(); updateStripVisibility(); });
  attachmentsStrip.appendChild(chip);
  updateStripVisibility();
}

function updateStripVisibility() {
  if (attachmentsStrip.children.length > 0) {
    attachmentsStrip.classList.add('visible');
  } else {
    attachmentsStrip.classList.remove('visible');
  }
}

// --- Link modal ---
function openLinkModal() {
  linkModal.classList.add('open');
  linkInput.value = '';
  setTimeout(() => linkInput.focus(), 100);
}
function closeLinkModal() { linkModal.classList.remove('open'); }

linkCancel.addEventListener('click', closeLinkModal);
linkModal.addEventListener('click', (e) => { if (e.target === linkModal) closeLinkModal(); });
linkAdd.addEventListener('click', () => {
  const url = linkInput.value.trim();
  if (url) {
    addLinkChip(url);
    closeLinkModal();
  }
});
linkInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); linkAdd.click(); }
});

// --- Template pills ---
const templatePills = document.getElementById('templatePills');
if (templatePills) {
  AD_TEMPLATES.forEach(t => {
    const pill = document.createElement('button');
    pill.className = 'template-pill';
    pill.textContent = t.label;
    pill.dataset.id = t.id;
    pill.addEventListener('click', () => {
      const wasActive = pill.classList.contains('active');
      templatePills.querySelectorAll('.template-pill').forEach(p => p.classList.remove('active'));
      if (!wasActive) {
        pill.classList.add('active');
        selectedTemplate = t;
      } else {
        selectedTemplate = null;
      }
    });
    templatePills.appendChild(pill);
  });
}

chatInput.focus();
