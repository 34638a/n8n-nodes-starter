import base64 from "base64-js";
import { decodeHTML } from "entities";

export function decodeHTMLEntities(text: string): string {
    return decodeHTML(text);
}

export function fromBase64(text: string): string {
	const buffer = base64.toByteArray(text);
    return base64.fromByteArray(buffer);//.decode(text);
}

export function toBase64(text: string): string {
    return Buffer.from(base64.toByteArray(text)).toString('base64')//.encode(text);
}
