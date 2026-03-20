#!/bin/sh
# docker-entrypoint.sh
#
# Runs Sequelize migrations against the configured database, then hands off
# to the application server (CMD passed to ENTRYPOINT).
#
# FF-D43: Entrypoint script runs migrations before starting the application server.
#
# Failure behavior:
#   If migrations fail, this script exits non-zero. The container does not
#   start, so Watchtower does not replace the running container. The previous
#   container continues to serve traffic. This is the rollback mechanism
#   described in ADR-007.

set -e

echo "[entrypoint] Running Sequelize migrations..."
npx sequelize-cli db:migrate

echo "[entrypoint] Migrations complete. Starting application..."
exec "$@"
