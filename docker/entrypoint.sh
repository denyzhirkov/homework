#!/bin/sh
# HomeworkCI Entrypoint Script
# Initializes volumes with default content if empty

set -e

# Initialize modules if directory is empty
if [ -z "$(ls -A /app/modules 2>/dev/null)" ]; then
    echo "[Entrypoint] Initializing modules from defaults..."
    cp -r /app/defaults/modules/* /app/modules/
fi

# Initialize pipelines if directory is empty
if [ -z "$(ls -A /app/pipelines 2>/dev/null)" ]; then
    echo "[Entrypoint] Initializing pipelines from defaults..."
    cp -r /app/defaults/pipelines/* /app/pipelines/
fi

# Initialize config if directory is empty
if [ -z "$(ls -A /app/config 2>/dev/null)" ]; then
    echo "[Entrypoint] Initializing config from defaults..."
    cp -r /app/defaults/config/* /app/config/ 2>/dev/null || true
fi

echo "[Entrypoint] Starting HomeworkCI server..."
exec "$@"

