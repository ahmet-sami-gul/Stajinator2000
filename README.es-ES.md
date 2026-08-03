

# Stajinatör2000

Asistente de solicitud de prácticas impulsado por inteligencia artificial. Automatiza todo el proceso, desde la selección del sector hasta el envío masivo de correos electrónicos.

**Desarrollador:** Ahmet Sami Gül · **Herramienta:** Claude Code (Anthropic) · **Licencia:** MIT

---

## Características

- **Direcciones de correo electrónico de RR. HH. reales** — La IA encuentra correos electrónicos reales de recursos humanos escaneando los sitios web de las empresas, kariyer.net, linkedin.com y otras plataformas de prácticas. Las empresas para las que no se encuentra un correo electrónico no se incluyen en la lista; nunca se utilizan direcciones ficticias.
- **3 proveedores de IA diferentes** — Claude (búsqueda web de Anthropic), Gemini (búsqueda de Google) o ChatGPT (DuckDuckGo + escaneo de sitios)
- **Correo electrónico personalizado** — `{{firma}}` y `{{unvan}}` se completan automáticamente en cada correo electrónico
- **Adjunto del CV** — El CV en formato PDF se adjunta automáticamente a cada correo electrónico
- **Historial de envíos** — Se almacena en el navegador (localStorage)
- **Compatible con Vercel** — Puede desplegarse de forma sin servidor (serverless)

---

## Inicio Rápido

### Vercel (recomendado)

Visite https://stajinator2000-u46w.vercel.app/stajinator.html o bifurque el repositorio e importelo a través de [vercel.com](https://vercel.com). No se requiere configuración adicional.

### Ejecución Local

**Requisitos:** [Node.js](https://nodejs.org/) v18+

```bash
git clone https://github.com/ahmet-sami-gul/Stajinator2000.git
cd Stajinator2000
npm install
npm start
```

Abra en el navegador: `http://localhost:3132/stajinator.html`

---

## Uso

### Paso 1 — Configuración SMTP y API
- Ingrese la información SMTP de la cuenta desde la que enviará los correos electrónicos
- Seleccione el proveedor de IA (Claude / Gemini / ChatGPT) y la clave API

> **SMTP:** Gmail → `smtp.gmail.com:587`, GoDaddy → `smtpout.secureserver.net:465`
> **Usuarios de Gmail:** Puede que necesite crear una [Contraseña de Aplicación](https://support.google.com/accounts/answer/185833).

### Paso 2 — Información de la Solicitud
- Ingrese su nombre y apellido, correo electrónico personal y carta de presentación
- Opcional: número de teléfono y perfil de LinkedIn (aparecerá como información de contacto en el correo electrónico)
- Cargue su CV en formato PDF

### Paso 3 — Selección de Campo
Seleccione los campos deseados entre Software, Finanzas, Arquitectura, Derecho y muchos otros sectores.

### Paso 4 — Investigación de Empresas
Haga clic en el botón "Investigar" — La IA encontrará empresas reales y correos electrónicos de RR. HH. para cada campo. Puede editar la lista y eliminar las que no desee.

> ⚠️ Se recomienda verificar las direcciones de correo electrónico encontradas antes de enviarlas.

### Paso 5 — Enviar
Revise la vista previa y haga clic en el botón "Enviar". Cada empresa recibirá un correo electrónico personalizado con el CV adjunto, enviado desde su propia cuenta de correo electrónico.

---

## Tabla de Referencia SMTP

| Servicio | Servidor | Puerto |
|--------|--------|------|
| Gmail | `smtp.gmail.com` | `587` |
| Outlook / Hotmail | `smtp-mail.outlook.com` | `587` |
| GoDaddy | `smtpout.secureserver.net` | `465` |
| Yahoo | `smtp.mail.yahoo.com` | `465` |

---

## Estructura del Proyecto

```
Stajinator2000/
├── stajinator-server.js   # Backend — Express, investigación de IA, envío de correos electrónicos
├── public/
│   └── stajinator.html    # Frontend — interfaz de una sola página (SPA)
├── vercel.json            # Configuración de despliegue en Vercel
└── package.json
```

---

## Detalles Técnicos

| Tecnología | Uso |
|-----------|---------|
| Node.js + Express | Servidor web |
| Nodemailer | Envío de correos electrónicos vía SMTP |
| Multer (memory storage) | Carga de PDF — no escribe en el disco |
| Anthropic API | Claude + herramienta web_search |
| Google Gemini API | Gemini + google_search grounding |
| OpenAI API | GPT-4o-mini + DuckDuckGo + escaneo de sitios |
| @vercel/node | Despliegue serverless |

---

## Privacidad y Protección de Datos

- **Contraseña SMTP y clave API** — Se almacenan únicamente en la memoria del navegador. Se eliminan al cerrar la página.
- **Información personal (nombre y apellido, correo electrónico, teléfono, LinkedIn) y CV** — Al cargarse en el servidor, solo se procesan en la memoria temporal; no se escriben en el disco.
- **Historial de envíos** — Se almacena únicamente en su propio navegador (localStorage) y no se comparte con terceros.
- **Correos electrónicos** — Se envían directamente a través de su servidor SMTP. El sistema no lee ni almacena los correos.
- **Repositorio de GitHub** — Contiene solo el código fuente; no incluye datos de usuario ni contraseñas.

---

*Stajinatör2000 — Desarrollado por Ahmet Sami Gül con Claude Code.*
