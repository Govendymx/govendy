# Script PowerShell para desplegar a Vercel
# 
# Uso:
#   .\scripts\deploy-vercel.ps1 -Token "tu_token" [-Prod]
#
# O con variable de entorno:
#   $env:VERCEL_TOKEN="tu_token"; .\scripts\deploy-vercel.ps1 [-Prod]

param(
    [Parameter(Mandatory=$false)]
    [string]$Token = $env:VERCEL_TOKEN,
    
    [Parameter(Mandatory=$false)]
    [switch]$Prod
)

if (-not $Token) {
    Write-Host "❌ Error: Se requiere un token de Vercel" -ForegroundColor Red
    Write-Host ""
    Write-Host "Uso:" -ForegroundColor Yellow
    Write-Host "  .\scripts\deploy-vercel.ps1 -Token 'TU_TOKEN' [-Prod]"
    Write-Host ""
    Write-Host "O con variable de entorno:"
    Write-Host "  `$env:VERCEL_TOKEN='TU_TOKEN'; .\scripts\deploy-vercel.ps1 [-Prod]"
    Write-Host ""
    Write-Host "Para obtener tu token:"
    Write-Host "  1. Ve a https://vercel.com/account/tokens" -ForegroundColor Cyan
    Write-Host "  2. Crea un nuevo token"
    Write-Host "  3. Cópialo y úsalo con este script"
    exit 1
}

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: No se encontró package.json. Asegúrate de ejecutar desde la raíz del proyecto." -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Iniciando despliegue a Vercel...`n" -ForegroundColor Green

try {
    # Configurar token
    $env:VERCEL_TOKEN = $Token
    
    # Comando de despliegue
    $mode = if ($Prod) { "PRODUCCIÓN" } else { "Preview" }
    Write-Host "📦 Modo: $mode" -ForegroundColor Cyan
    Write-Host "⏳ Subiendo archivos y construyendo...`n" -ForegroundColor Yellow
    
    # Verificar si vercel CLI está instalado
    $vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
    if (-not $vercelCmd) {
        Write-Host "📦 Instalando Vercel CLI globalmente..." -ForegroundColor Yellow
        npm install -g vercel
    }
    
    # Ejecutar despliegue
    if ($Prod) {
        vercel --prod --yes --token $Token
    } else {
        vercel --yes --token $Token
    }
    
    Write-Host "`n✅ ¡Despliegue completado exitosamente!" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Error durante el despliegue:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
