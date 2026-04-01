# Stajinatör2000

Staj başvurularını otomatikleştiren, yapay zeka destekli bir web uygulaması.

CV'nizi yükleyin, staj yapmak istediğiniz alanları seçin — AI sizin için şirket listesi oluştursun ve başvuru e-postalarını otomatik göndersin.

---

## Özellikler

- **AI destekli şirket araştırması** — Claude, Gemini veya ChatGPT kullanarak seçtiğiniz alanlardaki şirketlerin İK iletişim bilgilerini otomatik üretir
- **Kişiselleştirilmiş e-posta** — Her şirkete özel ön yazı gönderir (`{{firma}}` ve `{{unvan}}` placeholder'ları otomatik doldurulur)
- **CV eki** — PDF formatındaki CV'nizi her e-postaya otomatik ekler
- **Gönderim geçmişi** — Kimlere gönderildiğini kayıt altında tutar
- **3 farklı AI sağlayıcısı** — Claude (Anthropic), Gemini (Google) veya ChatGPT (OpenAI) ile çalışır

---

## Gereksinimler

- [Node.js](https://nodejs.org/) (v18 veya üzeri)
- Bir SMTP e-posta hesabı (Gmail, GoDaddy, Outlook vb.)
- Aşağıdakilerden en az bir tanesinin API anahtarı:
  - [Anthropic (Claude)](https://console.anthropic.com/)
  - [Google (Gemini)](https://aistudio.google.com/app/apikey)
  - [OpenAI (ChatGPT)](https://platform.openai.com/api-keys)

---

## Kurulum
## bilgisayarına indirip de çalıştırabilirsiniz, node.js gereklidir
**1. Repoyu klonlayın:**
```bash
git clone https://github.com/ahmet-sami-gul/stajinator2000.git
cd stajinator2000
```

**2. Bağımlılıkları yükleyin:**
```bash
npm install
```

**3. Sunucuyu başlatın:**
```bash
npm start
```

**4. Tarayıcıda açın:**
```
http://localhost:3132/stajinator.html
```

---

## Kullanım

Uygulama 5 adımda çalışır:

### Adım 1 — SMTP & API Ayarları
- E-posta göndermek için kullanacağınız hesabın SMTP bilgilerini girin
- Şirket araştırması için kullanmak istediğiniz AI sağlayıcısını ve API anahtarını seçin

> **SMTP nedir?** E-posta göndermeyi sağlayan protokoldür. Gmail için `smtp.gmail.com:587`, GoDaddy için `smtpout.secureserver.net:465` kullanılır.

### Adım 2 — Başvuru Bilgileri
- Adınızı, e-postanızı ve ön yazınızı girin
- CV'nizi (PDF) yükleyin
- İsteğe bağlı olarak maile eklenecek iletişim e-postanızı girin

### Adım 3 — Alan Seçimi
Staj yapmak istediğiniz alanları seçin (Yazılım, Finans, Mimarlık, Hukuk vb.)

### Adım 4 — Şirket Araştırması
- "Araştır" butonuna tıklayın — AI her alan için şirket listesi oluşturur
- Listeden göndermek istemediklerinizi çıkarabilir, e-posta adreslerini düzenleyebilirsiniz

> ⚠️ AI tarafından üretilen e-posta adresleri doğru olmayabilir. Göndermeden önce kontrol etmeniz önerilir.

### Adım 5 — Gönder
- Önizlemeyi kontrol edin ve "Gönder" butonuna tıklayın

---

## SMTP Ayarları

| Servis | Sunucu | Port |
|--------|--------|------|
| Gmail | `smtp.gmail.com` | `587` |
| Outlook / Hotmail | `smtp-mail.outlook.com` | `587` |
| GoDaddy | `smtpout.secureserver.net` | `465` |
| Yahoo | `smtp.mail.yahoo.com` | `465` |

> **Gmail kullanıcıları:** Google hesabınızda "Uygulama Şifresi" oluşturmanız gerekebilir. [Nasıl yapılır?](https://support.google.com/accounts/answer/185833)

---

## Proje Yapısı

```
stajinator2000/
├── stajinator-server.js   # Backend — Express sunucu, AI araştırma, e-posta gönderimi
├── public/
│   └── stajinator.html    # Frontend — tek sayfalık arayüz
├── cv-uploads/            # Yüklenen CV'ler (otomatik oluşturulur)
├── staj-history.json      # Gönderim geçmişi (otomatik oluşturulur)
└── package.json
```

---

## Teknik Detaylar

| Teknoloji | Kullanım |
|-----------|---------|
| Node.js + Express | Web sunucu |
| Nodemailer | SMTP ile e-posta gönderimi |
| Multer | PDF dosya yükleme |
| Anthropic API | Claude ile şirket araştırması |
| Google Gemini API | Gemini ile şirket araştırması |
| OpenAI API | ChatGPT ile şirket araştırması |

---

## Güvenlik

- API anahtarları ve SMTP şifreleri yalnızca tarayıcı belleğinde tutulur, diske kaydedilmez
- CV dosyaları yalnızca yerel sunucuda (`cv-uploads/`) saklanır
- Uygulama yalnızca yerel ağda (`localhost`) çalışır; internete açık bir sunucuya deploy ederseniz kimlik doğrulama eklemeniz önerilir

---

## Lisans

MIT

---

*Stajinatör2000byahmet-sami-gul*
