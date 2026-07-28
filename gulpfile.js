const { src, dest, parallel } = require('gulp');

function buildNodeIcons() {
	return src('nodes/**/*.{png,svg}').pipe(dest('dist/nodes'));
}

function buildCredentialIcons() {
	return src('credentials/**/*.{png,svg}').pipe(dest('dist/credentials'));
}

function buildCodex() {
	return src('nodes/**/*.node.json').pipe(dest('dist/nodes'));
}

exports['build:icons'] = parallel(buildNodeIcons, buildCredentialIcons, buildCodex);
