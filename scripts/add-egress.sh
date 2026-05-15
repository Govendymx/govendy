#!/bin/bash
set -e

# ══════════════════════════════════════════════════
# GoPocket — Add LiveKit Egress to existing stack
# Run: ssh root@178.156.251.8 'bash -s' < scripts/add-egress.sh
# ══════════════════════════════════════════════════

INSTALL_DIR="/opt/livekit"
API_KEY="gopocket-livekit"
API_SECRET="7SCiMk0Qb9EOoDeYIpsX1T3cvtUNRVmhrLKAf2Z5J84xu6wB"
DOMAIN="livekit.gopocket.com.mx"

echo "========================================"
echo " GoPocket — Adding Egress Service"
echo "========================================"

cd $INSTALL_DIR

# 1. Create egress.yaml
echo "[1/5] Creating egress.yaml..."
cat > egress.yaml << EOF
api_key: ${API_KEY}
api_secret: ${API_SECRET}
ws_url: ws://livekit:7880
redis:
  address: redis:6379
health_port: 9091
logging:
  level: info
EOF
echo "✅ egress.yaml created"

# 2. Create /tmp/egress directory for HLS segments
echo "[2/5] Creating HLS output directory..."
mkdir -p /tmp/egress
chmod 777 /tmp/egress
echo "✅ /tmp/egress directory created"

# 3. Update docker-compose.yml — add egress service
echo "[3/5] Updating docker-compose.yml..."

# Check if egress service already exists
if grep -q "egress:" docker-compose.yml; then
    echo "⚠️  Egress service already exists in docker-compose.yml, skipping..."
else
    # Insert egress service before 'volumes:' section
    sed -i '/^volumes:/i\
  egress:\
    image: livekit/egress:latest\
    restart: unless-stopped\
    environment:\
      - EGRESS_CONFIG_FILE=/etc/egress.yaml\
    volumes:\
      - ./egress.yaml:/etc/egress.yaml\
      - /tmp/egress:/tmp/egress\
    cap_add:\
      - SYS_ADMIN\
    depends_on:\
      - livekit\
      - redis\
' docker-compose.yml
    echo "✅ Egress service added to docker-compose.yml"
fi

# 4. Update Caddyfile to serve HLS segments
echo "[4/5] Updating Caddyfile to serve HLS segments..."
cat > Caddyfile << EOF
${DOMAIN} {
    # Serve HLS segments from egress output
    handle /hls/* {
        root * /tmp/egress
        file_server
        header Access-Control-Allow-Origin *
        header Access-Control-Allow-Methods "GET, OPTIONS"
        header Access-Control-Allow-Headers "*"
        header Cache-Control "no-cache, no-store, must-revalidate"
    }

    # LiveKit WebSocket + HTTP
    reverse_proxy livekit:7880 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
EOF
echo "✅ Caddyfile updated with HLS serving"

# 5. Pull new image and restart
echo "[5/5] Pulling and starting egress container..."
docker compose pull egress
docker compose up -d
sleep 5

echo ""
echo "========================================"
echo " Verifying all services..."
echo "========================================"
docker compose ps

echo ""
echo "========================================"
echo "  ✅ Egress added successfully!"
echo "========================================"
echo ""
echo "  Egress will convert WebRTC → HLS automatically"
echo "  HLS segments served at: https://${DOMAIN}/hls/"
echo "  Health check: http://localhost:9091/health"
echo "========================================"
