const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'dist-web');

console.log('🚀 Building Flowspace for the web...');

// 1. Clean output directory
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Helper to copy directories recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy src files (HTML, CSS, JS) into root of dist-web
copyDirectory(path.join(rootDir, 'src'), outDir);

// 3. Copy assets folder (wallpapers, icon, branding) into dist-web/assets
copyDirectory(path.join(rootDir, 'assets'), path.join(outDir, 'assets'));

// 4. Create .nojekyll so GitHub Pages does not ignore underscore files or run Jekyll processing
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log('✅ Flowspace web build complete! Output files generated in dist-web/');
