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

// ── Web sitesinden gerçek HR e-postası bul ────────────────────────────────────
async function findRealEmail(websiteUrl) {
  const base = websiteUrl.replace(/\/$/, '');
  const pages = [
    base + '/ik',
    base + '/kariyer',
    base + '/insan-kaynaklari',
    base + '/staj',
    base + '/iletisim',
    base + '/hr',
    base + '/contact',
    base,
  ];

  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const HR_RE    = /ik|hr|kariyer|staj|insan|human|recruit|talent/i;
  const SKIP_RE  = /noreply|no-reply|donotreply|example|test\b|sentry|@sentry/i;

  for (const url of pages) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StajBot/1.0)' }
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const html = await resp.text();
      const all  = [...new Set(html.match(EMAIL_RE) || [])].filter(e => !SKIP_RE.test(e));
      const hr   = all.filter(e => HR_RE.test(e));
      if (hr.length)  return hr[0];
      if (all.length) return all[0];
    } catch (_) {
      clearTimeout(timer);
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

  // AI sadece şirket adı + resmi website döndürür — e-posta uydurmaz
  const prompt = `Türkiye'de "${alan}" alanında faaliyet gösteren ve üniversite öğrencilerine staj imkânı sunabilecek ${n} adet gerçek şirket listele.

Şirketler gerçek ve tanınmış Türk şirketleri ya da çok uluslu şirketlerin Türkiye ofisleri olmalı.
Her şirket için SADECE resmi web sitesi URL'sini ver — e-posta adresi UYDURMA, website alanını boş bırak eğer bilmiyorsan.

SADECE geçerli JSON döndür, başka hiçbir metin ekleme:
[
  {
    "firma": "Şirket Adı A.Ş.",
    "unvan": "İnsan Kaynakları",
    "website": "https://www.sirket.com.tr",
    "alan": "${alan}",
    "not": "Bu şirketin staj programı için neden uygun olduğu — 1 cümle"
  }
]`;

  try {
    let raw = '';

    if (provider === 'claude') {
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
          messages:   [{ role: 'user', content: prompt }]
        })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ ok: false, error: e.error?.message || 'Claude API hatası.' });
      }
      const data = await resp.json();
      raw = (data.content || []).map(b => b.text || '').join('');

    } else if (provider === 'gemini') {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ ok: false, error: e.error?.message || 'Gemini API hatası.' });
      }
      const data = await resp.json();
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model:      'gpt-4o-mini',
          max_tokens: 4096,
          messages:   [{ role: 'user', content: prompt }]
        })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({ ok: false, error: e.error?.message || 'OpenAI API hatası.' });
      }
      const data = await resp.json();
      raw = data.choices?.[0]?.message?.content || '';

    } else {
      return res.status(400).json({ ok: false, error: 'Geçersiz API sağlayıcısı.' });
    }

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('API geçerli JSON döndürmedi. Ham yanıt: ' + raw.slice(0, 400));
    const aiList = JSON.parse(match[0]);

    // Her şirket için web sitesini tara, gerçek e-posta bul
    const prospects = [];
    for (const p of aiList) {
      if (!p.website) continue;
      const email = await findRealEmail(p.website);
      if (email) {
        prospects.push({ firma: p.firma, unvan: p.unvan, email, alan: p.alan, not: p.not });
      }
    }

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
