function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function firstImage(raw) {
  if (!raw) return '';
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  if (typeof raw === 'string') {
    const s = raw.trim();
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return String(parsed[0] || '').trim();
    } catch {}
    if (s.startsWith('http') || s.startsWith('/')) return s;
  }
  return '';
}
function mapThumbs(listingRows) {
  const out = {};
  for (const r of listingRows) {
    const id1 = String(r?.id || '').trim();
    const id2 = String(r?.public_id || '').trim();
    const img = firstImage(r?.images);
    if (img) {
      if (id1) out[id1] = img;
      if (id2) out[id2] = img;
    }
  }
  return out;
}
function assert(cond, msg) {
  if (!cond) {
    console.error('❌', msg);
    process.exit(1);
  }
}
function run() {
  const listings = [
    { id: '11111111-1111-1111-1111-111111111111', public_id: 'abc123', images: ['https://img/1.jpg', 'https://img/2.jpg'], title: 'A' },
    { id: '22222222-2222-2222-2222-222222222222', public_id: 'def456', images: '["https://img/3.jpg"]', title: 'B' },
    { id: '33333333-3333-3333-3333-333333333333', public_id: 'ghi789', images: 'https://img/4.jpg', title: 'C' },
  ];
  const thumbs = mapThumbs(listings);
  assert(thumbs['11111111-1111-1111-1111-111111111111'] === 'https://img/1.jpg', 'UUID 1 should map to first image');
  assert(thumbs['abc123'] === 'https://img/1.jpg', 'public_id abc123 should map to same first image');
  assert(thumbs['22222222-2222-2222-2222-222222222222'] === 'https://img/3.jpg', 'JSON string images should parse');
  assert(thumbs['def456'] === 'https://img/3.jpg', 'public_id def456 should map');
  assert(thumbs['33333333-3333-3333-3333-333333333333'] === 'https://img/4.jpg', 'plain string URL should be accepted');
  assert(thumbs['ghi789'] === 'https://img/4.jpg', 'public_id ghi789 should map');
  const orderItems = [
    { order_id: 'o1', listing_id: '11111111-1111-1111-1111-111111111111' },
    { order_id: 'o2', listing_id: 'def456' },
    { order_id: 'o3', listing_id: 'ghi789' },
  ];
  for (const it of orderItems) {
    const lid = String(it.listing_id);
    const isU = isUuid(lid);
    assert(typeof isU === 'boolean', 'isUuid returns boolean');
    assert(thumbs[lid], `listing_id ${lid} should resolve to a thumbnail`);
    const url = thumbs[lid];
    assert(url.startsWith('http') || url.startsWith('/'), `thumbnail URL valid for ${lid}`);
  }
  console.log('✅ Regression thumbnails: all assertions passed');
}
run();
