const esbuild = require('esbuild');
const glob = require('fast-glob');
const path = require('path');
const fs = require('fs');

console.log('Starting build process...');

// Set the input folders
const inputDirs = ['nodes', 'credentials'];

// Get all .ts files in the input folders (recursively)
const files = [
	glob.sync(inputDirs.map((dir) => `${dir}/**/*.ts`), { onlyFiles: true })
].flat();


console.log(`Found ${files.length} TypeScript files to compile.`);

files.forEach((file) => {
	const outFile = path.join('dist', file).replace(/\.ts$/, '.js');

	// Ensure output directory exists
	fs.mkdirSync(path.dirname(outFile), { recursive: true });

	// Build each file with esbuild
	esbuild.buildSync({
		entryPoints: [file],
		bundle: true,
		platform: 'node',
		format: 'cjs',
		target: ['node14'], // or your n8n node version
		outfile: outFile,
		external: ['n8n-core', 'n8n-workflow'], // Don't bundle these
	});

	console.log(`✔️ Compiled: ${file} → ${outFile}`);
});


glob.sync(inputDirs.map((dir) => `${dir}/**/*.svg|png`), { onlyFiles: true }).forEach((file) => {
	const outFile = path.join('dist', file);

	// Ensure output directory exists
	fs.mkdirSync(path.dirname(outFile), { recursive: true });

	// Copy the file to the output directory
	fs.copyFileSync(file, outFile);

	console.log(`✔️ Copied: ${file} → ${outFile}`);
});
