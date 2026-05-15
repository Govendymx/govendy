#!/bin/bash

echo "============================================"
echo "LIMPIAR CACHE COMPLETO - Pocket App"
echo "============================================"
echo ""

echo "[1/4] Deteniendo servidor si está corriendo..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "[2/4] Eliminando carpeta .next (cache de Next.js)..."
if [ -d ".next" ]; then
    rm -rf .next
    echo "   ✅ Carpeta .next eliminada"
else
    echo "   ℹ️  Carpeta .next no existe"
fi

echo "[3/4] Eliminando node_modules (opcional)..."
read -p "   ¿Eliminar node_modules? (s/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        echo "   ✅ node_modules eliminado"
    else
        echo "   ℹ️  node_modules no existe"
    fi
else
    echo "   ⏭️  Saltando eliminación de node_modules"
fi

echo "[4/4] Reinstalando dependencias..."
npm install

echo ""
echo "============================================"
echo "✅ CACHE LIMPIADO COMPLETAMENTE"
echo "============================================"
echo ""
echo "Ahora ejecuta: npm run dev"
echo ""
