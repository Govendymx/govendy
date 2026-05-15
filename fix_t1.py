"""
Fix checkout T1 block using Python.
Reads the file in binary mode, preserves CRLF, surgically removes inner T1 block.
"""
with open('app/checkout/page.tsx', 'rb') as f:
    raw = f.read()

# Detect line separator
sep = b'\r\n' if b'\r\n' in raw else b'\n'
lines = raw.split(sep)
print(f"Total lines: {len(lines)}, separator: {'CRLF' if sep == b'\r\n' else 'LF'}")

# Find the T1 inner block start (the comment line)
t1_start = -1
for i, line in enumerate(lines):
    if b'T1 Carriers' in line and b'GoPocket Premium' in line and b'por vendedor' in line:
        t1_start = i
        break

if t1_start == -1:
    print("ERROR: T1 block not found!")
    exit(1)

print(f"T1 block start (0-indexed): {t1_start} = line {t1_start+1}")
print(f"Content: {lines[t1_start].decode('utf-8', errors='replace')}")

# Find end of T1 block: the </div> that closes space-y-4
# After the T1 block there should be </section> and )}
# We need to find the closing structure
# The T1 block ends with:
#   );})}         (closing map, quotes.map, t1QuotesBySeller.map)
#   </div>         <- this is the one we want to stop BEFORE
# Actually we want to stop at and include EVERYTHING up to lines[t1_start+N] where the next line is </section>

# Let's find the </section> that closes shippingOptions
section_close = -1
for i in range(t1_start + 5, len(lines)):
    stripped = lines[i].strip()
    if stripped == b'</section>':
        section_close = i
        break

if section_close == -1:
    print("ERROR: </section> not found after T1 block!")
    exit(1)

print(f"</section> found at 0-indexed: {section_close} = line {section_close+1}")
print(f"Content: {lines[section_close].decode('utf-8', errors='replace')}")
print(f"Line before </section>: {lines[section_close-1].decode('utf-8', errors='replace')}")
print(f"Line after </section>: {lines[section_close+1].decode('utf-8', errors='replace')}")

# The T1 inner block to remove is: lines[t1_start] through lines[section_close-1]
# (we keep </section> and what follows)
remove_from = t1_start  # inclusive
remove_to = section_close - 1  # inclusive

print(f"\nRemoving lines {remove_from+1} to {remove_to+1} (1-indexed)")
print(f"First: {lines[remove_from].decode('utf-8', errors='replace')}")
print(f"Last: {lines[remove_to].decode('utf-8', errors='replace')}")

# Build the new T1 standalone section (using same indentation as original)
new_t1_section = b"""
            {/* T1 GoPocket Premium \xe2\x80\x94 secci\xf3n independiente para todos los listings f\xedsicos */}
            {!allDigitalCart && (t1Loading || Object.keys(t1QuotesBySeller).length > 0) && (
              <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 px-3 py-1 text-xs font-bold text-white shadow-sm">\xf0\x9f\x9a\x80 GOPOCKET PREMIUM</span>
                  <span className="text-xs text-gray-500">Multi-carrier v\xeda T1 Env\xedos</span>
                </div>
                <p className="mt-1 mb-4 text-sm text-gray-600">Elige tu paqueter\xeda preferida entre las mejores opciones del mercado.</p>
                {t1Loading && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 animate-pulse">
                    \xf0\x9f\x9a\x80 Cargando opciones GoPocket Premium...
                  </div>
                )}
                {Object.keys(t1QuotesBySeller).length > 0 && (
                  <div className="space-y-4">
                    {Object.entries(t1QuotesBySeller).map(([sellerId, quotes]) => {
                      const sp = sellerProfiles[sellerId];
                      const sellerName = (() => { const items = cartItems.filter(ci => { const l = listingsById[ci.listing_id]; return l && getSellerId(l) === sellerId; }); const l = items[0] ? listingsById[items[0].listing_id] : null; return (l as any)?.profiles?.full_name || (l as any)?.profiles?.nickname || 'Vendedor'; })();
                      return (
                        <div key={sellerId} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                          <div className="mb-2 text-xs font-bold text-orange-700">\xf0\x9f\x93\xa6 {sellerName} {sp?.city ? `\xb7 ${sp.city}` : ''}</div>
                          <div className="grid gap-2">
                            {quotes.map((q, qi) => {
                              const qKey = `${q.carrier_id}_${qi}`;
                              const isSelected = selectedT1BySeller[sellerId] === qKey;
                              return (
                                <label
                                  key={`${sellerId}_${qKey}`}
                                  className={`cursor-pointer rounded-xl border p-3 text-sm transition ${isSelected ? 'border-orange-400 bg-white ring-1 ring-orange-300' : 'border-black/5 bg-white hover:bg-orange-50/50'}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white ring-1 p-1 ${isSelected ? 'ring-orange-400' : 'ring-gray-200'}`}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={q.carrier_name.toLowerCase().includes('dhl') ? 'https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Logo.svg' : `https://ui-avatars.com/api/?name=${encodeURIComponent(q.carrier_name)}&background=FF6B00&color=fff&bold=true&size=64`}
                                          alt={q.carrier_name}
                                          className="h-full w-full object-contain"
                                          loading="lazy"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-gray-900">{q.carrier_name}</div>
                                        <div className="mt-0.5 text-xs text-gray-600">
                                          {q.service_level} \xb7 {q.delivery_days === 1 ? '1 d\xeda' : `${q.delivery_days} d\xedas`} \xb7 {formatMoney(q.cost)}
                                        </div>
                                      </div>
                                    </div>
                                    <input
                                      type="radio"
                                      name={`t1_${sellerId}`}
                                      value={qKey}
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedT1BySeller(prev => ({ ...prev, [sellerId]: qKey }));
                                        setSelectedShippingOptionId(null);
                                      }}
                                      className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                                    />
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
""".replace(b'\n', sep)  # Convert LF to the file's actual separator

# Split new section into lines (remove empty first/last from the leading/trailing newlines)
new_t1_lines = new_t1_section.split(sep)

# Build final content
final_lines = lines[:remove_from] + new_t1_lines + lines[remove_to + 1:]
print(f"\nNew total lines: {len(final_lines)}")

result = sep.join(final_lines)
with open('app/checkout/page.tsx', 'wb') as f:
    f.write(result)

print("File written successfully!")
print(f"\nVerifying structure around insertion point:")
check_lines = sep.join(final_lines).split(sep)
for i in range(remove_from - 2, min(remove_from + 5, len(check_lines))):
    print(f"{i+1}: {check_lines[i].decode('utf-8', errors='replace')}")
