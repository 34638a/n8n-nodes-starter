import md5 from "md5";
import { ha1Compute } from "../tools/crypto";
import { DigestContext } from "../types";

const NONCE_CHARS = "abcdef0123456789";
const NONCE_SIZE = 32;

export function createDigestContext(
    username: string,
    password: string,
    ha1: string
): DigestContext {
    return { username, password, ha1, nc: 0, algorithm: "md5", hasDigestAuth: false };
}

export function generateDigestAuthHeader(options:any, digest: DigestContext): string {
	const url = options.url.replace('//', '');
	const uri = url.indexOf('/') == -1 ? '/' : url.slice(url.indexOf('/'));
	const method = options.method ? options.method.toUpperCase() : 'GET';
	const qop = /(^|,)\s*auth\s*($|,)/.test(digest?.qop || "") ? 'auth' : false;
	const ncString = `00000000${digest?.nc}`.slice(-8);
	const ha1 = ha1Compute(
		digest?.algorithm || "",
		digest?.username || "",
		digest?.realm || "",
		digest?.password || "",
		digest?.nonce || "",
		digest?.cnonce || "",
		digest?.ha1 || "",
	);

	const ha2 = md5(`${method}:${uri}`);
	const digestResponse = qop
		? md5(`${ha1}:${digest.nonce}:${ncString}:${digest.cnonce}:${qop}:${ha2}`)
		: md5(`${ha1}:${digest.nonce}:${ha2}`);

	const authValues = {
		username: digest.username,
		realm: digest.realm,
		nonce: digest.nonce,
		uri,
		qop,
		response: digestResponse,
		nc: ncString,
		cnonce: digest.cnonce,
		algorithm: digest.algorithm,
		opaque: digest.opaque,
	};

	const authHeader = [];
	for (const k in authValues) {
		// @ts-ignore
		if (authValues[k]) {
			if (k === 'qop' || k === 'nc' || k === 'algorithm') {
				authHeader.push(`${k}=${authValues[k]}`);
			} else {
				// @ts-ignore
				authHeader.push(`${k}="${authValues[k]}"`);
			}
		}
	}

	return `Digest ${authHeader.join(', ')}`;
}

function makeNonce(): string {
    let uid = "";
    for (let i = 0; i < NONCE_SIZE; ++i) {
        uid = `${uid}${NONCE_CHARS[Math.floor(Math.random() * NONCE_CHARS.length)]}`;
    }
    return uid;
}

export function parseDigestAuth(response: any, _digest: DigestContext | undefined): boolean {
	const isDigest = responseIndicatesDigestAuth(response);
	if (!isDigest) {
		return false;
	}
	const re = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi;
	for (;;) {
		const authHeader = (response.headers && response.headers.get('www-authenticate')) || '';
		const match = re.exec(authHeader);
		if (!match) {
			break;
		}
		if (_digest) {
			// @ts-ignore
			_digest[match[1]] = match[2] || match[3];
		}
	}
	// @ts-ignore
	_digest.nc += 1;
	// @ts-ignore
	_digest.cnonce = makeNonce();
	return true;
}

export function responseIndicatesDigestAuth(response: Response): boolean {
    const authHeader = (response.headers && response.headers.get("www-authenticate")) || "";
    return authHeader.split(/\s/)[0].toLowerCase() === "digest";
}
