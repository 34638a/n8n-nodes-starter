import { joinURL } from '../tools/url';
import { encodePath } from '../tools/path';
import { prepareRequestOptions, request } from '../request';
import { handleResponseCode } from '../response';
import {
	DAVCompliance,
	WebDAVClientContext,
	WebDAVClientError,
	WebDAVMethodOptions,
} from '../types';

export async function getDAVCompliance(
	context: WebDAVClientContext,
	filePath: string,
	options: WebDAVMethodOptions = {},
): Promise<DAVCompliance> {
	const requestOptions = prepareRequestOptions(
		{
			url: joinURL(context.remoteURL, encodePath(filePath)),
			method: 'OPTIONS',
		},
		context,
		options,
	);
	const response = await request(requestOptions, context);
	try {
		handleResponseCode(context, response);
	} catch (err) {
		throw err as WebDAVClientError;
	}
	const davHeader = response.headers.get('DAV') ?? '';
	const compliance = davHeader.split(',').map((item:any) => item.trim());
	const server = response.headers.get('Server') ?? '';
	return {
		compliance,
		server,
	};
}
