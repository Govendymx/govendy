param(
  [string]$Token = "",
  [string]$ProjectName = "pocket-app",
  [string]$EnvFromFile = ".env.local",
  [string]$NEXT_PUBLIC_SUPABASE_URL = "",
  [string]$NEXT_PUBLIC_SUPABASE_ANON_KEY = "",
  [string]$SUPABASE_URL = "",
  [string]$SUPABASE_SERVICE_ROLE_KEY = ""
)

Write-Host "=== Despliegue directo a Vercel (sin GitHub) ===" -ForegroundColor Cyan

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
  Write-Error "npm no está disponible en esta terminal."
  exit 1
}

try {
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force | Out-Null
} catch {
  Write-Warning "No se pudo ajustar ExecutionPolicy. Continuando..."
}

function Install-VercelCLI {
  if (Get-Command "vercel" -ErrorAction SilentlyContinue) {
    return
  }
  Write-Host "Instalando Vercel CLI global..." -ForegroundColor Yellow
  npm i -g vercel | Out-Null
  if (-not (Get-Command "vercel" -ErrorAction SilentlyContinue)) {
    Write-Error "No se pudo instalar/verificar Vercel CLI."
    exit 1
  }
}

Install-VercelCLI

# 1. Leer variables ANTES de que 'vercel link' sobrescriba el archivo
function Import-EnvFromFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return @{} }
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith("#")) { return }
    $parts = $line.Split("=",2)
    if ($parts.Count -ge 2) {
      $key = $parts[0].Trim()
      $val = $parts[1].Trim()
      # Remove surrounding quotes if present
      if ($val.Length -ge 2 -and (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'")))) {
          $val = $val.Substring(1, $val.Length - 2)
      }
      $map[$key] = $val
    }
  }
  return $map
}

Write-Host "Cargando variables locales desde $EnvFromFile..." -ForegroundColor Yellow
$envMap = Import-EnvFromFile -Path $EnvFromFile
$envMapOriginal = $envMap

if ([string]::IsNullOrWhiteSpace($Token) -and -not [string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
    $Token = $env:VERCEL_TOKEN
    Write-Host "Token tomado de variable de entorno VERCEL_TOKEN." -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($Token) -and $envMap.ContainsKey("VERCEL_TOKEN")) {
    $Token = $envMap["VERCEL_TOKEN"]
    Write-Host "Token encontrado en $EnvFromFile." -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    $BackupEnv = Import-EnvFromFile -Path "RESPALDO_CLAVES.env"
    if ($BackupEnv.ContainsKey("VERCEL_TOKEN")) {
        $Token = $BackupEnv["VERCEL_TOKEN"]
        Write-Host "Token recuperado de RESPALDO_CLAVES.env." -ForegroundColor Green
    }
}

# Logic to determine authentication method
$TokenArgs = @()
if (-not [string]::IsNullOrWhiteSpace($Token)) {
    $TokenArgs = @("--token", $Token)
} else {
    Write-Host "Verificando sesión local de Vercel..." -ForegroundColor Yellow
    # Check if logged in
    Write-Host "Usuario actual: $env:USERNAME"
    vercel whoami 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sesión activa detectada." -ForegroundColor Green
    } else {
        Write-Warning "No se detectó sesión activa."
        $Token = Read-Host "Pega tu Vercel Access Token (o presiona Enter para cancelar)"
        if ([string]::IsNullOrWhiteSpace($Token)) {
            Write-Error "Se requiere iniciar sesión ('vercel login') o un Access Token."
            exit 1
        }
        $TokenArgs = @("--token", $Token)
    }
}

Write-Host "Vinculando proyecto con Vercel..." -ForegroundColor Yellow
# Use Invoke-Expression or direct command with array arguments
# Using array args with call operator & is safer
& vercel link --yes @TokenArgs | Out-Null

$envMapAfterLink = Import-EnvFromFile -Path $EnvFromFile
$missingKeys = @()
foreach ($k in $envMapOriginal.Keys) {
  if (-not $envMapAfterLink.ContainsKey($k)) {
    $missingKeys += $k
  }
}
if ($missingKeys.Count -gt 0) {
  Add-Content -Path $EnvFromFile -Value ""
  foreach ($k in $missingKeys) {
    $v = $envMapOriginal[$k]
    if ($v -match '\s' -or $v -match '"') {
      $safe = $v.Replace('"', '\"')
      Add-Content -Path $EnvFromFile -Value "$k=`"$safe`""
    } else {
      Add-Content -Path $EnvFromFile -Value "$k=$v"
    }
  }
}
$envMap = Import-EnvFromFile -Path $EnvFromFile

Write-Host "Creando despliegue (preview) para inicializar proyecto..." -ForegroundColor Yellow
& vercel --yes --name $ProjectName @TokenArgs | Out-Null

Write-Host "Configurando variables de entorno (Production)..." -ForegroundColor Yellow

# (La función Import-EnvFromFile se movió al inicio)

if ([string]::IsNullOrWhiteSpace($NEXT_PUBLIC_SUPABASE_URL)) {
  if (-not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_URL)) {
    $NEXT_PUBLIC_SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
  } else {
    $NEXT_PUBLIC_SUPABASE_URL = $envMap["NEXT_PUBLIC_SUPABASE_URL"]
  }
}
if ([string]::IsNullOrWhiteSpace($NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  if (-not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    $NEXT_PUBLIC_SUPABASE_ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
  } else {
    $NEXT_PUBLIC_SUPABASE_ANON_KEY = $envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  }
}
if ([string]::IsNullOrWhiteSpace($SUPABASE_URL)) {
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_URL)) {
    $SUPABASE_URL = $env:SUPABASE_URL
  } else {
    $SUPABASE_URL = $envMap["SUPABASE_URL"]
    if ([string]::IsNullOrWhiteSpace($SUPABASE_URL)) {
      $SUPABASE_URL = $NEXT_PUBLIC_SUPABASE_URL
    }
  }
}
if ([string]::IsNullOrWhiteSpace($SUPABASE_SERVICE_ROLE_KEY)) {
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
    $SUPABASE_SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY
  } else {
    $SUPABASE_SERVICE_ROLE_KEY = $envMap["SUPABASE_SERVICE_ROLE_KEY"]
  }
}

function Push-Env {
  param([string]$Name, [string]$Value, [string]$Target)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Warning "Saltando $Name (vacío)"
    return
  }
  # Create temp file to pipe to vercel env add
  # Note: vercel env add expects value from stdin or interactive. 
  # Piping in PowerShell can be tricky with encoding.
  # We use a temp file and Get-Content to pipe cleanly.
  
  $temp = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($temp, $Value)
  
  # Check if env exists first to avoid error? Or just force add?
  # 'vercel env add' prompts for targets. 
  # We use 'vercel env add NAME production' syntax if supported, or pipe answers.
  # Standard syntax: echo value | vercel env add NAME production
  
  # We will try to add to production. 
  # If it exists, it might fail or ask to overwrite. 
  # We'll use --force if available, or just ignore errors.
  
  Get-Content $temp | vercel env add $Name $Target --force @TokenArgs | Out-Null
  
  Remove-Item $temp -Force
}

Write-Host "Validando variables locales..." -ForegroundColor Yellow
& npm run check-env
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$schemaPath = Join-Path $PSScriptRoot "ensure_schema.sql"
if (-not (Test-Path $schemaPath)) {
  Write-Error "No se encontró scripts/ensure_schema.sql"
  exit 1
}

$schemaUrl = $SUPABASE_URL
if ([string]::IsNullOrWhiteSpace($schemaUrl)) {
  $schemaUrl = $NEXT_PUBLIC_SUPABASE_URL
}
if ([string]::IsNullOrWhiteSpace($schemaUrl) -or [string]::IsNullOrWhiteSpace($SUPABASE_SERVICE_ROLE_KEY)) {
  Write-Error "Faltan SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
  exit 1
}

$schemaApplied = $false
$schemaError = ""
try {
  Write-Host "Aplicando ensure_schema.sql..." -ForegroundColor Yellow
  $schemaSql = Get-Content -Raw -Path $schemaPath
  $schemaRpc = ($schemaUrl.TrimEnd('/')) + "/rest/v1/rpc/exec_sql"
  $schemaHeaders = @{
    "Content-Type" = "application/json"
    "apikey" = $SUPABASE_SERVICE_ROLE_KEY
    "Authorization" = "Bearer $SUPABASE_SERVICE_ROLE_KEY"
  }
  $schemaBody = @{ query = $schemaSql } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri $schemaRpc -Headers $schemaHeaders -Body $schemaBody | Out-Null
  $schemaApplied = $true
} catch {
  $schemaError = $_.Exception.Message
}

if (-not $schemaApplied) {
  $psqlConn = $env:SUPABASE_DB_URL
  if ([string]::IsNullOrWhiteSpace($psqlConn)) { $psqlConn = $env:DATABASE_URL }
  if ([string]::IsNullOrWhiteSpace($psqlConn)) { $psqlConn = $envMap["SUPABASE_DB_URL"] }
  if ([string]::IsNullOrWhiteSpace($psqlConn)) { $psqlConn = $envMap["DATABASE_URL"] }
  $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
  if ($psqlPath -and -not [string]::IsNullOrWhiteSpace($psqlConn)) {
    try {
      & $psqlPath.Source $psqlConn -v "ON_ERROR_STOP=1" -f $schemaPath | Out-Null
      $schemaApplied = $true
    } catch {
      $schemaError = $_.Exception.Message
    }
  }
}

if (-not $schemaApplied) {
  Write-Warning "ensure_schema.sql no aplicado: $schemaError"
}

if (Test-Path "scripts/check_db_schema.js") {
  Write-Host "Validando esquema de BD..." -ForegroundColor Yellow
  & node scripts/check_db_schema.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$skipKeys = @("VERCEL_TOKEN", "VERCEL_OIDC_TOKEN")
foreach ($name in $envMap.Keys) {
  if ($skipKeys -contains $name) { continue }
  $val = $envMap[$name]
  if ([string]::IsNullOrWhiteSpace($val)) { continue }
  Push-Env -Name $name -Value $val -Target "production"
  Push-Env -Name $name -Value $val -Target "preview"
}


Write-Host "Desplegando a producción..." -ForegroundColor Yellow
# --prod triggers a production deployment
# --prebuilt uses existing build output? No, usually we want Vercel to build.
# Removing --prebuilt unless we are sure we built locally correctly for Vercel.
# Usually 'vercel --prod' builds on the cloud.
& vercel --prod --yes @TokenArgs

Write-Host "=== Despliegue finalizado ===" -ForegroundColor Green
