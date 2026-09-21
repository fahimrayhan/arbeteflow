# CareerAI — AI-Powered Job Platform

CareerAI is a fully browser-based career platform for students and job seekers. It uses AI to enhance resumes, generate cover letters, provide coaching through chat, and track job applications — all without a backend. Every API call goes directly from your browser to the AI provider of your choice.

---

## Features

### Resume Enhancer
Paste your existing resume, set a target role and industry, and the AI rewrites it with stronger action verbs, quantified achievements, ATS-friendly keywords, and cleaner structure. The enhanced version streams in live as the AI writes it. Export as a formatted **PDF** or plain text.

### Cover Letter Generator
Fill in the job title, company, tone, and optional details (job description, background, achievements). The AI generates a personalized, compelling cover letter tailored to the role. Inline editing, copy, and **PDF export** included.

### AI Coach Chat
Three coaching modes in one conversation interface:

| Mode | Purpose |
|---|---|
| **Resume Coach** | Detailed feedback on your CV — gaps, weak language, ATS issues |
| **Career Advisor** | Career pivots, skill planning, salary negotiation, personal branding |
| **Job Critic** | Honest breakdown of job postings — red flags, realistic expectations, interview questions to ask |

Conversations persist per mode. The chat can optionally load your Job Tracker data as memory, so the AI knows your full application pipeline.

### Job Tracker
A Kanban board with six columns: **Bookmarked → Applied → Screening → Interview → Offer → Rejected**. Add, edit, and move applications. Each card stores company, role, location, salary, dates, notes, and a link. Tracker data feeds directly into the AI chat as context.

### Settings
Connect up to four AI providers. Switch models without leaving the app. API keys are stored in `localStorage` only — nothing passes through any third-party server.

---

## AI Providers

| Provider | Models |
|---|---|
| **Anthropic (Claude)** | Claude Opus 5, Claude Sonnet 5, Claude Haiku 4.5 |
| **OpenAI (ChatGPT)** | GPT-4o, GPT-4o Mini, o3, o4 Mini |
| **Google (Gemini)** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |
| **Ollama (Local)** | Llama 3.3, Llama 3.2, Mistral, Gemma 3, Phi-4, Qwen 2.5, DeepSeek R1, custom |

You can run multiple providers simultaneously and switch between them mid-session from the model picker in the chat toolbar.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Language | TypeScript 5.7 |
| Icons | lucide-react |
| Fonts | Instrument Sans · Inter · JetBrains Mono |
| Storage | Browser `localStorage` |
| AI | Direct browser → provider API (SSE streaming) |

No database. No auth server. No backend. Everything runs in the browser.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (or npm / yarn)
- An API key from at least one supported provider — or a local [Ollama](https://ollama.ai) installation

### Install & run

```bash
git clone https://github.com/your-username/careerai.git
cd careerai
pnpm install
pnpm dev
```

Open `http://localhost:8443` in your browser.

### Build for production

```bash
pnpm build
pnpm preview
```

---

## Configuration

All settings are managed in-app via the **Settings** view. No `.env` file is required for standard usage.

| Setting | Description |
|---|---|
| Anthropic API key | Get from [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI API key | Get from [platform.openai.com](https://platform.openai.com/api-keys) |
| Gemini API key | Get from [Google AI Studio](https://aistudio.google.com/app/apikey) — free tier available |
| Ollama base URL | Default: `http://localhost:11434` — run `OLLAMA_ORIGINS=* ollama serve` |

### Vite environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8443` | Dev server port |
| `FIGMA_PUBLIC_URL` | — | Base URL for production assets (set when hosting behind a sub-path) |
| `FIGMA_DEV_SERVER_HOST` | `0.0.0.0` | Dev server bind address |

---

## Project Structure

```
src/
├── App.tsx              # Root shell, sidebar, theme toggle, AppContext
├── index.css            # Tailwind v4 import + dark/light theme tokens
├── main.tsx             # React entry point
├── lib/
│   ├── api.ts           # Multi-provider AI routing + SSE streaming
│   ├── pdf.ts           # Resume & cover letter PDF export
│   ├── storage.ts       # localStorage persistence + migration
│   └── types.ts         # Shared types, provider metadata, model lists
└── views/
    ├── Chat.tsx         # Three-mode AI coaching chat
    ├── CoverLetter.tsx  # Cover letter generator
    ├── Resume.tsx       # Resume enhancer
    ├── Settings.tsx     # API key & model configuration
    └── Tracker.tsx      # Kanban job application tracker
```

---

## Privacy

- **API keys** are stored in `localStorage` and never sent anywhere except the chosen AI provider's official API endpoint.
- **Your data** (job applications, resume text, chat history) lives entirely in the browser. There is no account, no sync, and no analytics unless you configure a Google Analytics ID in `.figma/make/site.json`.
- **Clearing browser storage** removes all data permanently.

---

## Dark / Light Mode

The app ships with a dark theme by default. A toggle in the sidebar (and the mobile top bar) switches to a lime-green light mode. The preference is saved to `localStorage`.

---

## PDF Export

Resume and cover letter views include an **Export PDF** button. Clicking it opens a styled print window and triggers the browser's native "Save as PDF" dialog. The PDF renderer:

- Detects name, contact info, section headers, job entries, and bullet points automatically
- Applies professional typography (Calibri / Arial, 10.5 pt body)
- Highlights section headers in the app's lime-green accent colour
- Formats cover letters with a role/company header block

No third-party PDF library is required — the browser handles rendering.

---

## License

MIT
