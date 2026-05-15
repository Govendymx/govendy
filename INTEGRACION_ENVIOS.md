# Integración de envíos (T1, Envia, guías y margen)

## Resumen

Puedes conectar envíos con plataformas como **T1 Envíos** (shipping.t1.com / t1envios.com) o **Envia.com** para cotizar, añadir un **margen configurable** y generar guías. En Pocket ya tienes:

- **Margen en envíos**: en **Admin → Configuración** puedes configurar `Margen %` y `Margen fijo (MXN)`. Se aplican sobre el costo base (envío base u opciones de envío). Ej.: si el costo es $170 y pones 10% + $20, el cliente paga 170×1.10 + 20 = $207.
- **Opciones de envío**: en **Admin → Envíos** puedes crear opciones con nombre, costo y días. Esas opciones se usan en checkout; el margen se aplica sobre su `cost`.
- **Guías**: hoy se suben manualmente (Admin logística o vendedor) o vía integración futura.

---

## T1 Envíos (shipping.t1.com / t1envios.com)

- **Qué ofrece**: cotización en tiempo real, varias paqueterías (DHL, FedEx, Estafeta, etc.), generación de guías, seguimiento.
- **Integraciones oficiales**: Tiendanube, Shopify (apps en sus tiendas).
- **API pública**: **no publicada**. Para integración custom (cotizar, guías, usar tus costos en Pocket) hay que contactar a T1:
  - Email: **soporte@t1envios.com**
  - Web: [t1envios.com/contacto](https://t1envios.com/contacto)
  - Chat en la plataforma

**Pasos sugeridos**:

1. Contactar a T1 y solicitar acceso a **API** (cotización + generación de guías).
2. Si te dan endpoint y credenciales, en Pocket se podría:
   - Crear un **servicio de cotización** que llame a T1, reciba el costo (ej. $170), aplique el margen configurable y muestre el precio al usuario.
   - Tras el pago, llamar a **crear envío/guía**, obtener la URL del PDF y guardarla en `orders.shipping_label_url` (ya existe en tu modelo).

---

## Envia.com (alternativa con API pública)

- **API**: [envia.com – Desarrolladores](https://envia.com/es-MX/desarrolladores)  
- **Docs**: [docs.envia.com](https://docs.envia.com) (cotización, etiquetas, operadores, webhooks).
- **Auth**: Bearer token. Sandbox: [ship-test.envia.com](https://ship-test.envia.com); producción: [shipping.envia.com/settings/developers](https://shipping.envia.com/settings/developers).

Si eliges Envia en lugar de (o además de) T1, el flujo sería el mismo: cotizar → aplicar margen → mostrar en checkout; al confirmar compra, crear envío → guardar URL de la guía en la orden.

---

## Cómo usar el margen configurable (sin API aún)

Mientras no tengas T1 o Envia conectados por API:

1. **Opción A – Envío base**: En **Admin → Configuración** defines **Envío base** (ej. $180). Si tienes una cotización de T1 ($170), puedes poner 170 (o 180) y usar **Margen %** y **Margen fijo** para subir el precio al cliente.
2. **Opción B – Opciones de envío**: En **Admin → Envíos** creas opciones (ej. “Estafeta”, “DHL”) con un `cost` que refleje lo que te da T1/Envia (manual o luego por API). El margen se aplica sobre ese `cost` en checkout.

En ambos casos, la **guía** se sigue subiendo manualmente o se generará cuando exista la integración con T1/Envia.

---

## Conectando “la página” (T1) con Pocket

- **Solo usar la web de T1** (sin API): puedes usar el [cotizador T1](https://ayuda.t1envios.com/cotizador/) para ver el costo, anotarlo y configurarlo en **Envío base** o en **Opciones de envío** + margen. Las guías las generas en T1 y las subes en Pocket.
- **Integración real**: hace falta que T1 te dé API. Cuando la tengas, se puede:
  - Cotizar desde Pocket (origen, destino, peso, etc.).
  - Mostrar precios con margen.
  - Generar la guía desde Pocket y guardar el enlace en la orden.

---

## Checklist para integrar T1 o Envia

- [ ] Contactar a T1 (o registrar Envia) y obtener API key / token.
- [ ] Ejecutar `supabase_shipping_markup.sql` si no lo has hecho (columnas de margen en `app_settings`).
- [ ] Configurar **Margen %** y **Margen fijo** en Admin.
- [ ] (Futuro) Implementar cliente API de cotización y de creación de envíos.
- [ ] (Futuro) Conectar creación de guía con `orders.shipping_label_url` y flujo de ventas.

Si quieres, el siguiente paso puede ser esbozar los endpoints de Pocket (cotización y “crear envío”) para cuando tengas las credenciales de T1 o Envia.
