#!/bin/sh
set -e
# Inicializa os diretórios persistentes no volume
mkdir -p /app/data/.auth/baileys
mkdir -p /app/data/storage/media
exec node /app/server.js
