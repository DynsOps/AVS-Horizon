const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const functionsDir = path.join(rootDir, 'src', 'functions');
const outputFile = path.join(rootDir, 'src', 'index.ts');

const getFunctionModules = () => {
  const entries = fs.readdirSync(functionsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
    .map((entry) => entry.name.replace(/\.ts$/, ''))
    .sort((a, b) => a.localeCompare(b));
};

const modules = getFunctionModules();

const lines = [
  '// AUTO-GENERATED FILE. DO NOT EDIT.',
  '// Run `npm run build` (or `npm run prebuild`) to regenerate imports.',
  '',
];

for (const moduleName of modules) {
  lines.push(`import './functions/${moduleName}';`);
}

lines.push('');

fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
console.log(`Generated ${path.relative(rootDir, outputFile)} with ${modules.length} function imports.`);
