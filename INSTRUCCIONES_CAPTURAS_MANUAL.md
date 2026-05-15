# Instrucciones para Agregar Capturas de Pantalla al Manual

Este documento explica cómo agregar las capturas de pantalla al manual de usuario.

## Ubicación de las Capturas

Las capturas deben guardarse en:
```
public/manual-captures/
```

## Capturas Necesarias

### 1. Inicio y Exploración
- `01-pagina-principal.png` - Página principal con productos destacados
- `02-detalle-producto.png` - Página de detalle de producto

### 2. Publicar y Vender
- `03-formulario-publicacion.png` - Formulario de publicación
- `04-lista-publicaciones.png` - Lista de publicaciones del vendedor
- `05-panel-cupones.png` - Panel de cupones

### 3. Comprar Productos
- `06-boton-carrito.png` - Botón agregar al carrito
- `07-proceso-checkout.png` - Proceso de checkout
- `08-preguntas-producto.png` - Sección de preguntas en producto

### 4. Subastas
- `09-pagina-subasta.png` - Página de subasta con contador

### 5. Gestionar Ventas
- `10-panel-ventas.png` - Panel de ventas con órdenes
- `11-descargar-guia.png` - Botón descargar guía y marcar como enviado
- `12-panel-preguntas.png` - Panel de preguntas recibidas

### 6. Seguimiento de Compras
- `13-panel-compras.png` - Panel de compras con estados
- `14-confirmar-recepcion.png` - Botón confirmar recepción y calificar

### 7. Pagos y Retiros
- `15-panel-pagos.png` - Panel de pagos con resumen
- `16-datos-cobro.png` - Formulario de datos de cobro
- `17-boton-retirar.png` - Botón Retirar a Mercado Pago

### 8. Disputas
- `18-abrir-disputa.png` - Botón abrir disputa y formulario
- `19-chat-disputa.png` - Chat de disputa con countdown de 72h
- `20-disputa-resuelta.png` - Disputa resuelta con banner verde

### 9. Notificaciones
- `21-menu-alertas.png` - Menú con punto rosa parpadeando

### 10. Mi Perfil
- `22-formulario-perfil.png` - Formulario de perfil
- `23-subir-ine.png` - Formulario de subida de INE

### 11. Favoritos
- `24-boton-favoritos.png` - Botón de favoritos en producto

### 12. Reputación
- `25-panel-reputacion.png` - Panel de reputación

## Cómo Agregar las Capturas

1. Toma las capturas de pantalla de cada sección
2. Guárdalas en `public/manual-captures/` con los nombres indicados arriba
3. Actualiza el componente `app/dashboard/ayuda/page.tsx` reemplazando los placeholders:

```tsx
// Antes:
<div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
  <p className="text-xs font-semibold text-gray-500">📸 Captura: [Página principal con productos destacados]</p>
</div>

// Después:
<div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
  <img 
    src="/manual-captures/01-pagina-principal.png" 
    alt="Página principal con productos destacados"
    className="w-full rounded-lg"
  />
</div>
```

## Recomendaciones para las Capturas

- **Formato**: PNG o JPG
- **Tamaño**: Máximo 1920px de ancho
- **Calidad**: Buena resolución pero optimizadas (usar herramientas como TinyPNG)
- **Contenido**: Enfócate en la funcionalidad específica, oculta información sensible
- **Marcas**: Puedes usar flechas o círculos para destacar elementos importantes

## Alternativa: Usar Next.js Image

Si quieres optimización automática, usa el componente `Image` de Next.js:

```tsx
import Image from 'next/image';

<Image
  src="/manual-captures/01-pagina-principal.png"
  alt="Página principal con productos destacados"
  width={800}
  height={600}
  className="rounded-lg"
/>
```
