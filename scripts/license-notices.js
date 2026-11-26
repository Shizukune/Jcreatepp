// Build-time only. Collect the original notices of packages included in the bundle.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function packageDirectory(id) {
  if (!id || id.startsWith('\0')) return null;
  const file = id.split('!').pop().split('?')[0];
  if (!path.isAbsolute(file) || !file.replace(/\\/g, '/').includes('/node_modules/')) return null;
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (pkg.name && pkg.version) return { dir, pkg };
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Cannot identify bundled package: ${id}`);
}

function notices(ids, { fonts = false } = {}) {
  const packages = new Map();
  for (const id of ids) {
    const found = packageDirectory(id);
    if (found) packages.set(`${found.pkg.name}@${found.pkg.version}`, found);
  }
  const sections = [];
  const missing = [];
  for (const [name, { dir, pkg }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    const files = fs.readdirSync(dir).filter(f => /^(licen[cs]e|copying|notice)(?:$|[.-])/i.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort();
    let texts = files.map(f => `--- ${f} ---\n${fs.readFileSync(path.join(dir, f), 'utf8')}`);
    let hasLicense = files.some(f => /^(licen[cs]e|copying)(?:$|[.-])/i.test(f));
    if (!hasLicense && pkg.name === 'blockly' && pkg.version === '12.5.1') {
      texts.unshift('Copyright Google LLC\n\n' + fs.readFileSync(path.join(root, 'licenses/blockly-12.5.1.txt'), 'utf8'));
      hasLicense = true;
    }
    if (!hasLicense && pkg.name === '@docsearch/css' && pkg.version === '3.8.2') {
      texts.unshift(fs.readFileSync(path.join(root, 'licenses/docsearch-3.8.2.txt'), 'utf8'));
      hasLicense = true;
    }
    if (!hasLicense) { missing.push(name); continue; }
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || '';
    sections.push(`## ${name}\nLicense: ${pkg.license || 'See original text below'}\nSource: ${repository}\n\n${texts.join('\n\n')}`);
  }
  if (fonts) sections.push('## Inter font (bundled with VitePress)\nSource: https://github.com/rsms/inter\n\n' + fs.readFileSync(path.join(root, 'licenses/Inter-OFL.txt'), 'utf8'));
  if (fonts) sections.push('## Lucide / Feather icons (embedded in VitePress CSS)\nSource: https://github.com/lucide-icons/lucide\n\n' + fs.readFileSync(path.join(root, 'licenses/Lucide-ISC.txt'), 'utf8'));
  if (missing.length) throw new Error(`Bundled packages without license text: ${missing.join(', ')}. Add verified notices before distributing.`);
  return 'Third-party licenses and notices\n\nGenerated from packages included in this distribution.\nJcreate++ itself: Apache-2.0 (see LICENSE.txt).\nThird-party components retain their own licenses below.\n\n' + sections.join('\n\n' + '='.repeat(72) + '\n\n') + '\n';
}

class LicenseNoticesPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('LicenseNotices', compilation => {
      compilation.hooks.processAssets.tap({ name: 'LicenseNotices', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE }, () => {
        const ids = [];
        const visit = module => {
          if (module.resource) ids.push(module.resource);
          if (module.modules) for (const child of module.modules) visit(child);
        };
        for (const module of compilation.modules) visit(module);
        const RawSource = compiler.webpack.sources.RawSource;
        compilation.emitAsset('THIRD-PARTY-NOTICES.txt', new RawSource(notices(ids)));
        compilation.emitAsset('LICENSE.txt', new RawSource(fs.readFileSync(path.join(root, 'LICENSE'))));
      });
    });
  }
}

function docsLicenseNotices() {
  return {
    name: 'jcreatepp-license-notices', apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: notices([...this.getModuleIds()], { fonts: true }) });
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: fs.readFileSync(path.join(root, 'LICENSE'), 'utf8') });
    },
  };
}

module.exports = { notices, LicenseNoticesPlugin, docsLicenseNotices };
