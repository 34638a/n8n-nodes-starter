import { Readable } from "stream";
import { joinURL } from "../tools/url";
import { encodePath } from "../tools/path";
import { request, prepareRequestOptions } from "../request";
import { handleResponseCode } from "../response";
import { getDAVCompliance } from "./getDAVCompliance";
import {
    BufferLike,
    ErrorCode,
    Headers,
    WebDAVMethodOptions,
    WebDAVClientContext
} from "../types";

export async function partialUpdateFileContents(
    context: WebDAVClientContext,
    filePath: string,
    start: number | null,
    end: number | null,
    data: string | BufferLike | Readable,
    options: WebDAVMethodOptions = {}
): Promise<void> {
    const compliance = await getDAVCompliance(context, filePath, options);
    if (compliance.compliance.includes("sabredav-partialupdate")) {
        return await partialUpdateFileContentsSabredav(
            context,
            filePath,
            start,
            end,
            data,
            options
        );
    }
    if (
        compliance.server.includes("Apache") &&
        compliance.compliance.includes("<http://apache.org/dav/propset/fs/1>")
    ) {
        return await partialUpdateFileContentsApache(context, filePath, start, end, data, options);
    }
    throw new Error(
        "Not supported",
			{ cause: ErrorCode.NotSupported }
    );
}

async function partialUpdateFileContentsSabredav(
	context: WebDAVClientContext,
	filePath: string,
	start: number | null,
	end: number | null,
	data: string | BufferLike | Readable,
	options: WebDAVMethodOptions = {},
): Promise<void> {
	// @ts-ignore
	if (start > end || start < 0) {
		// Actually, SabreDAV support negative start value,
		// Do not support here for compatibility with Apache-style way
		throw new Error(
			`Invalid update range ${start} for partial update`,
			{ cause: ErrorCode.InvalidUpdateRange }
		);
	}
	const headers: Headers = {
		'Content-Type': 'application/x-sabredav-partialupdate',
		// @ts-ignore
		'Content-Length': `${end - start + 1}`,
		'X-Update-Range': `bytes=${start}-${end}`,
	};
	const requestOptions = prepareRequestOptions(
		{
			url: joinURL(context.remoteURL, encodePath(filePath)),
			method: 'PATCH',
			headers,
			data,
		},
		context,
		options,
	);
	const response = await request(requestOptions, context);
	handleResponseCode(context, response);
}

async function partialUpdateFileContentsApache(
	context: WebDAVClientContext,
	filePath: string,
	start: number | null,
	end: number | null,
	data: string | BufferLike | Readable,
	options: WebDAVMethodOptions = {},
): Promise<void> {
	// @ts-ignore
	if (start > end || start < 0) {
		throw new Error(
			`Invalid update range ${start} for partial update`,
			{ cause: ErrorCode.InvalidUpdateRange }
		);
	}
	const headers: Headers = {
		'Content-Type': 'application/octet-stream',
		// @ts-ignore
		'Content-Length': `${end - start + 1}`,
		'Content-Range': `bytes ${start}-${end}/*`,
	};
	const requestOptions = prepareRequestOptions(
		{
			url: joinURL(context.remoteURL, encodePath(filePath)),
			method: 'PUT',
			headers,
			data,
		},
		context,
		options,
	);
	const response = await request(requestOptions, context);
	handleResponseCode(context, response);
}
