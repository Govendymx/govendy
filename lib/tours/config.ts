// Configuración de tours para cada página del dashboard
// Cada página tiene pasos super sencillos que explican las funciones principales

import type { TourStep } from '@/components/PageTour';

type PageTourConfig = {
  [pageId: string]: TourStep[];
};

export const pageTours: PageTourConfig = {
  // Dashboard principal
  dashboard: [
    {
      id: 'welcome',
      target: 'body',
      title: '¡Bienvenido! 👋',
      content: 'Este es tu panel principal. Aquí verás un resumen de todo lo importante.',
      position: 'bottom',
    },
    {
      id: 'charts',
      target: '[data-tour="charts"]',
      title: '📊 Gráficas y desempeño',
      content: 'Vistas de tus artículos, ventas y compras por mes. Todo para llevar un buen control.',
      position: 'bottom',
    },
    {
      id: 'recent-operations',
      target: '[data-tour="recent-operations"]',
      title: '📦 Operaciones Recientes',
      content: 'Mira tus compras y ventas más recientes. Haz clic para ver detalles.',
      position: 'bottom',
    },
    {
      id: 'menu',
      target: '[data-tour="menu"]',
      title: '📋 Menú',
      content: 'Desde aquí accedes a todas las secciones de tu cuenta.',
      position: 'right',
    },
  ],

  // Ventas
  ventas: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Tus Ventas 💰',
      content: 'Aquí verás todas las órdenes que recibiste de tus compradores.',
      position: 'bottom',
    },
    {
      id: 'filters',
      target: '[data-tour="filters"]',
      title: 'Filtros',
      content: 'Filtra tus ventas por estado: pendientes, pagadas, enviadas, etc.',
      position: 'bottom',
    },
    {
      id: 'orders',
      target: '[data-tour="orders-list"]',
      title: 'Lista de Ventas',
      content: 'Cada orden muestra el estado, el comprador y el total. Haz clic para ver detalles.',
      position: 'bottom',
    },
  ],

  // Compras
  compras: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Tus Compras 🛒',
      content: 'Aquí verás todas las órdenes que realizaste como comprador.',
      position: 'bottom',
    },
    {
      id: 'filters',
      target: '[data-tour="filters"]',
      title: 'Filtros',
      content: 'Filtra tus compras por estado: pendientes, pagadas, enviadas, etc.',
      position: 'bottom',
    },
    {
      id: 'orders',
      target: '[data-tour="orders-list"]',
      title: 'Lista de Compras',
      content: 'Cada orden muestra el estado, el vendedor y el total. Haz clic para ver detalles.',
      position: 'bottom',
    },
  ],

  // Preguntas
  preguntas: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Preguntas y Respuestas 💬',
      content: 'Aquí verás las preguntas que te hicieron sobre tus productos y las que tú hiciste.',
      position: 'bottom',
    },
    {
      id: 'questions',
      target: '[data-tour="questions-list"]',
      title: 'Lista de Preguntas',
      content: 'Las preguntas están agrupadas por publicación. Responde para ayudar a los compradores.',
      position: 'bottom',
    },
  ],

  // Respuestas
  respuestas: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Respuestas Recibidas ✅',
      content: 'Aquí verás las respuestas que recibiste a tus preguntas.',
      position: 'bottom',
    },
    {
      id: 'responses',
      target: '[data-tour="responses-list"]',
      title: 'Lista de Respuestas',
      content: 'Las respuestas están agrupadas por publicación. Revisa lo que te respondieron.',
      position: 'bottom',
    },
  ],

  // Publicaciones
  listings: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Mis Publicaciones 📦',
      content: 'Aquí gestionas todos tus productos en venta.',
      position: 'bottom',
    },
    {
      id: 'create',
      target: '[data-tour="create-button"]',
      title: 'Crear Publicación',
      content: 'Haz clic aquí para crear un nuevo producto en venta.',
      position: 'bottom',
    },
    {
      id: 'list',
      target: '[data-tour="listings-list"]',
      title: 'Tus Productos',
      content: 'Aquí verás todos tus productos. Puedes editarlos o pausarlos.',
      position: 'bottom',
    },
  ],

  // Perfil
  perfil: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Tu Perfil 👤',
      content: 'Aquí puedes actualizar tu información personal y configuración.',
      position: 'bottom',
    },
    {
      id: 'personal',
      target: '[data-tour="personal-info"]',
      title: 'Información Personal',
      content: 'Actualiza tu nombre, teléfono y dirección de envío.',
      position: 'bottom',
    },
    {
      id: 'documents',
      target: '[data-tour="documents"]',
      title: 'Documentos',
      content: 'Sube tu INE para poder vender productos en la plataforma.',
      position: 'bottom',
    },
    {
      id: 'payout',
      target: '[data-tour="payout-info"]',
      title: 'Datos de Pago',
      content: 'Configura cómo quieres recibir tus ganancias de las ventas.',
      position: 'bottom',
    },
  ],

  // Pagos
  pagos: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Tus Pagos 💳',
      content: 'Aquí verás el historial de tus pagos y retiros.',
      position: 'bottom',
    },
    {
      id: 'balance',
      target: '[data-tour="balance"]',
      title: 'Balance',
      content: 'Este es tu dinero disponible. Puedes retirarlo cuando quieras.',
      position: 'bottom',
    },
    {
      id: 'history',
      target: '[data-tour="history"]',
      title: 'Historial',
      content: 'Aquí verás todos tus pagos recibidos y retiros realizados.',
      position: 'bottom',
    },
  ],

  // Favoritos
  favoritos: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Tus Favoritos ❤️',
      content: 'Aquí guardas los productos que te gustaron para comprarlos después.',
      position: 'bottom',
    },
    {
      id: 'list',
      target: '[data-tour="favorites-list"]',
      title: 'Lista de Favoritos',
      content: 'Todos tus productos favoritos están aquí. Haz clic para verlos o comprarlos.',
      position: 'bottom',
    },
  ],

  // Reputación
  reputacion: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Tu Reputación ⭐',
      content: 'Aquí verás las calificaciones que recibiste de otros usuarios.',
      position: 'bottom',
    },
    {
      id: 'stats',
      target: '[data-tour="stats"]',
      title: 'Estadísticas',
      content: 'Mira tu calificación promedio y el número de reseñas recibidas.',
      position: 'bottom',
    },
    {
      id: 'reviews',
      target: '[data-tour="reviews"]',
      title: 'Reseñas',
      content: 'Lee lo que otros usuarios dijeron sobre ti después de comprarte.',
      position: 'bottom',
    },
  ],

  // Devoluciones/Disputas
  devoluciones: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Devoluciones y Disputas 🔄',
      content: 'Aquí gestionas las devoluciones y disputas de tus compras o ventas.',
      position: 'bottom',
    },
    {
      id: 'list',
      target: '[data-tour="disputes-list"]',
      title: 'Lista de Disputas',
      content: 'Verás todas las disputas abiertas. Puedes responder y seguir el proceso.',
      position: 'bottom',
    },
  ],

  // Cupones
  coupons: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Cupones de Descuento 🎟️',
      content: 'Crea cupones de descuento para tus productos y atrae más compradores.',
      position: 'bottom',
    },
    {
      id: 'create',
      target: '[data-tour="create-coupon"]',
      title: 'Crear Cupón',
      content: 'Haz clic aquí para crear un nuevo cupón de descuento.',
      position: 'bottom',
    },
    {
      id: 'list',
      target: '[data-tour="coupons-list"]',
      title: 'Tus Cupones',
      content: 'Aquí verás todos tus cupones activos e inactivos.',
      position: 'bottom',
    },
  ],

  // Ayuda
  ayuda: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Centro de Ayuda 🆘',
      content: 'Aquí encontrarás respuestas a las preguntas más frecuentes.',
      position: 'bottom',
    },
    {
      id: 'faq',
      target: '[data-tour="faq-list"]',
      title: 'Preguntas Frecuentes',
      content: 'Busca aquí si tienes dudas sobre cómo comprar o vender.',
      position: 'bottom',
    },
    {
      id: 'contact',
      target: '[data-tour="contact-button"]',
      title: 'Contacto',
      content: 'Si no encuentras lo que buscas, contáctanos directamente.',
      position: 'bottom',
    },
  ],

  // Venta (Nuevo Tutorial Interactivo)
  sell: [
    {
      id: 'welcome',
      target: 'body',
      title: '¡Hola, soy Pocky! 🤖',
      content: 'Soy tu asistente virtual. Sigue mis pasos para publicar tu producto de forma exitosa. Te guiaré en cada sección.',
      position: 'bottom',
    },
    {
      id: 'images',
      target: '[data-tour="images-section"]',
      title: '1. Fotos del Producto 📸',
      content: 'Sube fotos claras y con buena luz. ¡Son lo primero que ven los compradores! Puedes subir varias.',
      position: 'right',
    },
    {
      id: 'title',
      target: '[data-tour="title-input"]',
      title: '2. Título Atractivo 📝',
      content: 'Escribe un título claro que describa bien tu producto (ej: "Vestido Zara Talla M Nuevo").',
      position: 'bottom',
    },
    {
      id: 'gender',
      target: '[data-tour="gender-selector"]',
      title: '3. ¿Para quién es? 👤',
      content: 'Selecciona si es para Mujer, Hombre, Niños, etc. Esto ayuda a que te encuentren más rápido.',
      position: 'bottom',
    },
    {
      id: 'category',
      target: '[data-tour="category-section"]',
      title: '4. Categoría 🏷️',
      content: 'Elige la categoría correcta. Si no la encuentras, ¡puedes proponer una nueva!',
      position: 'bottom',
    },
    {
      id: 'details',
      target: '[data-tour="details-section"]',
      title: '5. Talla y Color 🎨',
      content: 'Indica la talla, el color y la marca. Cuantos más detalles des, menos preguntas recibirás.',
      position: 'bottom',
    },
    {
      id: 'condition',
      target: '[data-tour="condition-section"]',
      title: '6. Estado del Producto ✨',
      content: 'Sé honesto sobre el estado: Nuevo, Usado o Casi Nuevo.',
      position: 'top',
    },
    {
      id: 'description',
      target: '[data-tour="description-section"]',
      title: '7. Descripción ✍️',
      content: 'Cuenta más detalles: medidas, material, defectos (si tiene). ¡Inspira confianza!',
      position: 'top',
    },
    {
      id: 'price',
      target: '[data-tour="price-section"]',
      title: '8. Precio 💲',
      content: 'Define tu precio. Te mostraremos cuánto recibirás después de la comisión.',
      position: 'top',
    },
    {
      id: 'shipping',
      target: '[data-tour="shipping-section"]',
      title: '9. Envío 📦',
      content: 'Configura las dimensiones del paquete para calcular el envío correctamente.',
      position: 'top',
    },
    {
      id: 'publish',
      target: '[data-tour="publish-button"]',
      title: '10. ¡Publicar! 🎉',
      content: 'Revisa todo y dale clic a Publicar. ¡Tu producto estará visible al instante!',
      position: 'top',
    },
  ],

  // Soporte
  soporte: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Soporte al Cliente 💬',
      content: 'Aquí puedes contactar directamente con nuestro equipo de soporte.',
      position: 'bottom',
    },
    {
      id: 'conversations',
      target: '[data-tour="conversations"]',
      title: 'Conversaciones',
      content: 'Verás todas tus conversaciones con soporte. Haz clic para abrir una.',
      position: 'bottom',
    },
    {
      id: 'new',
      target: '[data-tour="new-ticket"]',
      title: 'Nuevo Ticket',
      content: 'Haz clic aquí para crear un nuevo ticket de soporte.',
      position: 'bottom',
    },
  ],
};
