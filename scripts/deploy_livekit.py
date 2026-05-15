import paramiko, time

HOST = '178.156.251.8'; USER = 'root'; PASS = 'GoPocket_LiveKit_2024!'

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=15, look_for_keys=False, allow_agent=False)

sftp = c.open_sftp()

def run(cmd, timeout=15):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out if out else err

# Fix: use sh -c for glob expansion inside docker exec
gen_thumbs = r'''#!/bin/bash
# Generate thumbnails from active HLS streams
THUMB_DIR="/opt/livekit/thumbs"
HLS_BASE="http://127.0.0.1:8888/hls"
mkdir -p "$THUMB_DIR"

# Use sh -c to ensure glob expands inside the container
SESSIONS=$(docker exec livekit-rtmp-1 sh -c 'ls /var/hls/*.m3u8 2>/dev/null' | sed 's|/var/hls/||; s|\.m3u8||')

if [ -z "$SESSIONS" ]; then
    find "$THUMB_DIR" -name "*.jpg" -mmin +5 -delete 2>/dev/null
    exit 0
fi

for SID in $SESSIONS; do
    ffmpeg -y -i "${HLS_BASE}/${SID}.m3u8" \
        -vframes 1 -q:v 3 \
        -vf "scale=640:-1" \
        "${THUMB_DIR}/${SID}.jpg" \
        </dev/null 2>/dev/null

    if [ $? -eq 0 ] && [ -f "${THUMB_DIR}/${SID}.jpg" ]; then
        echo "OK: ${SID}.jpg ($(wc -c < "${THUMB_DIR}/${SID}.jpg") bytes)"
    else
        echo "FAIL: ${SID}"
    fi
done

# Clean stale thumbnails
for jpg in "$THUMB_DIR"/*.jpg; do
    [ -f "$jpg" ] || continue
    BASE=$(basename "$jpg" .jpg)
    if ! echo "$SESSIONS" | grep -q "^${BASE}$"; then
        find "$jpg" -mmin +5 -delete 2>/dev/null
    fi
done
'''

print("[1] Writing fixed gen_thumbs.sh...")
with sftp.open('/opt/livekit/gen_thumbs.sh', 'w') as f:
    f.write(gen_thumbs)
print(run('chmod +x /opt/livekit/gen_thumbs.sh'))

# Run it
print("\n[2] Running gen_thumbs.sh...")
result = run('/opt/livekit/gen_thumbs.sh 2>&1', timeout=15)
print(result)

# Check
print("\n[3] Thumbs directory:")
print(run('ls -la /opt/livekit/thumbs/'))

# Test via Caddy
jpg = run('ls /opt/livekit/thumbs/*.jpg 2>/dev/null | head -1')
if jpg:
    fname = jpg.split('/')[-1]
    print(f"\n[4] Caddy test: /thumbs/{fname}")
    print(run(f'curl -sI "https://livekit.gopocket.com.mx/thumbs/{fname}" 2>&1'))
else:
    print("\n[4] Still no thumbnail!")

sftp.close()
c.close()
print("\n=== DONE ===")
