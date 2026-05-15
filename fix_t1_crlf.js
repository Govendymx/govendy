// Fix checkout T1 block — Node.js script preserving CRLF
// Reads file as binary, splits on \r\n, makes surgical changes, writes back as \r\n
const fs = require('fs');
const raw = fs.readFileSync('app/checkout/page.tsx', 'binary');

// Detect line ending type
const hasCRLF = raw.includes('\r\n');
const sep = hasCRLF ? '\r\n' : '\n';
const lines = raw.split(sep);

console.log('Total lines:', lines.length);
console.log('Line separator:', hasCRLF ? 'CRLF' : 'LF');
console.log('Line 1244 (1-indexed):', JSON.stringify(lines[1243]));
console.log('Line 1245 (1-indexed):', JSON.stringify(lines[1244]));
console.log('Line 1246 (1-indexed):', JSON.stringify(lines[1245]));
console.log('Line 1355 (1-indexed):', JSON.stringify(lines[1354]));
console.log('Line 1356 (1-indexed):', JSON.stringify(lines[1355]));
console.log('Line 1357 (1-indexed):', JSON.stringify(lines[1356]));
console.log('Line 1358 (1-indexed):', JSON.stringify(lines[1357]));
console.log('Line 1359 (1-indexed):', JSON.stringify(lines[1358]));

// Remove 0-indexed lines 1245..1356 (= 1-indexed 1246..1357)
// These are: T1 inner block comment + its entire content + closing </div>
const removeFrom = 1245; // 0-indexed
const removeTo = 1356;   // 0-indexed inclusive

// The new T1 standalone section to insert after line 1244 (0-indexed) = before the </section> and )}
const newT1Lines = [
    '',
    '            {/* T1 GoPocket Premium \u2014 secci\u00f3n independiente para todos los listings f\u00edsicos */}',
    '            {!allDigitalCart && (t1Loading || Object.keys(t1QuotesBySeller).length > 0) && (',
    '              <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">',
    '                <div className="flex items-center gap-3 mb-1">',
    '                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 px-3 py-1 text-xs font-bold text-white shadow-sm">\ud83d\ude80 GOPOCKET PREMIUM</span>',
    '                  <span className="text-xs text-gray-500">Multi-carrier v\u00eda T1 Env\u00edos</span>',
    '                </div>',
    '                <p className="mt-1 mb-4 text-sm text-gray-600">Elige tu paqueter\u00eda preferida entre las mejores opciones del mercado.</p>',
    '                {t1Loading && (',
    '                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 animate-pulse">',
    '                    \ud83d\ude80 Cargando opciones GoPocket Premium...',
    '                  </div>',
    '                )}',
    '                {Object.keys(t1QuotesBySeller).length > 0 && (',
    '                  <div className="space-y-4">',
    '                    {Object.entries(t1QuotesBySeller).map(([sellerId, quotes]) => {',
    "                      const sp = sellerProfiles[sellerId];",
    "                      const sellerName = (() => { const items = cartItems.filter(ci => { const l = listingsById[ci.listing_id]; return l && getSellerId(l) === sellerId; }); const l = items[0] ? listingsById[items[0].listing_id] : null; return (l as any)?.profiles?.full_name || (l as any)?.profiles?.nickname || 'Vendedor'; })();",
    '                      return (',
    '                        <div key={sellerId} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">',
    "                          <div className=\"mb-2 text-xs font-bold text-orange-700\">\ud83d\udce6 {sellerName} {sp?.city ? `\u00b7 ${sp.city}` : ''}</div>",
    '                          <div className="grid gap-2">',
    '                            {quotes.map((q, qi) => {',
    '                              const qKey = `${q.carrier_id}_${qi}`;',
    '                              const isSelected = selectedT1BySeller[sellerId] === qKey;',
    '                              return (',
    '                                <label',
    '                                  key={`${sellerId}_${qKey}`}',
    "                                  className={`cursor-pointer rounded-xl border p-3 text-sm transition ${isSelected ? 'border-orange-400 bg-white ring-1 ring-orange-300' : 'border-black/5 bg-white hover:bg-orange-50/50'}`}",
    '                                >',
    '                                  <div className="flex items-center justify-between gap-3">',
    '                                    <div className="flex min-w-0 items-center gap-3">',
    "                                      <div className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white ring-1 p-1 ${isSelected ? 'ring-orange-400' : 'ring-gray-200'}`}>",
    '                                        {/* eslint-disable-next-line @next/next/no-img-element */}',
    '                                        <img',
    "                                          src={q.carrier_name.toLowerCase().includes('dhl') ? 'https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Logo.svg' : `https://ui-avatars.com/api/?name=${encodeURIComponent(q.carrier_name)}&background=FF6B00&color=fff&bold=true&size=64`}",
    '                                          alt={q.carrier_name}',
    '                                          className="h-full w-full object-contain"',
    '                                          loading="lazy"',
    '                                        />',
    '                                      </div>',
    '                                      <div className="min-w-0 flex-1">',
    '                                        <div className="font-semibold text-gray-900">{q.carrier_name}</div>',
    '                                        <div className="mt-0.5 text-xs text-gray-600">',
    "                                          {q.service_level} \u00b7 {q.delivery_days === 1 ? '1 d\u00eda' : `${q.delivery_days} d\u00edas`} \u00b7 {formatMoney(q.cost)}",
    '                                        </div>',
    '                                      </div>',
    '                                    </div>',
    '                                    <input',
    '                                      type="radio"',
    '                                      name={`t1_${sellerId}`}',
    '                                      value={qKey}',
    '                                      checked={isSelected}',
    '                                      onChange={() => {',
    '                                        setSelectedT1BySeller(prev => ({ ...prev, [sellerId]: qKey }));',
    '                                        setSelectedShippingOptionId(null);',
    '                                      }}',
    '                                      className="h-4 w-4 text-orange-500 focus:ring-orange-500"',
    '                                    />',
    '                                  </div>',
    '                                </label>',
    '                              );',
    '                            })}',
    '                          </div>',
    '                        </div>',
    '                      );',
    '                    })}',
    '                  </div>',
    '                )}',
    '              </section>',
    '            )}',
];

// Build new file: lines before removeFrom + newT1Lines + lines from (removeTo+1) onward
const finalLines = [
    ...lines.slice(0, removeFrom),
    ...newT1Lines,
    ...lines.slice(removeTo + 1),
];

const finalContent = finalLines.join(sep);
fs.writeFileSync('app/checkout/page.tsx', finalContent, 'binary');
console.log('Done! New total lines:', finalLines.length);

// Verify the key area
for (let i = removeFrom - 2; i <= removeFrom + newT1Lines.length + 2; i++) {
    if (i >= 0 && i < finalLines.length && (i < removeFrom + 5 || i > removeFrom + newT1Lines.length - 5)) {
        console.log(`${i + 1}: ${finalLines[i]}`);
    }
}
