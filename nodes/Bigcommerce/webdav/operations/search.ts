import { parseSearch, parseXML } from "../tools/dav";
import { joinURL } from "../tools/url";
import { encodePath } from "../tools/path";
import { request, prepareRequestOptions } from "../request";
import { handleResponseCode, processResponsePayload } from "../response";
import {
    SearchResult,
    ResponseDataDetailed,
    SearchOptions,
    WebDAVClientContext
} from "../types";

export async function getSearch(
    context: WebDAVClientContext,
    searchArbiter: string,
    options: SearchOptions = {}
): Promise<SearchResult | ResponseDataDetailed<SearchResult>> {
    const { details: isDetailed = false } = options;
    const requestOptions = prepareRequestOptions(
        {
            url: joinURL(context.remoteURL, encodePath(searchArbiter)),
            method: "SEARCH",
            headers: {
                Accept: "text/plain,application/xml",
                // Ensure a Content-Type header is set was this is required by e.g. sabre/dav
                "Content-Type": context.headers["Content-Type"] || "application/xml; charset=utf-8"
            }
        },
        context,
        options
    );
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseText = await response.text();
    const responseData = await parseXML(responseText, context.parsing);
    const results = parseSearch(responseData, searchArbiter, isDetailed);
    return processResponsePayload(response, results, isDetailed);
}
