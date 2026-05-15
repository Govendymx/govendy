-- 20 Nuevas Plantillas de Descripción para GoPocket

INSERT INTO listing_templates (is_global, is_active, title, description, blocks) VALUES
-- 1. Minimalista (Ropa)
(true, true, 'Minimalista (Ropa)', 'Diseño limpio y directo para prendas de vestir.', '[
  {"type": "heading", "text": "Detalles de la Prenda", "level": 2},
  {"type": "paragraph", "text": "Descripción breve del artículo. Menciona el material y el ajuste."},
  {"type": "bullets", "items": ["Marca: [Tu Marca]", "Talla: [Tu Talla]", "Estado: [Nuevo/Usado]", "Color: [Color Principal]"]},
  {"type": "divider"},
  {"type": "paragraph", "text": "Envío rápido y seguro. ¡Pregunta si tienes dudas!"}
]'::jsonb),

-- 2. Detallada (Electrónica)
(true, true, 'Detallada (Electrónica)', 'Ideal para gadgets, celulares y electrónica.', '[
  {"type": "heading", "text": "Especificaciones Técnicas", "level": 2},
  {"type": "paragraph", "text": "Funciona perfectamente. Incluye cargador y caja original."},
  {"type": "bullets", "items": ["Modelo: [Modelo]", "Capacidad: [GB/RAM]", "Batería: [Estado %]", "Accesorios: [Lista]"]},
  {"type": "callout", "title": "Nota Importante", "body": "Se envía restablecido de fábrica y listo para usar.", "tone": "success"},
  {"type": "heading", "text": "Condición Estética", "level": 3},
  {"type": "paragraph", "text": "Sin rayones en pantalla. Ligeras marcas de uso en los bordes (ver fotos)."}
]'::jsonb),

-- 3. Estilo Boutique
(true, true, 'Estilo Boutique', 'Elegante y chic, perfecto para marcas de diseñador.', '[
  {"type": "heading", "text": "✨ Exclusivo & Chic ✨", "level": 1},
  {"type": "paragraph", "text": "Una pieza única para tu guardarropa. Diseño atemporal y calidad premium."},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto de detalle (tela/logo)", "slot_aspect": "square"},
  {"type": "heading", "text": "Por qué te encantará", "level": 3},
  {"type": "paragraph", "text": "Combínalo con tus accesorios favoritos para un look inolvidable."},
  {"type": "bullets", "items": ["Autenticidad garantizada", "Materiales de alta calidad", "Estado impecable"]}
]'::jsonb),

-- 4. Zapatos y Accesorios
(true, true, 'Zapatos y Sneakers', 'Enfocado en calzado, tenis y sneakers.', '[
  {"type": "heading", "text": "👟 Sneakers / Zapatos", "level": 1},
  {"type": "paragraph", "text": "Par original. Comodidad y estilo en cada paso."},
  {"type": "bullets", "items": ["Talla US: [Número]", "Talla MX: [Número]", "Caja: [Sí/No]", "Condición: [X/10]"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto de la suela", "slot_aspect": "landscape"},
  {"type": "callout", "body": "Se envían con doble caja para protección.", "tone": "neutral"}
]'::jsonb),

-- 5. Vintage / Retro
(true, true, 'Vintage / Retro', 'Para piezas únicas con historia.', '[
  {"type": "heading", "text": "📼 Tesoro Vintage", "level": 1},
  {"type": "paragraph", "text": "Pieza auténtica de la época [80s/90s/00s]. Difícil de encontrar hoy en día."},
  {"type": "divider"},
  {"type": "heading", "text": "Detalles de Época", "level": 3},
  {"type": "bullets", "items": ["Etiqueta original", "Hecho en: [País]", "Material: [Composición]"]},
  {"type": "paragraph", "text": "Ten en cuenta que es una prenda vintage y puede tener carácter único."}
]'::jsonb),

-- 6. Streetwear
(true, true, 'Streetwear Hype', 'Para ropa urbana y marcas de hype.', '[
  {"type": "heading", "text": "🔥 Streetwear Essential", "level": 1},
  {"type": "paragraph", "text": "Eleva tu outfit con esta pieza clave. Sold out en tiendas."},
  {"type": "bullets", "items": ["Fit: [Oversized/Regular]", "Colección: [Temporada]", "Estado: [Deadstock / Usado]"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto del fit / puesto", "slot_aspect": "portrait"},
  {"type": "paragraph", "text": "Envío inmediato. Solo ofertas serias."}
]'::jsonb),

-- 7. Lujo / Alta Gama
(true, true, 'Lujo / Alta Gama', 'Presentación premium para artículos costosos.', '[
  {"type": "heading", "text": "💎 Luxury Collection", "level": 1},
  {"type": "paragraph", "text": "Artículo de lujo 100% auténtico. Mantenido con el máximo cuidado."},
  {"type": "divider"},
  {"type": "heading", "text": "Características", "level": 3},
  {"type": "bullets", "items": ["Marca de Diseñador", "Certificado / Ticket: [Sí/No]", "Incluye Dustbag"]},
  {"type": "paragraph", "text": "Ideal para coleccionistas o para un regalo especial."}
]'::jsonb),

-- 8. Deportivo / Gym
(true, true, 'Deportivo / Gym', 'Para ropa de entrenamiento y accesorios deportivos.', '[
  {"type": "heading", "text": "💪 Modo Bestia Activado", "level": 2},
  {"type": "paragraph", "text": "Ropa técnica diseñada para alto rendimiento. Transpirable y cómoda."},
  {"type": "bullets", "items": ["Tecnología: [Dri-Fit/Climacool/etc]", "Uso recomendado: [Gym/Running/Crossfit]", "Talla: [Talla]"]},
  {"type": "callout", "body": "Lava en frío para mantener la elasticidad.", "tone": "neutral"}
]'::jsonb),

-- 9. Kids / Bebés
(true, true, 'Kids & Bebés', 'Tierno y funcional para los más pequeños.', '[
  {"type": "heading", "text": "🧸 Para tu Pequeñ@", "level": 1},
  {"type": "paragraph", "text": "Ropita suave y cómoda. Poco uso, crecen muy rápido."},
  {"type": "bullets", "items": ["Edad recomendada: [Meses/Años]", "Marca: [Marca]", "Material: [Algodón/Lana]"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto de conjunto", "slot_aspect": "square"},
  {"type": "paragraph", "text": "Limpio y listo para estrenar de nuevo."}
]'::jsonb),

-- 10. Hogar y Decoración
(true, true, 'Hogar y Decoración', 'Para artículos de casa, decor y muebles pequeños.', '[
  {"type": "heading", "text": "🏠 Home Sweet Home", "level": 2},
  {"type": "paragraph", "text": "Dale un toque especial a tu espacio con este artículo."},
  {"type": "heading", "text": "Dimensiones & Material", "level": 3},
  {"type": "bullets", "items": ["Alto: [cm]", "Ancho: [cm]", "Material: [Madera/Cerámica/Vidrio]"]},
  {"type": "callout", "body": "Se empaca con protección extra para evitar daños.", "tone": "success"}
]'::jsonb),

-- 11. Coleccionables
(true, true, 'Coleccionables & Figuras', 'Para figuras, cartas y objetos de colección.', '[
  {"type": "heading", "text": "🏆 Artículo de Colección", "level": 1},
  {"type": "paragraph", "text": "Pieza buscada por coleccionistas. Estado de conservación detallado."},
  {"type": "bullets", "items": ["Serie/Línea: [Nombre]", "Año: [Año]", "Caja: [Maldita/Abierta/Sellada]"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto de detalle / esquina", "slot_aspect": "square"},
  {"type": "paragraph", "text": "Revisa las fotos para ver el estado real."}
]'::jsonb),

-- 12. Libros y Medios
(true, true, 'Libros y Medios', 'Para libros, cómics, vinilos y videojuegos.', '[
  {"type": "heading", "text": "📚 Lectura / Multimedia", "level": 2},
  {"type": "paragraph", "text": "Sinopsis: [Breve descripción o resumen]."},
  {"type": "bullets", "items": ["Título: [Nombre]", "Autor/Artista: [Nombre]", "Edición: [Tapa dura/Bolsillo]", "Idioma: [Español/Inglés]"]},
  {"type": "paragraph", "text": "Páginas limpias, sin anotaciones (o especificar si tiene)."}
]'::jsonb),

-- 13. Belleza y Cuidado
(true, true, 'Belleza y Skincare', 'Para productos de belleza (nuevos).', '[
  {"type": "heading", "text": "💄 Beauty & Glow", "level": 2},
  {"type": "paragraph", "text": "Producto 100% original y nuevo (sellado)."},
  {"type": "bullets", "items": ["Marca: [Marca]", "Tono: [Color]", "Caducidad: [Fecha/Lote]"]},
  {"type": "callout", "title": "Higiene Garantizada", "body": "Nunca abierto ni probado.", "tone": "pink"},
  {"type": "paragraph", "text": "Ideal para completar tu rutina."}
]'::jsonb),

-- 14. Gadgets y Tech
(true, true, 'Tech & Accesorios', 'Accesorios de celular, cables, fundas, etc.', '[
  {"type": "heading", "text": "📱 Accesorio Tech", "level": 2},
  {"type": "paragraph", "text": "Compatible con [iPhone/Android/Laptop]."},
  {"type": "bullets", "items": ["Condición: [Nuevo/Abierto]", "Color: [Color]", "Funcionalidad: 100%"]},
  {"type": "paragraph", "text": "Mejora tu productividad o protege tu equipo con estilo."}
]'::jsonb),

-- 15. Handmade / Artesanal
(true, true, 'Handmade / Artesanal', 'Para productos hechos a mano o artesanía.', '[
  {"type": "heading", "text": "🎨 Hecho a Mano con Amor", "level": 1},
  {"type": "paragraph", "text": "Pieza única creada artesanalmente. Apoya el talento local."},
  {"type": "bullets", "items": ["Técnica: [Tejido/Pintura/Joyería]", "Materiales: [Naturales/Reciclados]", "Tiempo de elaboración: [Horas]"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto de cerca", "slot_aspect": "square"},
  {"type": "paragraph", "text": "Cada pieza es diferente y especial."}
]'::jsonb),

-- 16. Outlet / Liquidación
(true, true, 'Outlet / Liquidación', 'Para ventas rápidas o productos con detalles.', '[
  {"type": "heading", "text": "🏷️ Oportunidad / Outlet", "level": 1},
  {"type": "paragraph", "text": "Precio reducido por detalle estético o liquidación de stock."},
  {"type": "callout", "title": "Detalle", "body": "Lee bien: [Describir detalle, mancha pequeña, sin etiqueta, etc.]", "tone": "neutral"},
  {"type": "bullets", "items": ["Precio Original: $$$", "Tu Precio: $$$", "Ahorro: $$$"]},
  {"type": "paragraph", "text": "¡Aprovecha antes de que se vaya!"}
]'::jsonb),

-- 17. Pack / Lote
(true, true, 'Pack / Lote', 'Venta de varios artículos juntos.', '[
  {"type": "heading", "text": "📦 Pack Ahorro", "level": 1},
  {"type": "paragraph", "text": "Llévate todo el lote por un solo precio de envío."},
  {"type": "heading", "text": "Incluye:", "level": 3},
  {"type": "bullets", "items": ["Artículo 1: [Descripción]", "Artículo 2: [Descripción]", "Artículo 3: [Descripción]"]},
  {"type": "paragraph", "text": "Ideal para revendedores o para renovar guardarropa completo."}
]'::jsonb),

-- 18. Edición Limitada
(true, true, 'Edición Limitada', 'Para drops exclusivos o colaboraciones.', '[
  {"type": "heading", "text": "🌟 Edición Limitada / Collab", "level": 1},
  {"type": "paragraph", "text": "Colaboración especial [Marca X Artista]. Muy difícil de conseguir."},
  {"type": "bullets", "items": ["Fecha lanzamiento: [Año]", "Número de serie (si aplica)", "Full Set (Caja y papeles)"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Logo de colaboración", "slot_aspect": "landscape"},
  {"type": "paragraph", "text": "Pieza de inversión."}
]'::jsonb),

-- 19. Básicos Esenciales
(true, true, 'Básicos Esenciales', 'Ropa básica de diario.', '[
  {"type": "heading", "text": "👕 Básico Imprescindible", "level": 2},
  {"type": "paragraph", "text": "La prenda que no puede faltar en tu closet. Combina con todo."},
  {"type": "bullets", "items": ["Corte: [Regular/Slim]", "Tela: [Algodón/Lino]", "Color: [Neutro]"]},
  {"type": "paragraph", "text": "Cómodo, versátil y en excelente estado."}
]'::jsonb),

-- 20. Regalo Perfecto
(true, true, 'Regalo Perfecto', 'Artículos ideales para regalar.', '[
  {"type": "heading", "text": "🎁 Listo para Regalar", "level": 1},
  {"type": "paragraph", "text": "Sorprende a esa persona especial (o date un gusto)."},
  {"type": "bullets", "items": ["Estado: Nuevo con etiquetas", "Empaque: Original impecable", "Ideal para: [Cumpleaños/Aniversario]"]},
  {"type": "image", "url": "", "is_slot": true, "slot_label": "Foto del empaque", "slot_aspect": "square"},
  {"type": "paragraph", "text": "Puedo enviar nota dedicatoria si lo deseas."}
]'::jsonb);
