const express  = require('express');
const multer   = require('multer');
const nodemailer = require('nodemailer');
const fetch    = require('node-fetch');
const path     = require('path');
const fs       = require('fs');
const cors     = require('cors');

const app  = express();
const PORT = 3132;

const CV_DIR       = path.join(__dirname, 'cv-uploads');
const HISTORY_FILE = path.join(__dirname, 'staj-history.json');

if (!fs.existsSync(CV_DIR)) fs.mkdirSync(CV_DIR, { recursive: true });

let currentCvPath = null;

let stajHistory = [];
try {
  if (fs.existsSync(HISTORY_FILE))
    stajHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
} catch (e) { stajHistory = []; }

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(stajHistory, null, 2), 'utf8');
}

// ── Multer: only PDF ──────────────────────────────────────────────────────────
const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CV_DIR),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const cvUpload = multer({
  storage: cvStorage,
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    ok ? cb(null, true) : cb(new Error('Sadece PDF dosyası kabul edilir.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── POST /staj/smtp-verify ────────────────────────────────────────────────────
app.post('/staj/smtp-verify', async (req, res) => {
  const { host, port, user, pass } = req.body;
  if (!user || !pass) return res.status(400).json({ ok: false, error: 'Kullanıcı adı ve şifre gerekli.' });
  try {
    const t = nodemailer.createTransport({
      host:   host || 'smtpout.secureserver.net',
      port:   parseInt(port) || 465,
      secure: parseInt(port) === 465,
      auth:   { user, pass }
    });
    await t.verify();
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── POST /staj/upload-cv ──────────────────────────────────────────────────────
app.post('/staj/upload-cv', (req, res) => {
  cvUpload.single('cv')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'Dosya bulunamadı.' });
    currentCvPath = req.file.path;
    res.json({ ok: true, filename: req.file.originalname, storedAs: req.file.filename });
  });
});

// ── Yardımcı sabitler ─────────────────────────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const HR_RE    = /\b(ik|hr|kariyer|staj|insan|human|recruit|talent)\b/i;
const SKIP_RE  = /noreply|no-reply|donotreply|example|test\b|sentry|@sentry|@gmail\.com|@hotmail|@yahoo/i;

function pickBestEmail(emails) {
  const valid = [...new Set(emails)].filter(e => e.length < 80 && !SKIP_RE.test(e));
  return valid.find(e => HR_RE.test(e)) || valid[0] || null;
}

// ── Şirket web sitesini tara ─────────────────────────────────────────────────
async function scrapeEmails(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const html = await resp.text();
    return html.match(EMAIL_RE) || [];
  } catch (_) {
    clearTimeout(timer);
    return [];
  }
}

async function findRealEmail(websiteUrl) {
  const base  = websiteUrl.replace(/\/$/, '');
  const pages = ['/ik', '/kariyer', '/insan-kaynaklari', '/staj', '/iletisim', '/hr', '/contact', ''];
  for (const suffix of pages) {
    const found = pickBestEmail(await scrapeEmails(base + suffix));
    if (found) return found;
  }
  return null;
}

// ── DuckDuckGo ile web araması ────────────────────────────────────────────────
async function searchDDG(query) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      }
    });
    clearTimeout(timer);
    if (!resp.ok) return { urls: [], emails: [] };
    const html = await resp.text();

    // Snippet'lerdeki direkt emailler
    const emails = html.match(EMAIL_RE) || [];

    // Sonuç URL'leri
    const urls = [...html.matchAll(/class="result__url"[^>]*>\s*([^\s<]+)/g)]
      .map(m => { let u = m[1].trim(); return u.startsWith('http') ? u : 'https://' + u; })
      .slice(0, 5);

    return { urls, emails };
  } catch (_) {
    clearTimeout(timer);
    return { urls: [], emails: [] };
  }
}

// ── Türk staj & kariyer portalları ───────────────────────────────────────────
const STAJ_PORTALS = [
  'kariyer.net',
  'yenibiris.com',
  'secretcv.com',
  'linkedin.com',
  'staj.com.tr',
  'stajyer.com',
  'kampuskariyeri.com',
  'enuygun.com/staj',
];

// ── OpenAI için sunucu tarafında e-posta ara ──────────────────────────────────
async function findCompanyEmail(firma, website) {
  // 1. Önce kendi sitesi
  if (website) {
    const found = await findRealEmail(website);
    if (found) return found;
  }

  // 2. Genel DuckDuckGo araması
  for (const q of [`${firma} staj başvuru email`, `${firma} İK iletişim kariyer`]) {
    const { urls, emails } = await searchDDG(q);
    const direct = pickBestEmail(emails);
    if (direct) return direct;
    for (const u of urls) {
      const found = await findRealEmail(u);
      if (found) return found;
    }
  }

  // 3. Staj & kariyer portallarında şirketi ara
  for (const portal of STAJ_PORTALS) {
    const { urls, emails } = await searchDDG(`site:${portal} "${firma}" iletişim email staj`);
    const direct = pickBestEmail(emails);
    if (direct) return direct;
    for (const u of urls) {
      const found = await findRealEmail(u);
      if (found) return found;
    }
  }

  return null;
}

// ── POST /staj/research ───────────────────────────────────────────────────────
app.post('/staj/research', async (req, res) => {
  const { alan, count, apiKey, apiProvider } = req.body;
  if (!alan)   return res.status(400).json({ ok: false, error: '"alan" parametresi gerekli.' });
  if (!apiKey) return res.status(400).json({ ok: false, error: 'API anahtarı gerekli.' });

  const n        = Math.min(Math.max(parseInt(count) || 3, 1), 8);
  const provider = apiProvider || 'claude';

  // Claude ve Gemini için: AI web'de arayıp gerçek emaili kendisi bulur
  const promptWithSearch = `Türkiye'de "${alan}" alanında faaliyet gösteren ve üniversite öğrencilerine staj imkânı sunan ${n} gerçek şirketi araştır.

Arama yaparken şu kaynakları kullan:
- Şirketlerin resmi web siteleri (kariyer, ik, iletisim, staj sayfaları)
- kariyer.net, yenibiris.com, secretcv.com, linkedin.com, staj.com.tr, stajyer.com, kampuskariyeri.com gibi Türk staj ve kariyer portalları
- Google/web araması: "[şirket adı] staj başvuru email", "[şirket adı] İK iletişim"

Her şirket için gerçek bir staj veya İK e-posta adresi bul.
E-posta adresi bulamazsan o şirketi listeye ALMA. Kesinlikle e-posta UYDURMA.

SADECE geçerli JSON döndür, başka hiçbir metin ekleme:
[
  {
    "firma": "Şirket Adı A.Ş.",
    "unvan": "İnsan Kaynakları",
    "email": "gercek@sirket.com.tr",
    "alan": "${alan}",
    "not": "Neden uygun — 1 cümle"
  }
]`;

  // OpenAI için: önce şirket listesi al, sonra sunucu tarafında email ara
  const promptNamesOnly = `Türkiye'de "${alan}" alanında faaliyet gösteren ve üniversite öğrencilerine staj imkânı sunabilecek ${n} gerçek şirketi listele. Her biri için resmi web sitesi URL'sini ver.

SADECE geçerli JSON döndür:
[
  {
    "firma": "Şirket Adı A.Ş.",
    "unvan": "İnsan Kaynakları",
    "website": "https://www.sirket.com.tr",
    "alan": "${alan}",
    "not": "Neden uygun — 1 cümle"
  }
]`;

  try {
    let raw = '';

    if (provider === 'claude') {
      // Claude: web_search aracı ile gerçek zamanlı web araması yapar
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model:      'claude-opus-4-6',
          max_tokens: 4096,
          tools:      [{ type: 'web_search_20250305', name: 'web_search', max_uses: n * 3 }],
          messages:   [{ role: 'user', content: promptWithSearch }]
        })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ ok: false, error: e.error?.message || 'Claude API hatası.' });
      }
      const data = await resp.json();
      raw = (data.content || []).map(b => b.text || '').join('');

    } else if (provider === 'gemini') {
      // Gemini: google_search grounding ile gerçek zamanlı Google araması yapar
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptWithSearch }] }],
            tools:    [{ google_search: {} }]
          })
        }
      );
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ ok: false, error: e.error?.message || 'Gemini API hatası.' });
      }
      const data = await resp.json();
      raw = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

    } else if (provider === 'openai') {
      // OpenAI: GPT şirket listesi verir, sunucu tarafında DuckDuckGo + site scraping ile email arar
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model:    'gpt-4o-mini',
          max_tokens: 2048,
          messages: [{ role: 'user', content: promptNamesOnly }]
        })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ ok: false, error: e.error?.message || 'OpenAI API hatası.' });
      }
      const data = await resp.json();
      raw = data.choices?.[0]?.message?.content || '';

      // OpenAI için: AI şirket listesini verdi, şimdi sunucu tarafında email bul
      const match2 = raw.match(/\[[\s\S]*\]/);
      if (!match2) throw new Error('OpenAI geçerli JSON döndürmedi. Ham yanıt: ' + raw.slice(0, 400));
      const aiList = JSON.parse(match2[0]);

      const prospects = [];
      for (const p of aiList) {
        const email = await findCompanyEmail(p.firma, p.website);
        if (email) prospects.push({ firma: p.firma, unvan: p.unvan, email, alan: p.alan, not: p.not });
      }
      return res.json({ ok: true, prospects });

    } else {
      return res.status(400).json({ ok: false, error: 'Geçersiz API sağlayıcısı.' });
    }

    // Claude ve Gemini: AI'ın bulduğu JSON'ı parse et
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('API geçerli JSON döndürmedi. Ham yanıt: ' + raw.slice(0, 400));
    const prospects = JSON.parse(match[0]).filter(p => p.email && p.email.includes('@'));
    res.json({ ok: true, prospects });

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /staj/send ───────────────────────────────────────────────────────────
app.post('/staj/send', async (req, res) => {
  const { smtp, studentEmail, studentName, subject, coverLetter, contactEmail, recipients } = req.body;

  if (!smtp || !smtp.user || !smtp.pass)
    return res.status(400).json({ ok: false, error: 'SMTP bilgileri eksik.' });
  if (!recipients || recipients.length === 0)
    return res.status(400).json({ ok: false, error: 'Alıcı listesi boş.' });
  if (!currentCvPath || !fs.existsSync(currentCvPath))
    return res.status(400).json({ ok: false, error: 'CV dosyası sunucuda bulunamadı. Lütfen tekrar yükleyin.' });

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host:   smtp.host || 'smtpout.secureserver.net',
      port:   parseInt(smtp.port) || 465,
      secure: parseInt(smtp.port) === 465,
      auth:   { user: smtp.user, pass: smtp.pass }
    });
    await transporter.verify();
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'SMTP bağlantısı kurulamadı: ' + e.message });
  }

  const cvBuffer   = fs.readFileSync(currentCvPath);
  const cvFilename = path.basename(currentCvPath).replace(/^\d+-/, '');

  const results = [];

  for (const r of recipients) {
    const body = (coverLetter || '')
      .replace(/\{\{firma\}\}/gi,  r.firma || '')
      .replace(/\{\{unvan\}\}/gi,  r.unvan || '');

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.75;color:#222;max-width:620px;margin:0 auto;padding:28px 24px;">
  <div style="border-left:4px solid #6366f1;padding-left:18px;margin-bottom:22px;">
    <p style="color:#6366f1;margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Staj Başvurusu</p>
    <h2 style="margin:0;font-size:18px;color:#111;">${studentName || ''}</h2>
  </div>
  <div>${body.replace(/\n/g, '<br>')}</div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#555;font-size:13px;">CV dosyam ekte yer almaktadır. Herhangi bir sorunuz için benimle iletişime geçebilirsiniz.</p>
  ${contactEmail ? `<p style="color:#555;font-size:13px;">İletişim: <a href="mailto:${contactEmail.replace(/"/g,'&quot;').replace(/</g,'&lt;')}" style="color:#6366f1;">${contactEmail.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</a></p>` : ''}
  <p style="color:#aaa;font-size:11px;margin-top:18px;">Bu e-posta Ahmet Sami Gül'ün geliştirdiği <strong>Stajinatör2000</strong> platformu ile gönderilmiştir.</p>
</body></html>`;

    try {
      await transporter.sendMail({
        from:        studentName ? `"${studentName}" <${smtp.user}>` : smtp.user,
        replyTo:     studentEmail || smtp.user,
        to:          r.email,
        subject:     subject || `Staj Başvurusu — ${studentName || ''}`,
        html:        htmlBody,
        attachments: [{ filename: cvFilename, content: cvBuffer, contentType: 'application/pdf' }]
      });

      results.push({ email: r.email, ok: true });
      stajHistory.push({
        email: r.email,
        firma: r.firma || '',
        unvan: r.unvan || '',
        alan:  r.alan  || '',
        konu:  subject || '',
        tarih: new Date().toISOString()
      });
    } catch (e) {
      results.push({ email: r.email, ok: false, error: e.message });
    }

    await new Promise(resolve => setTimeout(resolve, 700));
  }

  saveHistory();
  res.json({ ok: true, results });
});

// ── GET /staj/history ─────────────────────────────────────────────────────────
app.get('/staj/history', (req, res) => res.json(stajHistory));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   Stajinatör2000  →  port ${PORT}      ║`);
  console.log(`  ╚══════════════════════════════════════╝`);
  console.log(`\n  Aç: http://localhost:${PORT}/stajinator.html\n`);
});
