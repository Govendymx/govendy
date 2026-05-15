const https = require('https');

/**
 * Script para identificar atributos obligatorios en MercadoLibre (MLM)
 * Uso: node get_meli_attrs.js "Nombre del Producto"
 * 
 * Este script utiliza fetch (nativo en Node.js 18+) para consultar la API de MercadoLibre.
 */

// Obtener el término de búsqueda de los argumentos de la línea de comandos
const query = process.argv[2];

if (!query) {
  console.log("❌ Por favor, proporciona un nombre de producto.");
  console.log("   Uso: node scripts/get_meli_attrs.js \"Proyector HY300\"");
  process.exit(1);
}

async function main() {
  try {
    // ---------------------------------------------------------
    // PASO 1: Predictor de Categoría (Domain Discovery)
    // ---------------------------------------------------------
    console.log(`🔍 1. Buscando categoría para: "${query}"...`);
    
    const searchResponse = await fetch(`https://api.mercadolibre.com/sites/MLM/domain_discovery/search?q=${encodeURIComponent(query)}`);
    
    if (!searchResponse.ok) {
      throw new Error(`Error API Domain Discovery: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();

    // Validar si encontramos alguna categoría
    if (!searchData || searchData.length === 0) {
      console.log("⚠️ No se encontró ninguna categoría para este producto. Intenta ser más específico.");
      return;
    }

    // MercadoLibre devuelve un array ordenado por probabilidad. Tomamos el primero.
    const bestMatch = searchData[0];
    const categoryId = bestMatch.category_id;
    const categoryName = bestMatch.category_name;

    console.log(`✅ Categoría Detectada: ${categoryName}`);
    console.log(`🆔 ID Categoría: ${categoryId}\n`);

    // ---------------------------------------------------------
    // PASO 2: Obtener Atributos de la Categoría
    // ---------------------------------------------------------
    console.log(`📥 2. Consultando atributos obligatorios...`);

    const attrsResponse = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`);

    if (!attrsResponse.ok) {
      throw new Error(`Error API Attributes: ${attrsResponse.status} ${attrsResponse.statusText}`);
    }

    const attrsData = await attrsResponse.json();

    // ---------------------------------------------------------
    // PASO 3: Filtrado Inteligente
    // ---------------------------------------------------------
    // Filtramos por:
    // 1. tags.required === true (Obligatorios por sistema)
    // 2. IDs clave como BRAND (Marca) o MODEL (Modelo) que son esenciales para SEO/Venta
    // 3. GTIN/EAN/UPC (Códigos universales) también son críticos
    
    const essentialKeys = ['BRAND', 'MODEL', 'GTIN', 'ITEM_CONDITION'];

    const requiredAttributes = attrsData.filter(attr => {
      const isRequired = attr.tags && attr.tags.required === true;
      const isEssential = essentialKeys.includes(attr.id);
      
      // Queremos atributos que sean requeridos O esenciales, y que no sean de solo lectura (read_only)
      // aunque para publicación, generalmente nos importan los que podemos enviar.
      return isRequired || isEssential;
    });

    // Mapeamos a un objeto JSON limpio
    const cleanOutput = requiredAttributes.map(attr => ({
      id: attr.id,
      name: attr.name,
      value_type: attr.value_type, // string, number, list, boolean, number_unit
      required: attr.tags?.required || false,
      // Si es una lista, a veces es útil saber si acepta valores custom
      allow_custom_value: attr.tags?.allow_custom_value || false,
      // Hint o ejemplo si existe
      hint: attr.hint || null
    }));

    // ---------------------------------------------------------
    // SALIDA
    // ---------------------------------------------------------
    console.log(`\n📋 Resultado (${cleanOutput.length} atributos encontrados):`);
    console.log(JSON.stringify(cleanOutput, null, 2));

  } catch (error) {
    console.error("\n💥 Ocurrió un error:", error.message);
  }
}

// Ejecutar el script
main();
