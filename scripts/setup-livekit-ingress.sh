#!/bin/bash
# LiveKit Ingress Setup Script for Hetzner Server
# Paste this ENTIRE block into your SSH terminal

set -e

echo "═══════════════════════════════════════════"
echo "   LiveKit Ingress Installer — GoPocket"
echo "═══════════════════════════════════════════"

# ─── 1. Detect API credentials from existing LiveKit config ───────────────────
LIVEKIT_CONFIG_PATH=$(find /etc /opt /home /root -name "livekit.yaml" -maxdepth 6 2>/dev/null | head -1)

if [ -n "$LIVEKIT_CONFIG_PATH" ]; then
    echo "✓ Found LiveKit config at: $LIVEKIT_CONFIG_PATH"
    LK_API_KEY=$(grep -E '^\s*key:' "$LIVEKIT_CONFIG_PATH" 2>/dev/null | head -1 | awk '{print $2}' | tr -d '"')
    LK_API_SECRET=$(grep -E '^\s*secret:' "$LIVEKIT_CONFIG_PATH" 2>/dev/null | head -1 | awk '{print $2}' | tr -d '"')
else
    echo "⚠ No livekit.yaml found. Checking environment..."
    LK_API_KEY="${LIVEKIT_API_KEY:-}"
    LK_API_SECRET="${LIVEKIT_API_SECRET:-}"
fi

if [ -z "$LK_API_KEY" ] || [ -z "$LK_API_SECRET" ]; then
    echo ""
    echo "❌ Could not auto-detect API credentials."
    echo "   Enter them manually:"
    read -rp "   LIVEKIT_API_KEY: " LK_API_KEY
    read -rp "   LIVEKIT_API_SECRET: " LK_API_SECRET
fi

echo "✓ API Key: ${LK_API_KEY:0:8}..."

# ─── 2. Detect LiveKit server URL ─────────────────────────────────────────────
LIVEKIT_WS_URL="ws://localhost:7880"
echo "✓ LiveKit WS URL: $LIVEKIT_WS_URL"

# ─── 3. Install Docker if not present ────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "→ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed: $(docker --version)"
fi

# ─── 4. Pull LiveKit Ingress image ────────────────────────────────────────────
echo "→ Pulling LiveKit Ingress image..."
docker pull livekit/ingress:latest
echo "✓ Image pulled"

# ─── 5. Create config directory and file ──────────────────────────────────────
mkdir -p /etc/livekit-ingress

cat > /etc/livekit-ingress/config.yaml << INGRESS_CONFIG
api_key: ${LK_API_KEY}
api_secret: ${LK_API_SECRET}
ws_url: ${LIVEKIT_WS_URL}
rtmp_port: 1935
http_relay_port: 9090
log_level: info
INGRESS_CONFIG

echo "✓ Config written to /etc/livekit-ingress/config.yaml"

# ─── 6. Create systemd service ────────────────────────────────────────────────
cat > /etc/systemd/system/livekit-ingress.service << 'SERVICE_EOF'
[Unit]
Description=LiveKit Ingress (RTMP → LiveKit bridge)
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop livekit-ingress
ExecStartPre=-/usr/bin/docker rm livekit-ingress
ExecStart=/usr/bin/docker run \
  --name livekit-ingress \
  --network host \
  -v /etc/livekit-ingress/config.yaml:/config.yaml:ro \
  livekit/ingress \
  --config /config.yaml
ExecStop=/usr/bin/docker stop livekit-ingress

[Install]
WantedBy=multi-user.target
SERVICE_EOF

echo "✓ Systemd service created"

# ─── 7. Open RTMP port 1935 ────────────────────────────────────────────────────
ufw allow 1935/tcp comment "LiveKit RTMP Ingress" 2>/dev/null && echo "✓ Port 1935 opened in UFW" || echo "⚠ UFW not active — check Hetzner firewall"

# ─── 8. Enable and start ──────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable livekit-ingress
systemctl start livekit-ingress

sleep 3

echo ""
echo "═══════════════════════════════════════════"
echo "   Installation complete!"
echo "═══════════════════════════════════════════"
systemctl status livekit-ingress --no-pager -l

echo ""
echo "Server IP: $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "RTMP URL for OBS: rtmp://$(curl -s ifconfig.me 2>/dev/null)/live"
echo ""
