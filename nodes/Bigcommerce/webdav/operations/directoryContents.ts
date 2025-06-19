import { joinURL, normaliseHREF } from "../tools/url";
import { encodePath, makePathAbsolute, normalisePath } from "../tools/path";
import { parseXML, prepareFileFromProps } from "../tools/dav";
import { request, prepareRequestOptions } from "../request";
import { handleResponseCode, processGlobFilter, processResponsePayload } from "../response";
import {
    DAVResult,
    FileStat,
    GetDirectoryContentsOptions,
    ResponseDataDetailed,
    WebDAVClientContext
} from "../types";
import path from 'node:path';

export async function getDirectoryContents(
    context: WebDAVClientContext,
    remotePath: string,
    options: GetDirectoryContentsOptions = {}
): Promise<Array<FileStat> | ResponseDataDetailed<Array<FileStat>>> {
    const requestOptions = prepareRequestOptions(
        {
            url: joinURL(context.remoteURL, encodePath(remotePath), "/"),
            method: "PROPFIND",
            headers: {
                Accept: "text/plain,application/xml",
                Depth: options.deep ? "infinity" : "1"
            }
        },
        context,
        options
    );
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseData = await response.text();
    if (!responseData) {
        throw new Error("Failed parsing directory contents: Empty response");
    }
    const davResp = await parseXML(responseData, context.parsing);
    const _remotePath = makePathAbsolute(remotePath);
    const remoteBasePath = makePathAbsolute(context.remoteBasePath || context.remotePath);
    let files = getDirectoryFiles(
        davResp,
        remoteBasePath,
        _remotePath,
        options.details,
        options.includeSelf
    );
    if (options.glob) {
        files = processGlobFilter(files, options.glob);
    }
    return processResponsePayload(response, files, options.details);
}

function getDirectoryFiles(
    result: DAVResult,
    serverremoteBasePath: string,
    requestPath: string,
    isDetailed: boolean = false,
    includeSelf: boolean = false
): Array<FileStat> {
    const serverBase = path.join(serverremoteBasePath, "/");
    // Extract the response items (directory contents)
    const {
        multistatus: { response: responseItems }
    } = result;

    // Map all items to a consistent output structure (results)
    const nodes = responseItems.map(item => {
        // HREF is the file path (in full) - The href is already XML entities decoded (e.g. foo&amp;bar is reverted to foo&bar)
        const href = normaliseHREF(item.href);
        // Each item should contain a stat object

			const {
						// @ts-ignore
            propstat: { prop: props }
        } = item;
        // Process the true full filename (minus the base server path)
        const filename =
            serverBase === "/"
                ? decodeURIComponent(normalisePath(href))
                : normalisePath(
                      path.relative(decodeURIComponent(serverBase), decodeURIComponent(href))
                  );
        return prepareFileFromProps(props, filename, isDetailed);
    });

    // If specified, also return the current directory
    if (includeSelf) {
        return nodes;
    }

    // Else, filter out the item pointing to the current directory (not needed)
    return nodes.filter(
        item =>
            item.basename &&
            (item.type === "file" || item.filename !== requestPath.replace(/\/$/, ""))
    );
}
