import { parseStat, parseXML } from "../tools/dav";
import { joinURL } from "../tools/url";
import { encodePath } from "../tools/path";
import { request, prepareRequestOptions } from "../request";
import { handleResponseCode, processResponsePayload } from "../response";
import { FileStat, ResponseDataDetailed, StatOptions, WebDAVClientContext } from "../types";

export async function getStat(
    context: WebDAVClientContext,
    filename: string,
    options: StatOptions = {}
): Promise<FileStat | ResponseDataDetailed<FileStat>> {
    const { details: isDetailed = false } = options;
    const requestOptions = prepareRequestOptions(
        {
            url: joinURL(context.remoteURL, encodePath(filename)),
            method: "PROPFIND",
            headers: {
                Accept: "text/plain,application/xml",
                Depth: "0"
            }
        },
        context,
        options
    );
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseData = await response.text();
    const result = await parseXML(responseData, context.parsing);
    const stat = parseStat(result, filename, isDetailed);
    return processResponsePayload(response, stat, isDetailed);
}
