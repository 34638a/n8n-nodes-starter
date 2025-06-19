import { normalisePath } from './path';

export function extractURLPath(fullURL: string): string {
	const url = new URL(fullURL);
	let urlPath = url.pathname;
	if (urlPath.length <= 0) {
		urlPath = '/';
	}
	return normalisePath(urlPath);
}

export function joinURL(...parts: Array<string>): string {
	const str_Parts = parts.slice(1).filter(s=>s!=="/").reduce((acc, part) => {
		return new URL(part, acc).href;
	}, parts[0]);
	return str_Parts;
}

export function normaliseHREF(href: string): string {
	try {
		return href.replace(/^https?:\/\/[^\/]+/, '');
	} catch (err) {
		throw err;
	}
}
