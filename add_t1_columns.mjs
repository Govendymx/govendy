// Script to add pagination to admin pages
import fs from 'fs';

const pages = [
  {
    file: 'app/admin/supervision/page.tsx',
    importLine: "'use client';",
    importAdd: "\nimport { Pagination, usePagination } from '@/components/ui/Pagination';",
    // We need to find the list array and add pagination
  },
  {
    file: 'app/admin/retiros/page.tsx',
    importLine: "'use client';",
    importAdd: "\nimport { Pagination, usePagination } from '@/components/ui/Pagination';",
  },
  {
    file: 'app/admin/gift-cards/page.tsx',
    importLine: "'use client';",
    importAdd: "\nimport { Pagination, usePagination } from '@/components/ui/Pagination';",
  },
  {
    file: 'app/admin/lives/page.tsx',
    importLine: "'use client';",
    importAdd: "\nimport { Pagination, usePagination } from '@/components/ui/Pagination';",
  },
  {
    file: 'app/admin/listings/page.tsx',
    importLine: "'use client';",
    importAdd: "\nimport { Pagination, usePagination } from '@/components/ui/Pagination';",
  },
];

// Just check what we need to edit in each file
for (const p of pages) {
  const content = fs.readFileSync(p.file, 'utf8');
  const lines = content.split('\n');

  // Find .map( calls in JSX rendering
  const mapLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.map(')) {
      mapLines.push({ line: i + 1, content: lines[i].trim().substring(0, 80) });
    }
  }

  console.log(`\n=== ${p.file} (${lines.length} lines) ===`);
  console.log('Map calls:', mapLines);
}
