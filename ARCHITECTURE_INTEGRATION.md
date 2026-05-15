# Arquitectura del Sistema de Integración Unificado

## 1. Visión General
El objetivo es unificar la comunicación y gestión de datos entre los múltiples paneles administrativos de la plataforma (General, Métricas, Supervisión, Pagos, etc.) mediante una arquitectura modular y escalable. Se busca centralizar la información crítica en tiempo real sin romper la autonomía de cada módulo.

## 2. Principios de Diseño
- **Abstracción de Datos**: Los paneles no deben acceder directamente a la base de datos para datos compartidos; deben usar interfaces definidas.
- **Micro-Módulos (Adapters)**: Cada panel existente funcionará como un proveedor de datos para el sistema central.
- **Sincronización Pasiva**: El sistema de integración no fuerza actualizaciones constantes, sino que "escucha" o "consulta" bajo demanda y cachea resultados para el Dashboard General.
- **Compatibilidad Retroactiva**: No se reescribirá la lógica interna de los paneles existentes a menos que sea necesario para la estandarización.

## 3. Arquitectura Técnica

### 3.1. Estructura de Directorios Propuesta
```
lib/
└── integration/
    ├── core/                  # Interfaces y tipos base
    │   ├── types.ts           # Definiciones de datos unificadas
    │   ├── registry.ts        # Registro de adaptadores disponibles
    │   └── permissions.ts     # Lógica de permisos granular
    ├── adapters/              # Adaptadores específicos por panel
    │   ├── payments.ts        # Adaptador para panel de Pagos
    │   ├── supervision.ts     # Adaptador para Supervisión
    │   ├── metrics.ts         # Adaptador para Métricas
    │   └── ...
    ├── engine/                # Motor de sincronización
    │   ├── sync.ts            # Lógica de agregación y caché
    │   └── diagnostics.ts     # Herramientas de diagnóstico
    └── client/                # Hooks para uso en componentes React
        └── useIntegration.ts  # Hook unificado para consumir datos
```

### 3.2. Modelo de Datos Unificado (Unified Data Model)
El sistema utilizará un esquema estandarizado para intercambiar "Alertas" o "Items de Acción" entre paneles.

```typescript
// Ejemplo de interfaz base
export interface IntegrationItem {
  id: string;
  sourcePanel: 'pagos' | 'supervision' | 'logistica' | 'disputas' | 'general';
  type: 'warning' | 'info' | 'error' | 'success';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timestamp: string;
  actionUrl?: string; // Deep link al panel específico
  metadata?: Record<string, any>;
}
```

### 3.3. Motor de Sincronización (Sync Engine)
El motor de sincronización actuará como un orquestador que:
1.  Recibe peticiones del Dashboard General o Supervisión.
2.  Invoca a los adaptadores registrados en paralelo.
3.  Normaliza las respuestas al formato `IntegrationItem`.
4.  Aplica filtros globales y de permisos.
5.  Retorna una vista unificada.

### 3.4. Seguridad y Permisos
Se implementará una capa de verificación que asegure que el usuario solicitante tenga permisos para ver los datos del panel fuente antes de incluirlos en el reporte unificado.

## 4. Estrategia de Implementación

### Fase 1: Core y Definiciones (Actual)
- Definir interfaces en `lib/integration/core`.
- Crear el registro de adaptadores.

### Fase 2: Adaptadores Piloto y Expansión
- Implementar adaptador de **Pagos** (detectar inconsistencias, pagos offline pendientes).
- Implementar adaptador de **Supervisión** (órdenes con retraso).
- Implementar adaptador de **Logística** (envíos retrasados, problemas de guía).
- Implementar adaptador de **PocketCash** (recargas pendientes).
- Implementar adaptador de **Disputas** (disputas abiertas).
- Implementar adaptador de **Soporte** (tickets sin leer).
- Implementar adaptador de **Retiros** (solicitudes pendientes).
- Implementar adaptador de **Devoluciones** (devoluciones por daño/error).
- Implementar adaptador de **Usuarios** (verificaciones de identidad pendientes).
- Implementar adaptador de **Publicaciones** (nuevas publicaciones recientes).
- Implementar adaptador de **Tienda Estafeta** (guías pendientes de subir).

### Fase 3: Integración en UI
- Crear componente `UnifiedDashboardWidget` para el panel General y Supervisión.
- Implementar búsqueda global y filtrado por panel en el widget.
- Implementar exportación a CSV de alertas unificadas.

### Fase 4: Optimización
- Implementar caché (SWR/TanStack Query) para reducir latencia.
- Agregar diagnósticos y logs.

## 5. Validación y Diagnóstico
Se incluirá una ruta de API `/api/integration/diagnostics` que ejecutará pruebas de conectividad contra todos los adaptadores y reportará tiempos de respuesta y errores de formato.
