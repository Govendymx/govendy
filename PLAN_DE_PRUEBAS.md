# Plan de Pruebas Integral - Pocket App
Este documento detalla los escenarios de prueba para verificar la operatividad completa de la plataforma Pocket App.

## 1. Autenticación y Sesión
- [ ] **Registro de Usuario Nuevo**: Registrarse con un email nuevo. Verificar correo de bienvenida.
- [ ] **Inicio de Sesión**: Loguearse con credenciales correctas.
- [ ] **Recuperación de Contraseña**: Solicitar reset de password y verificar flujo.
- [ ] **Persistencia de Sesión**: Cerrar pestaña y volver a abrir (debe seguir logueado).
- [ ] **Timeout de Sesión**: Dejar la pestaña inactiva 10 min y verificar que los botones siguen funcionando (prueba del SessionWatcher).

## 2. Panel de Vendedor (Gestión de Publicaciones)
- [ ] **Crear Publicación Simple**: Precio bajo (<$299), envío a cargo del comprador.
- [ ] **Crear Publicación con Envío Gratis**: Precio >$299, verificar que marque "Envío Gratis".
- [ ] **Validación de Precio/Envío**: Intentar poner Envío Gratis en un producto de $50 (Debería bloquear o advertir pérdida).
- [ ] **Edición de Publicación**: Cambiar precio y stock. Verificar reflejo en "Explorar".
- [ ] **Pausar/Eliminar**: Pausar una publicación y verificar que no aparece en búsquedas.

## 3. Interacción (Preguntas y Respuestas)
- [ ] **Realizar Pregunta**: (Como Comprador A) Preguntar en un artículo de Vendedor B.
- [ ] **Notificación de Pregunta**: (Como Vendedor B) Verificar notificación en campana y email.
- [ ] **Responder Pregunta**: (Como Vendedor B) Responder la pregunta.
- [ ] **Notificación de Respuesta**: (Como Comprador A) Verificar notificación de respuesta.
- [ ] **Bloqueo de Palabras**: Intentar enviar datos de contacto (teléfono, email) en preguntas.

## 4. Flujo de Compra (Checkout) - Escenarios Críticos
### A. Compra Estándar
- [ ] **Producto**: Artículo de $150.
- [ ] **Envío**: A cargo del comprador ($99 aprox).
- [ ] **Total**: $150 + $99 = $249.
- [ ] **Pago**: Tarjeta de Crédito (Test).

### B. Compra con Envío Gratis (Vendedor Paga)
- [ ] **Producto**: Artículo de $500.
- [ ] **Envío**: Gratis para el comprador.
- [ ] **Verificación**: El vendedor debe recibir ($500 - Comisión - CostoEnvío).

### C. Compra con Subsidio (Plataforma)
- [ ] **Condición**: Configurar (si aplica) regla de subsidio en admin o usar cupón de envío.
- [ ] **Verificación**: Comprador paga envío $0 o reducido. Vendedor no paga envío completo (la plataforma absorbe).

### D. El "Supremo": Envío Gratis + Cupón + Subsidio
- [ ] **Preparación**:
    1. Publicación de $600 (Envío Gratis mandatorio por precio).
    2. Crear Cupón de Descuento del 10% (`DESC10`).
- [ ] **Flujo**:
    1. Agregar al carrito.
    2. Aplicar cupón `DESC10` -> Nuevo precio $540.
    3. Verificar que Envío sigue siendo Gratis.
- [ ] **Resultado Esperado**:
    - Comprador paga: $540.
    - Vendedor recibe: $540 - Comisión - Envío (si no hay subsidio extra).
    - **Verificar que no haya saldo negativo** para la plataforma si no es intencional.

## 5. Métodos de Pago
- [ ] **Tarjeta Crédito/Débito**: MercadoPago Test Cards.
- [ ] **Pago en OXXO (Offline)**: Generar ficha, verificar redirección correcta y "pendiente de pago".
- [ ] **Pago con Monedero (PocketCash)**:
    1. Tener saldo en wallet.
    2. Pagar compra 100% con saldo.
    3. Verificar descuento inmediato del saldo.
- [ ] **Pago Mixto**: (Si está habilitado) Saldo parcial + Tarjeta.

## 6. Gestión de Pedidos (Post-Venta)
### Lado Vendedor
- [ ] **Nueva Venta**: Verificar notificación y estado "Pendiente de Envío".
- [ ] **Imprimir Etiqueta**: Generar y descargar guía de envío (PDF Estafeta/Paquetexpress).
- [ ] **Marcar Enviado**: Confirmar despacho.

### Lado Comprador
- [ ] **Seguimiento**: Verificar número de guía en "Mis Compras".
- [ ] **Confirmar Recepción**: Botón "Ya lo tengo".
- [ ] **Calificar**: Dejar estrellas y comentario.

## 7. Monedero (PocketCash) y Recargas
- [ ] **Solicitar Recarga Offline**:
    1. Ir a Monedero -> Recargar -> Transferencia/OXXO.
    2. Subir comprobante (imagen o PDF).
- [ ] **Verificación Admin**:
    1. Ir a Admin -> PocketCash.
    2. Ver la solicitud "Pendiente".
    3. **Probar botón "Ver Datos"** (Verificar que abre modal con info de usuario).
    4. Aprobar recarga.
- [ ] **Confirmación Usuario**: Verificar que el saldo se refleje en el perfil del usuario.

## 8. Panel de Administrador (Super Admin)
- [ ] **Dashboard General**: Verificar métricas de ventas y visitas.
- [ ] **Gestión de Usuarios**: Buscar usuario, ver detalles, bloquear/desbloquear.
- [ ] **Gestión de Publicaciones**: Moderar/Eliminar publicación ilegal.
- [ ] **Disputas**:
    1. Crear disputa como Comprador (ej: "llegó roto").
    2. Ver disputa en Admin.
    3. Intervenir en chat de disputa.
    4. Resolver a favor de Comprador (Reembolso) o Vendedor (Liberar dinero).

## 9. Pruebas de Estrés y Bordes
- [ ] **Carrito Múltiple**: Comprar 3 productos de 3 vendedores diferentes en un solo checkout. (Verificar desglose de envíos).
- [ ] **Stock Cero**: Intentar comprar un producto con stock 1 cuando otro usuario ya lo compró (Race condition).
- [ ] **Imágenes Pesadas**: Subir producto con imágenes de 5MB+ (Verificar optimización/carga).

---
**Nota para el Tester**: Si algún paso falla, anotar: URL exacta, paso realizado, y mensaje de error (si hubo). Tomar captura de pantalla si es visual.
