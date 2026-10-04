# ArbetaFlow

ArbetaFlow is a career workspace for managing resumes and applications, practicing interviews, generating cover letters, and finding Swedish job listings. The React app uses an Express API, MongoDB for user data and model settings, and a Python vector service for job search.

## Features

- Resume editing, PDF text extraction, AI enhancement, and export to a real A4 PDF file (or .txt).
- AI cover letters (optionally informed by a web search about the company), career coaching, and interview practice.
- MongoDB-backed application tracker; saved applications are also used as AI coach context.
- Semantic job search and resume matching against Arbetsförmedlingen listings, with location and "posted within" filters.
- Provider settings for vLLM, Ollama (local or Ollama cloud), OpenAI, and Anthropic. Provider API keys are encrypted at rest.

## Run with Docker Compose

Docker Compose starts MongoDB, the job vector service, and the Express API. The Vite frontend runs on the host.

```sh
docker compose up --build
```

In a second terminal:

```sh
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The API is available at `http://localhost:8787`; MongoDB data and the vector index persist in named Docker volumes.

The default local authentication uses one development user ID and is intended only for a local single-user setup. For a shared or public deployment, replace `requireAuth` with verified session/JWT authentication and configure the frontend `VITE_DEVELOPMENT_USER_ID` per authenticated user. Do not expose the development API publicly.

## AI provider setup

Open **Settings** in the app and select a provider, base URL, model, and (where required) API key. The API stores the active provider configuration in MongoDB and sends AI requests from the server. Provider keys are encrypted (AES-256-GCM) before they are stored and are never returned to the browser. Keep `APP_ENCRYPTION_KEY` (or the `api_data` volume that holds the generated key) together with your backups: without it, saved keys cannot be decrypted and have to be re-entered.

For **Ollama cloud**, choose *Ollama (local or cloud)*, set the base URL to `https://ollama.com`, pick a cloud model, and enter your Ollama API key.

When the API runs in Docker, use `http://host.docker.internal:8000` for a vLLM instance on the host and `http://host.docker.internal:11434` for host Ollama. The Compose file configures the host gateway for this purpose. OpenAI and Anthropic use their respective API base URLs.

Optional Compose variables:

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_NAME` | `Qwen/Qwen2-VL-2B-Instruct` | Initial model config when MongoDB has no saved configuration |
| `MODEL_API_KEY` | `local-dev-secret` | Initial local model credential |
| `APP_ENCRYPTION_KEY` | generated | Secret (16+ characters) used to encrypt provider API keys in MongoDB. If unset, a random key is created in the `api_data` volume |
| `TAVILY_API_KEY` | — | Enables company web research in the cover letter generator ([tavily.com](https://tavily.com)) |
| `EMBEDDING_THREADS` | `2` | CPU threads the job search service may use for embeddings |
| `JOB_TTL_DAYS` | `30` | Job ads older than this are removed from the search index |
| `VITE_API_BASE_URL` | `http://localhost:8787` | API URL used by the browser (set in `frontend/.env`) |
| `VITE_DEVELOPMENT_USER_ID` | `manolis-local-dev` | Development data partition key (set in `frontend/.env`) |

## Company research for cover letters

With `TAVILY_API_KEY` set, the Cover Letter page shows **Research the company on the web**. When it is ticked, the API searches Tavily for the company (what it does, mission, culture, recent news), adds the top snippets to the prompt as untrusted reference data, and lists the sources under the generated letter so you can check any company detail the model used.

- Only the company name is sent to Tavily; your resume is not.
- Only search snippets are used: the server never downloads web pages itself.
- If the search fails or the quota is used up, the letter is still written and the page says research was skipped.

To enable it, put `TAVILY_API_KEY=tvly-...` in a `.env` file next to `docker-compose.yml` (or in `server/.env` when running the API outside Docker) and restart the API.

## Job search service (vector database)

`jobs-service/` is a small FastAPI app that indexes Arbetsförmedlingen ads in an embedded Chroma database. Embeddings come from the int8-quantized ONNX export of `paraphrase-multilingual-MiniLM-L12-v2` (Swedish + English), run on ONNX Runtime with SentencePiece tokenisation. The vectors are the same ones sentence-transformers produces, but the image contains **no PyTorch/CUDA**. The model is baked into the image (`download_model.py`), so containers start offline in a few seconds and the service uses about 0.5 GB of RAM.

- The index fills itself on first start (about a minute). `GET /health` reports `seeding: true` while that runs, and searches return HTTP 503 until it finishes.
- **Sync Ads** in Job Finder fetches fresh listings. Only ads that are new get embedded; ads already in the index just get their timestamp refreshed.
- A long CV is split into overlapping chunks and each chunk is searched, because the embedding model only reads about 128 tokens per input. A job ranks higher when it fits the whole profile, not just one line.
- Ads older than `JOB_TTL_DAYS` are deleted after each sync, so the index stays small.
- Compose caps the service at 2 CPUs / 768 MB RAM and MongoDB's cache at 256 MB.
- To run it outside Docker: `pip install -r requirements.txt`, `python download_model.py`, then `uvicorn api:app --port 8001`.

Upgrading from the PyTorch version: the index moved to a new volume (`jobs_vector_data`) and is rebuilt automatically. The old volume can be removed with `docker volume rm arbeteflow_chroma_jobs_data`.

## Project layout

```
frontend/                 React app (Vite) — its own package.json, node_modules and .env
  src/app/                    App context, navigation, theme
  src/components/ui/      Shared building blocks (PageHeader, Alert, OptionCard, …)
  src/components/{chat,finder,tracker,layout}/
  src/hooks/              useClipboard, usePrimaryResume, useStreamingMessages, useDismiss
  src/lib/api/            Typed API client, one module per backend area, SSE reader
  src/views/              One file per screen
server/                   Express API (src/ in TypeScript)
  app.ts / index.ts       App wiring / startup and graceful shutdown
  lib/                    HttpError + asyncHandler, SSE helper, message helpers
  middleware/             Auth (development) and error handling
  routes/                 One router per resource
  services/               LLM client, prompts, model config, jobs-service client
jobs-service/             Python vector search service
  api.py                  HTTP endpoints
  job_store.py            Chroma store, sync and search
  jobtech.py              Arbetsförmedlingen API client and normalisation
  embeddings.py           ONNX sentence embeddings (no PyTorch)
  download_model.py       Fetches the model files at build time
  config.py               Environment settings
```

## Local API development

To run the Node API outside Docker, copy `server/.env.example` to `server/.env` (it needs at least `MONGODB_URI` and `ALLOW_DEVELOPMENT_AUTH=true`), then run:

```sh
cd server
npm install
npm run dev
```

For Job Finder outside Compose, set `JOBS_SERVICE_URL` to the reachable Python vector service URL (`http://127.0.0.1:8001` when the Compose service is running).

## Data and privacy

Resumes, chat sessions, interviews, applications, and model configuration are stored in MongoDB. Job listing embeddings live in the Python service's Chroma volume. PDF export supports Latin text (including Swedish letters); other scripts and emoji are replaced with "?" in the PDF only. AI prompts and resume content are sent from the API to the provider configured in Settings. Back up the Docker volumes to preserve application data.

## License

MIT
