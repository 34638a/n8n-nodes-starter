import Stream, { Readable } from 'stream';
import { joinURL } from "../tools/url";
import { encodePath } from "../tools/path";
import { request, prepareRequestOptions } from "../request";
import { handleResponseCode } from "../response";
import {
    CreateReadStreamOptions,
    CreateWriteStreamCallback,
    CreateWriteStreamOptions,
    Headers,
    WebDAVClientContext,
    WebDAVClientError
} from "../types";

const NOOP = () => {};

export function createReadStream(
    context: WebDAVClientContext,
    filePath: string,
    options: CreateReadStreamOptions = {}
): Stream.Readable {
    const PassThroughStream = Stream.PassThrough;
    const outStream = new PassThroughStream();
    getFileStream(context, filePath, options)
        .then(stream => {
						//Error on line below
            stream.pipe(outStream);
        })
        .catch(err => {
            outStream.emit("error", err);
        });
    return outStream;
}

export function createWriteStream(
    context: WebDAVClientContext,
    filePath: string,
    options: CreateWriteStreamOptions = {},
    callback: CreateWriteStreamCallback = NOOP
): Stream.Writable {
    const PassThroughStream = Stream.PassThrough;
    const writeStream = new PassThroughStream();
    const headers = {};
    if (options.overwrite === false) {
        // @ts-ignore
			headers["If-None-Match"] = "*";
    }
    const requestOptions = prepareRequestOptions(
        {
            url: joinURL(context.remoteURL, encodePath(filePath)),
            method: "PUT",
            headers,
            data: writeStream,
            maxRedirects: 0
        },
        context,
        options
    );
    request(requestOptions, context)
        .then(response => handleResponseCode(context, response))
        .then(response => {
            // Fire callback asynchronously to avoid errors
            setTimeout(() => {
                callback(response);
            }, 0);
        })
        .catch(err => {
            writeStream.emit("error", err);
        });
    return writeStream;
}

async function getFileStream(
    context: WebDAVClientContext,
    filePath: string,
    options: CreateReadStreamOptions = {}
): Promise<Stream.Readable> {
    const headers: Headers = {};
    if (typeof options.range === "object" && typeof options.range.start === "number") {
        let rangeHeader = `bytes=${options.range.start}-`;
        if (typeof options.range.end === "number") {
            rangeHeader = `${rangeHeader}${options.range.end}`;
        }
        headers.Range = rangeHeader;
    }
    const requestOptions = prepareRequestOptions(
        {
            url: joinURL(context.remoteURL, encodePath(filePath)),
            method: "GET",
            headers
        },
        context,
        options
    );
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    if (headers.Range && response.status !== 206) {
        const responseError: WebDAVClientError = new Error(
            `Invalid response code for partial request: ${response.status}`
        );
        responseError.status = response.status;
        throw responseError;
    }
    if (options.callback) {
        setTimeout(() => {
            // @ts-ignore
					options.callback(response);
        }, 0);
    }
    return response.body ? Readable.fromWeb(response.body) : Readable.from(Buffer.from(''));
}
