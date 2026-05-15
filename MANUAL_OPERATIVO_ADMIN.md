
---

## 5. Seguridad y Monitoreo

### 🛡️ Seguridad (Mapa en Vivo)
**Ruta:** `/admin/seguridad`
- **Función:** Centro de Comando de Seguridad en Tiempo Real.
- **Herramientas:**
  - **Mapa de Usuarios:** Muestra la ubicación GPS precisa de usuarios activos en los últimos 15 minutos.
  - **Alertas de Viaje Imposible:** Detecta si un usuario se "teletransporta" (ej. Login en CDMX y 5 min después en Tijuana).
  - **Monitor de IP:** Rastrea IPs sospechosas o compartidas entre múltiples cuentas.
- **Acciones:**
  - Si detecta fraude, puede bloquear la cuenta inmediatamente.

### 🤖 Auditoría Financiera (AI)
**Ruta:** `/admin/auditoria`
- **Función:** Sistema automático de detección de anomalías.
- **Capacidades:**
  - Escanea la base de datos buscando discrepancias (ej. Usuarios PRO vencidos que siguen activos, Tiendas Oficiales sin banner).
  - Genera un reporte de "Salud del Sistema".
- **Uso:** Ejecutar una vez a la semana para garantizar la integridad de los datos.

---

## 6. Soporte y Comunicación

### 💬 Chat de Soporte
**Ruta:** `/admin/soporte`
- **Función:** Bandeja de entrada de tickets de usuarios.
- **Protocolo:**
  - Responder en menos de 24 horas.
  - Usar plantillas predefinidas para preguntas frecuentes.

### 📢 Avisos y Banners
**Ruta:** `/admin/avisos` | `/admin/banners`
- **Función:** Comunicación masiva.
- **Uso:**
  - **Avisos:** Notificaciones emergentes (ej. "Mantenimiento programado").
  - **Banners:** Carrusel de imágenes en la página principal (Promociones).

---

## 7. Protocolos de Emergencia

### 🚨 Botón de Pánico (Soft Delete)
Si es necesario eliminar un registro por orden legal o seguridad grave:
- El sistema usa **Soft Delete** (Borrado Suave).
- Los datos no se borran físicamente, solo se marcan como `deleted` para mantener el historial forense.

### 🔄 Restauración de Servicio
En caso de caída del sistema o error crítico:
1. Contactar al equipo de Desarrollo (DevOps).
2. No intentar reiniciar servidores manualmente desde este panel.
