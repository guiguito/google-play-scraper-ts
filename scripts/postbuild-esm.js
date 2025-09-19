const fs = require('node:fs');
const path = require('node:path');

const esmDir = path.join(__dirname, '..', 'dist', 'esm');

function ensurePackageJson() {
  const target = path.join(esmDir, 'package.json');
  const content = JSON.stringify({ type: 'module' }, null, 2);
  fs.writeFileSync(target, content + '\n');
}

function fixImports(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixImports(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      let text = fs.readFileSync(fullPath, 'utf8');
      const replaced = text
        .replace(/from\s+(['"])(\.\.?\/[^'"?]*)(['"])/g, (_, quote, spec, endQuote) => {
          if (spec.endsWith('.js') || spec.endsWith('.json')) return `from ${quote}${spec}${endQuote}`;
          return `from ${quote}${spec}.js${endQuote}`;
        })
        .replace(/import\(\s*(['"])(\.\.?\/[^'"?]*)(['"])\s*\)/g, (_, quote, spec, endQuote) => {
          if (spec.endsWith('.js') || spec.endsWith('.json')) return `import(${quote}${spec}${endQuote})`;
          return `import(${quote}${spec}.js${endQuote})`;
        });
      if (replaced !== text) {
        fs.writeFileSync(fullPath, replaced, 'utf8');
      }
    }
  }
}

ensurePackageJson();
fixImports(esmDir);
