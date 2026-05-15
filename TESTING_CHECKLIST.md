# 📋 Checklist de Testing Manual - Pocket App

**Fecha de Test:** _______________  
**Tester:** _______________  
**Versión/Build:** _______________

---

## 🔑 Leyenda
- [ ] = Pendiente de probar
- [x] = Funciona correctamente ✅
- [!] = Error encontrado ❌ (anotar en "Notas")
- [~] = Funciona parcialmente ⚠️

---

## 1. 🏠 PÁGINA PRINCIPAL (Homepage)

### 1.1 Carga Inicial
- [ ] La página carga sin errores en consola
- [ ] El banner principal/carrusel se muestra correctamente
- [ ] Las imágenes del carrusel cargan
- [ ] Los botones de navegación del carrusel funcionan

### 1.2 Tarjetas de Características (Feature Cards)
- [ ] "Envío gratis" - Icono visible, link funciona
- [ ] "Tienda Estafeta" - Icono visible, link funciona
- [ ] "Productos destacados" - Icono visible, link funciona
- [ ] "Subastas" - Icono visible, link funciona
- [ ] "Más vistos" - Icono visible, link funciona
- [ ] "Compra protegida" - Icono visible, link funciona
- [ ] Hover effects funcionan en las tarjetas

### 1.3 Secciones de Productos
- [ ] Sección de productos destacados carga
- [ ] Las imágenes de productos cargan
- [ ] Los precios se muestran correctamente
- [ ] Click en producto lleva al detalle

### 1.4 Footer y Navegación
- [ ] Menú superior visible y funcional
- [ ] Logo clickeable lleva al home
- [ ] Barra de búsqueda visible
- [ ] Iconos de carrito/usuario visibles

**Notas Sección 1:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 2. 🔐 AUTENTICACIÓN

### 2.1 Registro (/register)
- [ ] Formulario de registro carga
- [ ] Validación de email funciona
- [ ] Validación de contraseña funciona
- [ ] Botón de registro responde
- [ ] Mensaje de confirmación aparece
- [ ] Redirección después del registro

### 2.2 Login (/login)
- [ ] Formulario de login carga
- [ ] Campos de email y contraseña funcionan
- [ ] Botón de login responde
- [ ] Error en credenciales muestra mensaje
- [ ] Login exitoso redirige correctamente
- [ ] Link "Olvidé mi contraseña" funciona

### 2.3 Recuperación de Contraseña
- [ ] Página /forgot-password carga
- [ ] Se puede enviar email de recuperación
- [ ] Página /reset-password funciona
- [ ] Se puede cambiar la contraseña

### 2.4 Logout
- [ ] Botón de cerrar sesión funciona
- [ ] Redirige correctamente después de logout
- [ ] Sesión se cierra correctamente

**Notas Sección 2:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 3. 👤 DASHBOARD USUARIO (/dashboard)

### 3.1 Vista General
- [ ] Dashboard carga correctamente
- [ ] Menú lateral visible
- [ ] Estadísticas/resumen se muestran
- [ ] Navegación entre secciones funciona

### 3.2 Perfil (/dashboard/perfil)
- [ ] Datos del usuario se muestran
- [ ] Se puede editar nombre/datos
- [ ] Foto de perfil se puede cambiar
- [ ] Cambios se guardan correctamente

### 3.3 Mis Publicaciones (/dashboard/listings)
- [ ] Lista de publicaciones carga
- [ ] Se pueden ver publicaciones activas
- [ ] Se pueden ver publicaciones pausadas
- [ ] Botón de editar funciona
- [ ] Botón de eliminar/pausar funciona

### 3.4 Mis Compras (/dashboard/compras)
- [ ] Historial de compras carga
- [ ] Detalles de cada compra visibles
- [ ] Estados de pedido correctos
- [ ] Se puede ver tracking de envío

### 3.5 Mis Ventas (/dashboard/ventas)
- [ ] Historial de ventas carga
- [ ] Detalles de cada venta visibles
- [ ] Se puede marcar como enviado
- [ ] Se puede subir número de guía

### 3.6 Monedero (/dashboard/monedero)
- [ ] Balance se muestra
- [ ] Historial de movimientos visible
- [ ] Botón de retiro funciona
- [ ] Historial de retiros visible

### 3.7 Favoritos (/dashboard/favoritos)
- [ ] Lista de favoritos carga
- [ ] Se pueden eliminar favoritos
- [ ] Click lleva al producto

### 3.8 Notificaciones (/dashboard/notificaciones)
- [ ] Lista de notificaciones carga
- [ ] Se pueden marcar como leídas
- [ ] Click lleva al destino correcto

### 3.9 Cupones (/dashboard/coupons)
- [ ] Lista de cupones carga
- [ ] Cupones activos visibles
- [ ] Códigos copiables

### 3.10 Chat (/dashboard/chat)
- [ ] Lista de conversaciones carga
- [ ] Se puede abrir un chat
- [ ] Mensajes cargan correctamente
- [ ] Se pueden enviar mensajes
- [ ] Notificaciones de nuevos mensajes

### 3.11 Preguntas y Respuestas
- [ ] /dashboard/preguntas funciona
- [ ] /dashboard/respuestas funciona
- [ ] Se pueden responder preguntas

### 3.12 Disputas y Devoluciones
- [ ] /dashboard/disputas carga
- [ ] /dashboard/devoluciones carga
- [ ] Se puede crear disputa
- [ ] Se puede solicitar devolución

### 3.13 Reputación (/dashboard/reputacion)
- [ ] Puntuación visible
- [ ] Reseñas recibidas visibles
- [ ] Historial de calificaciones

### 3.14 Ayuda y Soporte
- [ ] /dashboard/ayuda carga
- [ ] /dashboard/soporte funciona
- [ ] Se pueden crear tickets

**Notas Sección 3:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 4. 📦 PUBLICACIONES Y PRODUCTOS

### 4.1 Crear Publicación (/sell)
- [ ] Formulario de venta carga
- [ ] Se pueden subir imágenes
- [ ] Campos obligatorios validan
- [ ] Selector de categoría funciona
- [ ] Selector de condición funciona
- [ ] Precio se puede ingresar
- [ ] Variantes (color/talla) funcionan
- [ ] Vista previa funciona
- [ ] Publicación se crea exitosamente

### 4.2 Editar Publicación
- [ ] Formulario de edición carga
- [ ] Datos existentes se muestran
- [ ] Se pueden modificar campos
- [ ] Cambios se guardan

### 4.3 Ver Publicación (/listings/[id])
- [ ] Página de detalle carga
- [ ] Imágenes del producto visibles
- [ ] Galería/carousel de imágenes funciona
- [ ] Precio visible
- [ ] Descripción visible
- [ ] Selector de variantes funciona (si aplica)
- [ ] Botón "Agregar al carrito" funciona
- [ ] Botón "Comprar ahora" funciona
- [ ] Información del vendedor visible
- [ ] Reseñas del vendedor visibles
- [ ] Preguntas y respuestas visibles
- [ ] Se puede hacer pregunta

### 4.4 Explorar (/explorar)
- [ ] Lista de productos carga
- [ ] Filtros funcionan (categoría, precio, etc.)
- [ ] Ordenamiento funciona
- [ ] Paginación funciona
- [ ] Búsqueda funciona

**Notas Sección 4:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 5. 🛒 CARRITO Y CHECKOUT

### 5.1 Carrito (/cart)
- [ ] Carrito carga correctamente
- [ ] Productos se muestran
- [ ] Cantidades se pueden modificar
- [ ] Se pueden eliminar productos
- [ ] Total se calcula correctamente
- [ ] Botón de checkout funciona

### 5.2 Checkout (/checkout)
- [ ] Página de checkout carga
- [ ] Resumen del pedido visible
- [ ] Dirección de envío se puede agregar
- [ ] Métodos de pago visibles
- [ ] Se puede seleccionar método de pago
- [ ] Cupón de descuento funciona
- [ ] Total final correcto
- [ ] Botón de pagar funciona

### 5.3 Proceso de Pago (/pago)
- [ ] Integración con pasarela de pago
- [ ] Formulario de tarjeta funciona
- [ ] PayPal/MercadoPago funciona
- [ ] Errores se muestran correctamente

### 5.4 Resultados de Compra
- [ ] /compra-exitosa muestra confirmación
- [ ] /compra-pendiente muestra estado
- [ ] /compra-error muestra mensaje de error
- [ ] Emails de confirmación se envían

**Notas Sección 5:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 6. 📬 ENVÍOS - ESTAFETA

### 6.1 Cotización (/estafeta/cotizar)
- [ ] Formulario de cotización carga
- [ ] Se puede ingresar origen
- [ ] Se puede ingresar destino
- [ ] Peso/dimensiones funcionan
- [ ] Cotización se genera
- [ ] Precios se muestran
- [ ] Se puede comprar guía

### 6.2 Tienda Estafeta
- [ ] Listado de servicios
- [ ] Información de zonas
- [ ] Precios actualizados

**Notas Sección 6:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 7. 🎯 SECCIONES ESPECIALES

### 7.1 Subastas (/subastas)
- [ ] Lista de subastas carga
- [ ] Tiempo restante visible
- [ ] Se puede ofertar
- [ ] Historial de ofertas visible

### 7.2 Productos Destacados (/productos-destacados)
- [ ] Lista carga correctamente
- [ ] Productos relevantes

### 7.3 Más Vistos (/mas-vistos)
- [ ] Lista carga correctamente
- [ ] Ordenados por vistas

### 7.4 Envío Gratis (/envio-gratis)
- [ ] Información visible
- [ ] Productos con envío gratis

### 7.5 Compra Protegida (/compra-protegida)
- [ ] Información del programa
- [ ] Pasos claros

**Notas Sección 7:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 8. ⚙️ PANEL DE ADMINISTRACIÓN (/admin)

### 8.1 Acceso
- [ ] Solo admins pueden acceder
- [ ] Dashboard admin carga
- [ ] Menú lateral funciona

### 8.2 Usuarios (/admin/usuarios)
- [ ] Lista de usuarios carga
- [ ] Se pueden buscar usuarios
- [ ] Se puede ver detalle de usuario
- [ ] Se puede activar/desactivar usuario
- [ ] Se pueden modificar permisos

### 8.3 Publicaciones (/admin/listings)
- [ ] Lista de publicaciones carga
- [ ] Se pueden aprobar/rechazar
- [ ] Se pueden eliminar

### 8.4 Banners (/admin/banners)
- [ ] Lista de banners carga
- [ ] Se pueden crear banners
- [ ] Se pueden editar banners
- [ ] Se pueden activar/desactivar

### 8.5 Envíos (/admin/envios)
- [ ] Gestión de guías funciona
- [ ] Estados de envío visibles

### 8.6 Pagos (/admin/pagos)
- [ ] Transacciones visibles
- [ ] Retiros gestionables

### 8.7 Disputas (/admin/disputas)
- [ ] Lista de disputas carga
- [ ] Se pueden resolver

### 8.8 Métricas (/admin/metricas)
- [ ] Dashboard de métricas carga
- [ ] Gráficas visibles
- [ ] Datos correctos

### 8.9 Configuración (/admin/settings)
- [ ] Configuraciones editables
- [ ] Cambios se guardan

**Notas Sección 8:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 9. 📱 RESPONSIVE Y UX

### 9.1 Móvil (< 640px)
- [ ] Homepage responsive
- [ ] Menú hamburguesa funciona
- [ ] Formularios usables
- [ ] Checkout funciona
- [ ] Dashboard navegable

### 9.2 Tablet (640px - 1024px)
- [ ] Layout correcto
- [ ] Navegación funciona
- [ ] Grids de productos correctos

### 9.3 Desktop (> 1024px)
- [ ] Layout completo
- [ ] Sidebar visible donde aplica
- [ ] Hover effects funcionan

### 9.4 Accesibilidad
- [ ] Contraste de colores adecuado
- [ ] Textos legibles
- [ ] Botones con tamaño adecuado
- [ ] Focus visible en formularios

**Notas Sección 9:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 10. ⚡ RENDIMIENTO

- [ ] Tiempo de carga inicial < 3s
- [ ] Imágenes optimizadas
- [ ] No hay memory leaks evidentes
- [ ] Navegación fluida
- [ ] Sin errores en consola del navegador

**Notas Sección 10:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 📝 RESUMEN DE ERRORES ENCONTRADOS

| # | Sección | Descripción del Error | Severidad | Screenshot |
|---|---------|----------------------|-----------|------------|
| 1 |         |                      | Alta/Media/Baja |            |
| 2 |         |                      |           |            |
| 3 |         |                      |           |            |
| 4 |         |                      |           |            |
| 5 |         |                      |           |            |
| 6 |         |                      |           |            |
| 7 |         |                      |           |            |
| 8 |         |                      |           |            |
| 9 |         |                      |           |            |
| 10|         |                      |           |            |

---

## 📊 ESTADÍSTICAS FINALES

- **Total de tests:** ___
- **Pasaron (✅):** ___
- **Fallaron (❌):** ___
- **Parciales (⚠️):** ___
- **Porcentaje de éxito:** ___%

---

## 💡 OBSERVACIONES GENERALES

```
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## ✅ APROBACIÓN

- [ ] **App APROBADA para producción**
- [ ] **App NECESITA correcciones antes de producción**

**Firma del Tester:** _______________  
**Fecha:** _______________
