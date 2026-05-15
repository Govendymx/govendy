# Plan de Pruebas Integral - Pocket App (Formato de Auditoría)

Este documento está diseñado para ser impreso y utilizado por un auditor humano (QA) para verificar el funcionamiento de la plataforma Pocket App. Cada ítem está formulado como una pregunta que debe ser respondida con "SÍ" (aprobado) o "NO" (fallo), permitiendo anotar observaciones específicas de los errores encontrados.

**Instrucciones para el Auditor:**
1. Imprima este documento.
2. Recorra la aplicación siguiendo el orden de las secciones.
3. Marque la casilla correspondiente en la columna "Estado".
4. Si marca "NO", describa detalladamente el error en la columna "Observaciones".
5. Al finalizar, entregue este reporte al equipo de desarrollo.

---

## 1. Experiencia de Usuario y Navegación (Frontend)

| Pregunta de Verificación | Estado | Observaciones / Detalles del Error |
| :--- | :---: | :--- |
| **Inicio (Home):** ¿La página carga completamente en menos de 3 segundos? | ⬜ SÍ <br> ⬜ NO | |
| **Carrusel:** ¿El banner principal se desplaza automáticamente y permite navegar manualmente con las flechas? | ⬜ SÍ <br> ⬜ NO | |
| **Iconos:** ¿Todos los iconos (categorías, envíos, seguridad) se ven nítidos, a color y alineados correctamente? | ⬜ SÍ <br> ⬜ NO | |
| **Búsqueda:** ¿Al buscar un término (ej: "vestido") se muestran resultados relevantes? | ⬜ SÍ <br> ⬜ NO | |
| **Navegación:** ¿El menú de categorías funciona y despliega las subcategorías correctamente? | ⬜ SÍ <br> ⬜ NO | |
| **Responsive:** ¿La página se ve bien ajustada en un dispositivo móvil (sin scroll horizontal indeseado)? | ⬜ SÍ <br> ⬜ NO | |

## 2. Página de Detalle de Producto (Listings)

| Pregunta de Verificación | Estado | Observaciones / Detalles del Error |
| :--- | :---: | :--- |
| **Visualización:** ¿Se ven todas las imágenes del producto en la galería? | ⬜ SÍ <br> ⬜ NO | |
| **Información:** ¿El título, precio y descripción son legibles y correctos? | ⬜ SÍ <br> ⬜ NO | |
| **Variantes:** ¿Si el producto tiene tallas/colores, se pueden seleccionar correctamente? | ⬜ SÍ <br> ⬜ NO | |
| **Carrito:** ¿El botón "Agregar al carrito" añade el producto y muestra confirmación visual? | ⬜ SÍ <br> ⬜ NO | |
| **Productos Relacionados:** ¿Aparece la sección de "Productos Relacionados" (carrusel) debajo de la protección al comprador? | ⬜ SÍ <br> ⬜ NO | |
| **Pagos Seguros:** ¿Se muestran los logos de MercadoPago, OXXO, etc., a color y bien distribuidos? | ⬜ SÍ <br> ⬜ NO | |
| **Protección al Comprador:** ¿La sección de "Compra Protegida" es visible y legible? | ⬜ SÍ <br> ⬜ NO | |

## 3. Flujo de Venta y Creación de Categorías

| Pregunta de Verificación | Estado | Observaciones / Detalles del Error |
| :--- | :---: | :--- |
| **Acceso:** ¿Se puede entrar a la página "/sell" correctamente (login requerido)? | ⬜ SÍ <br> ⬜ NO | |
| **Formulario:** ¿Se pueden llenar todos los campos obligatorios (título, precio, fotos)? | ⬜ SÍ <br> ⬜ NO | |
| **Categoría Existente:** ¿Al escribir una categoría existente, el sistema la sugiere y selecciona? | ⬜ SÍ <br> ⬜ NO | |
| **Categoría Nueva:** ¿Al escribir una categoría NUEVA (ej: "Joyería Artesanal"), el sistema pregunta si deseas crearla? | ⬜ SÍ <br> ⬜ NO | |
| **Sugerencias:** ¿Si escribes algo parecido a una existente, el sistema te sugiere la corrección? | ⬜ SÍ <br> ⬜ NO | |
| **Publicar:** ¿Se puede completar la publicación del producto exitosamente? | ⬜ SÍ <br> ⬜ NO | |

## 4. Panel de Administración (Backoffice)

| Pregunta de Verificación | Estado | Observaciones / Detalles del Error |
| :--- | :---: | :--- |
| **Acceso:** ¿El usuario administrador puede entrar al dashboard ("/admin")? | ⬜ SÍ <br> ⬜ NO | |
| **Menú:** ¿Aparece la nueva opción "Categorías" en el menú superior? | ⬜ SÍ <br> ⬜ NO | |
| **Solicitudes:** ¿En "/admin/categories" se ven las solicitudes de categorías pendientes? | ⬜ SÍ <br> ⬜ NO | |
| **Aprobación:** ¿Se puede APROBAR una categoría y cambia su estado a "Aprobado"? | ⬜ SÍ <br> ⬜ NO | |
| **Rechazo:** ¿Se puede RECHAZAR una categoría y cambia su estado a "Rechazado"? | ⬜ SÍ <br> ⬜ NO | |
| **Logs:** ¿La consola del navegador está limpia de errores (textos rojos) al navegar por el admin? | ⬜ SÍ <br> ⬜ NO | |

## 5. Carrito y Checkout

| Pregunta de Verificación | Estado | Observaciones / Detalles del Error |
| :--- | :---: | :--- |
| **Carrito:** ¿Se ven los productos agregados con su precio correcto? | ⬜ SÍ <br> ⬜ NO | |
| **Totales:** ¿El cálculo del total (precio + envío) es correcto? | ⬜ SÍ <br> ⬜ NO | |
| **Checkout:** ¿Se puede proceder al pago (simulado o real) sin errores bloqueantes? | ⬜ SÍ <br> ⬜ NO | |

## 6. Rendimiento y Seguridad

| Pregunta de Verificación | Estado | Observaciones / Detalles del Error |
| :--- | :---: | :--- |
| **Velocidad:** ¿Las transiciones entre páginas se sienten fluidas? | ⬜ SÍ <br> ⬜ NO | |
| **Imágenes:** ¿Las imágenes cargan progresivamente sin "saltos" bruscos en el diseño? | ⬜ SÍ <br> ⬜ NO | |
| **Sesión:** ¿Si cierras sesión, se redirige correctamente al login/home? | ⬜ SÍ <br> ⬜ NO | |

---

**Firma del Auditor:** __________________________  
**Fecha:** __________________________
