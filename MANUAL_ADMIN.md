# Manual de Operaciones: Panel de Administrador GoPocket

Este documento sirve como guía de capacitación para nuevos empleados y referencia para el equipo actual. Describe cada sección del Panel de Administrador, su propósito, la información que contiene y las acciones disponibles.

---

## 1. Dashboard y Análisis (Visión General)

Esta sección está diseñada para directivos y gerentes que necesitan ver el estado general del negocio en tiempo real.

### 🏠 Inicio (`/admin`)
*   **¿Para qué sirve?**: Es la pantalla de bienvenida. Muestra un resumen rápido de las alertas más urgentes (órdenes pendientes, disputas nuevas, retiros solicitados).
*   **Acciones clave**: Navegación rápida a tareas pendientes.

### 📊 Métricas (`/admin/metricas`)
*   **¿Para qué sirve?**: Analizar la salud financiera y operativa de la plataforma.
*   **Información visible (Tablas/Gráficas)**:
    *   **Usuarios Conectados**: Cuántas personas están usando la app ahora mismo.
    *   **Ganancias del Mes**: Dinero neto que gana la plataforma (comisiones + promos).
    *   **Ventas Brutas**: Valor total de mercancía vendida.
    *   **Desglose de Envíos**: Cuánto se cobra vs. cuánto se paga por guías.
*   **Uso común**: Revisar al cierre de mes o semana para ver rentabilidad.

### 👁️ Supervisión (`/admin/supervision`)
*   **¿Para qué sirve?**: Es la "Torre de Control". Permite ver todas las operaciones (compras/ventas) en tiempo real para detectar problemas.
*   **Tabla de Operaciones**:
    *   **ID**: Identificador único de la orden.
    *   **Estado**: Si está pagada, enviada, entregada o cancelada.
    *   **Comprador/Vendedor**: Quiénes participan.
    *   **Monto**: Valor de la transacción.
    *   **Disputa**: Icono de alerta si hay un problema reportado.
*   **Acciones**: Ver detalles de una orden, intervenir en chats, forzar actualizaciones de estado.

### 🛡️ Seguridad (`/admin/seguridad`)
*   **¿Para qué sirve?**: Monitoreo de accesos sospechosos y actividad de empleados.
*   **Información**: Historial de inicios de sesión, intentos fallidos y acciones críticas realizadas por otros administradores.

---

## 2. Operaciones (El "Motor" Diario)

Aquí es donde trabaja el equipo de soporte, finanzas y logística.

### 💰 Pagos (`/admin/pagos`)
*   **¿Para qué sirve?**: Control de entradas de dinero.
*   **Tabla de Pagos**: Muestra cada pago recibido de clientes (Tarjeta, OXXO, Transferencia).
*   **Uso común**: Verificar si un pago de OXXO ya se reflejó o buscar un pago por ID de referencia.

### 👛 PocketCash (`/admin/pocketcash`)
*   **¿Para qué sirve?**: Gestión del saldo en monederos virtuales de los usuarios.
*   **Tabla de Recargas**:
    *   **Usuario**: Quién solicitó recarga.
    *   **Monto**: Cuánto dinero real transfirió.
    *   **Comprobante**: Foto de la transferencia (para validación manual).
    *   **Estado**: Pendiente, Aprobado, Rechazado.
*   **Acciones**: Aprobar recargas manuales (importante verificar el comprobante bancario antes de dar clic en Aprobar).

### 🏦 Retiros (`/admin/retiros`)
*   **¿Para qué sirve?**: Gestión de salidas de dinero (cuando un vendedor cobra sus ventas).
*   **Tabla de Solicitudes**:
    *   **Vendedor**: Quién pide el dinero.
    *   **Banco/CLABE**: A dónde se enviará.
    *   **Monto**: Cantidad a transferir.
*   **Proceso**: El equipo de finanzas revisa esta lista, hace las transferencias bancarias reales y luego marca aquí como "Pagado".

### 🚚 Logística (`/admin/logistica`)
*   **¿Para qué sirve?**: Monitoreo de envíos físicos.
*   **Tabla de Guías**: Lista de guías generadas (Estafeta, FedEx, etc.), estado del rastreo y costos.
*   **Uso común**: Resolver problemas cuando una guía no se genera o un paquete se pierde.

### ⚖️ Disputas (`/admin/disputas`)
*   **¿Para qué sirve?**: Juzgado de la plataforma. Aquí llegan los casos donde Comprador y Vendedor no se ponen de acuerdo (ej. "me llegó roto", "no es lo que pedí").
*   **Tabla de Casos**:
    *   **Orden**: Pedido afectado.
    *   **Motivo**: Razón del reclamo.
    *   **Pruebas**: Fotos/Videos subidos por las partes.
*   **Acciones**: El agente de soporte actúa como juez, revisa pruebas y decide quién recibe el dinero.

### ↩️ Devoluciones (`/admin/devoluciones`)
*   **¿Para qué sirve?**: Seguimiento de paquetes que están regresando al vendedor.
*   **Importante**: Verificar que el vendedor reciba su artículo de vuelta antes de reembolsar al comprador.

### 🎧 Soporte (`/admin/soporte`)
*   **¿Para qué sirve?**: Bandeja de entrada de tickets de ayuda y chats con usuarios.
*   **Función**: Canal directo de comunicación para resolver dudas generales.

### 🎓 Academy (`/admin/academy`)
*   **¿Para qué sirve?**: Gestión de tutoriales y cursos para vendedores.
*   **Acciones**: Subir videos o artículos educativos para enseñar a vender mejor.

---

## 3. Contenido y Usuarios (Gestión de la Comunidad)

### 👥 Usuarios (`/admin/usuarios`)
*   **¿Para qué sirve?**: Directorio general de todos los registrados.
*   **Tabla de Usuarios**: Nombre, correo, teléfono, fecha de registro y estatus (activo/baneado).
*   **Acciones**: Editar datos, bloquear usuarios problemáticos, ver historial.

### 🌟 Usuarios PRO (`/admin/usuarios-pro`)
*   **¿Para qué sirve?**: Gestión de suscriptores de pago (Membresía PRO).
*   **Tabla de Suscriptores**:
    *   **Usuario**: Nombre del cliente VIP.
    *   **Inicio/Fin**: Fechas de vigencia de su membresía.
    *   **Estado**: Activo o Vencido.
*   **Acciones**: Se puede extender manualmente la membresía o cancelar suscripciones.

### 🛍️ Tiendas Oficiales (`/admin/tiendas-oficiales`)
*   **¿Para qué sirve?**: Gestión de marcas verificadas o tiendas especiales.
*   **Tabla de Tiendas**:
    *   **Nombre de Tienda**: Nombre comercial.
    *   **Dueño**: Usuario administrador de esa tienda.
    *   **Banner/Color**: Personalización visual.
*   **Acciones**: Crear nuevas tiendas oficiales, editar su apariencia.

### 📑 Publicaciones (`/admin/listings`)
*   **¿Para qué sirve?**: Catálogo de todos los productos en venta.
*   **Tabla de Productos**: Foto, título, precio, vendedor y estado (activo, pausado, vendido).
*   **Acciones**: Moderación (borrar productos prohibidos o ilegales).

### 🏷️ Categorías (`/admin/categories`)
*   **¿Para qué sirve?**: Árbol de clasificación de productos (Ropa, Tecnología, etc.).
*   **Acciones**: Crear nuevas categorías o reorganizar las existentes.

### 📦 Tienda Estafeta (`/admin/estafeta`)
*   **¿Para qué sirve?**: Configuración específica para la venta de guías prepagadas (si aplica).

---

## 4. Marketing y Comunicación

### 🖼️ Banners (`/admin/banners`)
*   **¿Para qué sirve?**: Controlar las imágenes grandes que salen en la portada de la app/web.
*   **Acciones**: Subir imágenes promocionales para campañas (ej. "Hot Sale", "Navidad").

### 📢 Avisos (`/admin/avisos`)
*   **¿Para qué sirve?**: Barra de notificaciones superior (ej. "Envíos gratis este fin de semana").

### 💬 Mensajes Flotantes (`/admin/mensajes-flotantes`)
*   **¿Para qué sirve?**: Pop-ups o burbujas de chat automáticas para anuncios importantes.

### 📣 Publicidad (`/admin/publicidad`)
*   **¿Para qué sirve?**: Gestión de espacios publicitarios pagados dentro de la app.

### ✉️ Correo (`/admin/correo`)
*   **¿Para qué sirve?**: Herramienta para enviar newsletters o comunicados masivos a usuarios.

---

## 5. Configuración y Control (Técnico/Directivo)

### 📄 Plantillas (`/admin/plantillas`)
*   **¿Para qué sirve?**: Textos predefinidos para correos automáticos (Bienvenida, Recuperar contraseña, etc.).

### 💼 Negocio (`/admin/negocio`)
*   **¿Para qué sirve?**: Configuración de las reglas del juego.
*   **Ajustes clave**:
    *   **Comisiones**: Porcentaje que cobra GoPocket por venta.
    *   **Cashback**: Configurar si se da dinero de vuelta y cuánto.
    *   **Costos de Envío**: Tarifas base de las paqueterías.

### 🤖 Auditoría (`/admin/auditoria`)
*   **¿Para qué sirve?**: Sistema de "Policía Financiera" (IA Centinela).
*   **Función**: Revisa automáticamente que no falte dinero. Compara el saldo de los monederos contra el historial de transacciones.
*   **Tabla de Alertas**: Muestra discrepancias (ej. "Usuario X tiene $500 pero sus ventas suman $400").
*   **Nota**: Es solo lectura. Si aparece algo aquí, requiere investigación inmediata.

### ⚙️ Configuración (`/admin/settings`)
*   **¿Para qué sirve?**: Ajustes técnicos generales (Variables de entorno, conexiones con proveedores como MercadoPago o Estafeta).
*   **Acceso restringido**: Solo personal técnico autorizado debería tocar aquí.
