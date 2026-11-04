# One image for the Hugging Face Docker Space (DEPLOY-002): the Next.js website and the FastAPI app
# together, because a Space runs exactly one container (docker-compose.yml cannot run there).
#
# Built from the BUNDLE folder, not from the repo: deploy/huggingface/bundle.sh copies this file,
# start.sh, fetch_model.py, .dockerignore and only the needed source into a folder outside the repo,
# with the repo's layout (apps/web, services/api, services/model). Hugging Face builds that folder.
#   bash deploy/huggingface/bundle.sh ~/hf-space-mlops
#   docker build -t mlops-hf ~/hf-space-mlops            (what Hugging Face does after a push)
#
# How it fits: internet -> Hugging Face (HTTPS) -> this container: Next on 0.0.0.0:3000 -> FastAPI on
# 127.0.0.1:8000 (+ the CNN) -> Neon PostgreSQL. The weights are downloaded at start (start.sh) from a
# private Hugging Face model repo; the image holds no weights, no dataset and no secret.

# ---------- 1. web stage: build the Next.js standalone site ----------
# The same pinned Node image as apps/web/Dockerfile (never "latest").
FROM node:22.23.3-bookworm-slim AS web

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Lock files first, so Docker caches `npm ci` until they change.
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

# Then the website source (the bundle holds no tests, env files, node_modules or .next).
# next.config.ts sets output: "standalone", which writes .next/standalone/server.js.
COPY apps/web/ ./
RUN npx next build

# ---------- 2. run stage: Python for FastAPI + the Node binary for the site ----------
# Exact tag: Python 3.12.14 on Debian 12 (bookworm), the same Debian as the Node image above, so the
# copied node binary finds the C library it was built for.
FROM python:3.12.14-slim-bookworm AS run

# Hugging Face runs Spaces as uid 1000; create that user and give it a home for the model folder.
RUN useradd --create-home --uid 1000 user
ENV HOME=/home/user \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    MODEL_PATH=/home/user/models

# FastAPI's packages from its own pinned list (torch from the CPU-only index named inside it).
WORKDIR /app/api
COPY services/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# The API code with its migrations, and the CNN / Grad-CAM code beside it: the same files
# services/api/Dockerfile copies (bundle.sh reads that list from services/api/Dockerfile.dockerignore).
COPY services/api/ ./
COPY services/model/ ./

# Node (only the binary) and the built site: server.js + the few node_modules it uses + static files.
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=web /app/.next/standalone /app/web
COPY --from=web /app/.next/static /app/web/.next/static

# The start script and the model download helper.
COPY start.sh fetch_model.py /app/

# Run as the normal user, never root. Only its home folder is writable (the downloaded weights).
USER user

# Hugging Face sends visitors to this port (README.md: app_port: 3000). FastAPI's 8000 is never exposed.
EXPOSE 3000

CMD ["bash", "/app/start.sh"]
