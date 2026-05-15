import paramiko

HOST = '178.156.251.8'
USER = 'root'

for pwd in ['GoPocket_LiveKit_2024!', 'Tbvkw9fdTvLaMPe4Vwb9']:
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(HOST, username=USER, password=pwd, timeout=10, look_for_keys=False, allow_agent=False)
        print(f'✅ Conectado con password: {pwd}')
        stdin, stdout, stderr = c.exec_command('docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1 && ls /opt/livekit/ 2>&1 && echo VERIFICACION_OK', timeout=30)
        out = stdout.read().decode()
        err = stderr.read().decode()
        print(out or err)
        c.close()
        break
    except Exception as e:
        print(f'❌ Falló con {pwd}: {e}')
