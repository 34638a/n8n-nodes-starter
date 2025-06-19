import base64 from "base-64";
import { decodeHTML } from "entities";

export function decodeHTMLEntities(text: string): string {
    return decodeHTML(text);
}

export function fromBase64(text: string): string {
    return base64.decode(text);
}

export function toBase64(text: string): string {
    return base64.encode(text);
}
