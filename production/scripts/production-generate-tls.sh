#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TLS_DIR="$ROOT/infrastructure/docker/tls"
PUBLIC_HOST="${PUBLIC_HOST:-172.10.1.58}"
SERVER_DNS="${SERVER_DNS:-server-inno360}"
FORCE="${FORCE:-false}"

mkdir -p "$TLS_DIR"

if [[ "$FORCE" != "true" && -s "$TLS_DIR/ca.crt" && -s "$TLS_DIR/server.crt" && -s "$TLS_DIR/server.key" ]]; then
  echo "tls_material_exists=$TLS_DIR"
  exit 0
fi

rm -f "$TLS_DIR/ca.key" "$TLS_DIR/ca.crt" "$TLS_DIR/ca.srl" \
      "$TLS_DIR/server.key" "$TLS_DIR/server.csr" "$TLS_DIR/server.crt" \
      "$TLS_DIR/server.ext"

openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
  -keyout "$TLS_DIR/ca.key" \
  -out "$TLS_DIR/ca.crt" \
  -subj "/CN=INNO.One Internal CA/O=INNO.One"

openssl req -new -newkey rsa:3072 -sha256 -nodes \
  -keyout "$TLS_DIR/server.key" \
  -out "$TLS_DIR/server.csr" \
  -subj "/CN=$PUBLIC_HOST/O=INNO.One"

cat > "$TLS_DIR/server.ext" <<EOF
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$PUBLIC_HOST,DNS:$SERVER_DNS
EOF

openssl x509 -req -sha256 -days 397 \
  -in "$TLS_DIR/server.csr" \
  -CA "$TLS_DIR/ca.crt" \
  -CAkey "$TLS_DIR/ca.key" \
  -CAcreateserial \
  -out "$TLS_DIR/server.crt" \
  -extfile "$TLS_DIR/server.ext"

chmod 600 "$TLS_DIR/ca.key" "$TLS_DIR/server.key"
chmod 644 "$TLS_DIR/ca.crt" "$TLS_DIR/server.crt"
rm -f "$TLS_DIR/server.csr" "$TLS_DIR/server.ext" "$TLS_DIR/ca.srl"

openssl verify -CAfile "$TLS_DIR/ca.crt" "$TLS_DIR/server.crt"
echo "tls_material_ready=$TLS_DIR"
