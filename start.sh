#!/usr/bin/env bash
# Starts the whole app inside the one Hugging Face container (DEPLOY-002); the Dockerfile's CMD.
#
#   1. weights: if MODEL_REPO is set, download them from that private Hugging Face model repo with
#      HF_TOKEN into MODEL_PATH (fetch_model.py); otherwise use MODEL_PATH as it is (a mounted folder)
#   2. database: alembic upgrade head against DATABASE_URL (the first run creates the tables and the
#      demo users with DEMO_USER_PASSWORD; later runs change nothing)
#   3. FastAPI on 127.0.0.1:8000 (reachable only inside the container), then, once it answers
#      /health, Next on 0.0.0.0:3000
#   4. if either process stops, the other is stopped too and the container exits, so Hugging Face
#      shows the Space as failed instead of serving half an app
#
# Secrets arrive as environment variables by NAME (Space secrets): DATABASE_URL, SESSION_SECRET,
# DEMO_USER_PASSWORD, COOKIE_SECURE, HF_TOKEN, MODEL_REPO. This script never prints their values.
set -euo pipefail

: "${DATABASE_URL:?set the DATABASE_URL secret (postgresql+psycopg://...?sslmode=require)}"
: "${SESSION_SECRET:?set the SESSION_SECRET secret}"

if [ -n "${MODEL_REPO:-}" ]; then
  : "${HF_TOKEN:?set the HF_TOKEN secret (a read-only token) when MODEL_REPO is set}"
  echo "start.sh: downloading the model from $MODEL_REPO"
  python /app/fetch_model.py "$MODEL_REPO" "$MODEL_PATH"
else
  echo "start.sh: MODEL_REPO is not set; using the model folder $MODEL_PATH as it is"
fi

echo "start.sh: alembic upgrade head"
(cd /app/api && alembic upgrade head)

echo "start.sh: starting FastAPI on 127.0.0.1:8000 and the website on 0.0.0.0:3000"
(cd /app/api && exec uvicorn main:app --host 127.0.0.1 --port 8000) &
api=$!
# Loading PyTorch and the model takes a few seconds. The website starts only once FastAPI answers,
# so the first visitors never get "connection refused" from /api.
for _ in $(seq 1 120); do
  kill -0 "$api" 2>/dev/null || { echo "start.sh: FastAPI stopped while starting" >&2; exit 1; }
  python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" \
    2>/dev/null && break
  sleep 1
done
# HOSTNAME is set explicitly: Docker sets it to the container id, and Next's server.js binds to it.
(cd /app/web && API_URL=http://127.0.0.1:8000 HOSTNAME=0.0.0.0 PORT=3000 exec node server.js) &
web=$!

stop_both() { kill "$api" "$web" 2>/dev/null || true; }
trap stop_both TERM INT

# Wait until the first of the two stops (or the container is asked to stop), then stop the other.
set +e
wait -n "$api" "$web"
status=$?
echo "start.sh: a process stopped (exit $status); stopping the container" >&2
stop_both
wait
exit "$status"
