# ArbetaFlow

ArbetaFlow is a career workspace for managing resumes and applications, practicing interviews, generating cover letters, and finding Swedish job listings. The React app uses an Express API, MongoDB for user data and model settings, and a Python vector service for job search.

## Features

- Resume editing, PDF text extraction, AI enhancement, and PDF export.
- AI cover letters, career coaching, and interview practice.
- MongoDB-backed application tracker; saved applications are also used as AI coach context.
- Semantic job search and resume matching against Arbetsförmedlingen listings.
- Provider settings for vLLM, Ollama, OpenAI, and Anthropic.

## Run with Docker Compose

Docker Compose starts MongoDB, the job vector service, and the Express API. The Vite frontend runs on the host.

```sh
docker compose up --build
```

In a second terminal:

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The API is available at `http://localhost:8787`; MongoDB data and the vector index persist in named Docker volumes.

The default local authentication uses one development user ID and is intended only for a local single-user setup. For a shared or public deployment, replace `requireAuth` with verified session/JWT authentication and configure the frontend `VITE_DEVELOPMENT_USER_ID` per authenticated user. Do not expose the development API publicly.

## AI provider setup

Open **Settings** in the app and select a provider, base URL, model, and (where required) API key. The API stores the active provider configuration in MongoDB and sends AI requests from the server. Provider keys are not returned to the browser.

When the API runs in Docker, use `http://host.docker.internal:8000` for a vLLM instance on the host and `http://host.docker.internal:11434` for host Ollama. The Compose file configures the host gateway for this purpose. OpenAI and Anthropic use their respective API base URLs.

Optional Compose variables:

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_NAME` | `Qwen/Qwen2-VL-2B-Instruct` | Initial model config when MongoDB has no saved configuration |
| `MODEL_API_KEY` | `local-dev-secret` | Initial local model credential |
| `VITE_API_BASE_URL` | `http://localhost:8787` | API URL used by the browser |
| `VITE_DEVELOPMENT_USER_ID` | `manolis-local-dev` | Development data partition key |

## Local API development

To run the Node API outside Docker, configure `server/.env` with at least `MONGODB_URI`, `MODEL_NAME`, and `ALLOW_DEVELOPMENT_AUTH=true`, then run:

```sh
cd server
npm install
npm run dev
```

For Job Finder outside Compose, set `JOBS_SERVICE_URL` to the reachable Python vector service URL.

## Data and privacy

Resumes, chat sessions, interviews, applications, and model configuration are stored in MongoDB. Job listing embeddings live in the Python service's Chroma volume. AI prompts and resume content are sent from the API to the provider configured in Settings. Back up the Docker volumes to preserve application data.

## License

MIT
