const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('c:/Users/ALEJANDRO/Documents/GoVendy/app').concat(walk('c:/Users/ALEJANDRO/Documents/GoVendy/components'));
let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace the specific text logo structure with the img tag.
    // Variations: 
    // <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
    //   <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
    // </Link>
    
    let newContent = content.replace(
        /<Link href="\/" className="flex h-[0-9]+ items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">\s*<span className="[^"]+">GoVendy<\/span>\s*<\/Link>/g,
        '<Link href="/"><img src="/logo.png" alt="GoVendy" className="h-10 w-auto object-contain" /></Link>'
    );
    
    // Some might be <div ...> instead of <Link>
    newContent = newContent.replace(
        /<div className="flex h-[0-9]+ items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">\s*<span className="[^"]+">GoVendy<\/span>\s*<\/div>/g,
        '<img src="/logo.png" alt="GoVendy" className="h-10 w-auto object-contain" />'
    );
    
    // AccountTopMenu might have slightly different classes:
    // <Link href="/dashboard" className="flex items-center gap-2">
    //    <div className="flex h-9 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm">
    //        <span className="text-xs font-black tracking-tighter">GoVendy</span>
    //    </div>
    // </Link>
    newContent = newContent.replace(
        /<div className="flex h-[0-9]+ items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm[^"]*">\s*<span className="[^"]+">GoVendy<\/span>\s*<\/div>/g,
        '<img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />'
    );
    
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Replaced logo in: ' + file);
        count++;
    }
});
console.log('Total files updated: ' + count);
