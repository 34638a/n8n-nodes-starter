import { createDigestContext } from "./digest";
import { generateBasicAuthHeader } from "./basic";
import { generateTokenAuthHeader } from "./oauth";
import { AuthType, ErrorCode, OAuthToken, WebDAVClientContext } from "../types";

export function setupAuth(
	context: WebDAVClientContext,
	username: string | undefined,
	password: string | undefined,
	oauthToken: OAuthToken | undefined,
	ha1: string | undefined,
): void {
	switch (context.authType) {
		case AuthType.Auto:
			if (username && password) {
				context.headers.Authorization = generateBasicAuthHeader(username, password);
			}
			break;
		case AuthType.Digest:
			// @ts-ignore
			context.digest = createDigestContext(username, password, ha1);
			break;
		case AuthType.None:
			// Do nothing
			break;
		case AuthType.Password:
			// @ts-ignore
			context.headers.Authorization = generateBasicAuthHeader(username, password);
			break;
		case AuthType.Token:
			// @ts-ignore
			context.headers.Authorization = generateTokenAuthHeader(oauthToken);
			break;
		default:
			throw new Error(
				`Invalid auth type: ${context.authType}`,
				{ cause: ErrorCode.InvalidAuthType }
			);
	}
}
