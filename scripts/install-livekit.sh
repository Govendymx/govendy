#!/bin/bash
set -e

DOMAIN="livekit.gopocket.com.mx"
API_KEY="gopocket-livekit"
API_SECRET="7SCiMk0Qb9EOoDeYIpsX1T3cvtUNRVmhrLKAf2Z5J84xu6wB"
SERVER_IP="178.156.251.8"
INSTALL_DIR="/opt/livekit"

echo "========================================"
echo " GoPocket LiveKit Self-Hosted Installer"
echo "========================================"

# 1. Actualizar sistema e instalar Docker
echo "[1/6] Instalando Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker
echo "✅ Docker instalado"

# 2. Crear directorio de instalación
echo "[2/6] Creando directorio $INSTALL_DIR..."
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 3. Crear livekit.yaml
echo "[3/6] Creando configuración de LiveKit..."
cat > livekit.yaml << EOF
port: 7880
log_level: info

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  enable_loopback_candidate: false

keys:
  ${API_KEY}: ${API_SECRET}

redis:
  address: redis:6379

room:
  empty_timeout: 300
  departure_timeout: 20

ingress:
  rtmp_base_url: rtmp://${DOMAIN}/live
EOF

# 4. Crear ingress.yaml
cat > ingress.yaml << EOF
api_key: ${API_KEY}
api_secret: ${API_SECRET}
ws_url: ws://livekit:7880
redis:
  address: redis:6379
http_relay_url: http://livekit:7880
logging:
  level: info
EOF

# 5. Crear Caddyfile (SSL automático)
cat > Caddyfile << EOF
${DOMAIN} {
    reverse_proxy livekit:7880 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
EOF

# 6. Crear docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning

  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    command: --config /etc/livekit.yaml
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    ports:
      - "7880:7880"
      - "7881:7881"
      - "50000-60000:50000-60000/udp"
    depends_on:
      - redis

  ingress:
    image: livekit/ingress:latest
    restart: unless-stopped
    command: --config /etc/ingress.yaml
    volumes:
      - ./ingress.yaml:/etc/ingress.yaml
    ports:
      - "1935:1935"
    depends_on:
      - livekit
      - redis

volumes:
  caddy_data:
  caddy_config:
EOF

echo "✅ Archivos de configuración creados"

# 7. Configurar firewall UFW
echo "[4/6] Configurando firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTPS/QUIC
ufw allow 1935/tcp  # RTMP (OBS)
ufw allow 7881/tcp  # WebRTC TCP
ufw allow 50000:60000/udp  # WebRTC UDP media
echo "y" | ufw enable || true
echo "✅ Firewall configurado"

# 8. Iniciar servicios
echo "[5/6] Iniciando LiveKit stack..."
cd $INSTALL_DIR
docker compose pull
docker compose up -d
echo "✅ Servicios iniciados"

# 9. Verificar
echo "[6/6] Verificando servicios..."
sleep 5
docker compose ps

echo ""
echo "========================================"
echo "  ✅ LiveKit instalado exitosamente!"
echo "========================================"
echo ""
echo "  URL:        wss://${DOMAIN}"
echo "  API_KEY:    ${API_KEY}"
echo "  API_SECRET: ${API_SECRET}"
echo ""
echo "  RTMP para OBS: rtmp://${DOMAIN}/live"
echo ""
echo "  Actualiza estas variables en Vercel:"
echo "  LIVEKIT_URL=${wss://$DOMAIN}"
echo "  LIVEKIT_API_KEY=${API_KEY}"
echo "  LIVEKIT_API_SECRET=${API_SECRET}"
echo "========================================"
