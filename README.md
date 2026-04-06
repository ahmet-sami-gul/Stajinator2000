# Stajinatör2000

Yapay zeka destekli staj başvuru asistanı. Sektör seçiminden toplu e-posta gönderimne kadar tüm süreci otomatikleştirir.

**Geliştirici:** Ahmet Sami Gül · **Araç:** Claude Code (Anthropic) · **Lisans:** MIT

---

## Özellikler

- **Gerçek İK e-posta adresleri** — AI, şirket sitelerini, kariyer.net, linkedin.com ve diğer staj portallarını tarayarak gerçek İK e-postalarını bulur. E-posta bulunamayan şirket listeye girmez, asla uydurma adres kullanılmaz.
- **3 farklı AI sağlayıcısı** — Claude (Anthropic web araması), Gemini (Google araması) veya ChatGPT (DuckDuckGo + site tarama)
- **Kişiselleştirilmiş e-posta** — `{{firma}}` ve `{{unvan}}` her e-postada otomatik doldurulur
- **CV eki** — PDF CV her e-postaya otomatik eklenir
- **Gönderim geçmişi** — Tarayıcıda (localStorage) saklanır
- **Vercel uyumlu** — Sunucusuz (serverless) olarak deploy edilebilir

---

## Hızlı Başlangıç

### Vercel (önerilen)

Repo'yu fork'layın ve [vercel.com](https://vercel.com) üzerinden import edin. Ekstra ayar gerekmez.

### Yerel Çalıştırma

**Gereksinimler:** [Node.js](https://nodejs.org/) v18+

```bash
git clone https://github.com/ahmet-sami-gul/Stajinator2000.git
cd Stajinator2000
npm install
npm start
```

Tarayıcıda açın: `http://localhost:3132/stajinator.html`

---

## Kullanım

### Adım 1 — SMTP & API Ayarları
- E-posta göndereceğiniz hesabın SMTP bilgilerini girin
- AI sağlayıcısını (Claude / Gemini / ChatGPT) ve API anahtarını seçin

> **SMTP:** Gmail → `smtp.gmail.com:587`, GoDaddy → `smtpout.secureserver.net:465`
> **Gmail kullanıcıları:** [Uygulama Şifresi](https://support.google.com/accounts/answer/185833) oluşturmanız gerekebilir.

### Adım 2 — Başvuru Bilgileri
- Ad soyad, kişisel e-posta ve ön yazıyı girin
- İsteğe bağlı: telefon numarası ve LinkedIn profili (e-postada iletişim bilgisi olarak görünür)
- PDF CV'nizi yükleyin

### Adım 3 — Alan Seçimi
Yazılım, Finans, Mimarlık, Hukuk ve daha pek çok sektörden istediğiniz alanları seçin.

### Adım 4 — Şirket Araştırması
"Araştır" butonuna tıklayın — AI her alan için gerçek şirket ve İK e-postalarını bulur. Listeyi düzenleyebilir, istemediğinizi çıkarabilirsiniz.

> ⚠️ Bulunan e-posta adreslerini göndermeden önce doğrulamanız önerilir.

### Adım 5 — Gönder
Önizlemeyi kontrol edin ve "Gönder" butonuna tıklayın. Her şirkete kişiselleştirilmiş e-posta + CV eki, kendi e-posta hesabınızdan gider.

---

## SMTP Referans Tablosu

| Servis | Sunucu | Port |
|--------|--------|------|
| Gmail | `smtp.gmail.com` | `587` |
| Outlook / Hotmail | `smtp-mail.outlook.com` | `587` |
| GoDaddy | `smtpout.secureserver.net` | `465` |
| Yahoo | `smtp.mail.yahoo.com` | `465` |

---

## Proje Yapısı

```
Stajinator2000/
├── stajinator-server.js   # Backend — Express, AI araştırma, e-posta gönderimi
├── public/
│   └── stajinator.html    # Frontend — tek sayfalık arayüz (SPA)
├── vercel.json            # Vercel deploy yapılandırması
└── package.json
```

---

## Teknik Detaylar

| Teknoloji | Kullanım |
|-----------|---------|
| Node.js + Express | Web sunucu |
| Nodemailer | SMTP ile e-posta gönderimi |
| Multer (memory storage) | PDF yükleme — diske yazmaz |
| Anthropic API | Claude + web_search aracı |
| Google Gemini API | Gemini + google_search grounding |
| OpenAI API | GPT-4o-mini + DuckDuckGo + site tarama |
| @vercel/node | Serverless deploy |

---

## Gizlilik ve KVKK

- **SMTP şifresi & API anahtarı** — Yalnızca tarayıcı belleğinde tutulur. Sayfayı kapattığınızda silinir.
- **Kişisel bilgiler (ad soyad, e-posta, telefon, LinkedIn) ve CV** — Sunucuya yüklenirken yalnızca geçici bellekte işlenir, diske yazılmaz.
- **Gönderim geçmişi** — Yalnızca kendi tarayıcınızda (localStorage) saklanır, üçüncü taraflarla paylaşılmaz.
- **E-postalar** — Doğrudan sizin SMTP sunucunuz üzerinden gider. Sistem e-postaları okumaz veya saklamaz.
- **GitHub reposu** — Yalnızca kaynak kodunu içerir; kullanıcı verisi veya şifre bulunmaz.

---

*Stajinatör2000 — Ahmet Sami Gül tarafından Claude Code ile geliştirilmiştir.*
