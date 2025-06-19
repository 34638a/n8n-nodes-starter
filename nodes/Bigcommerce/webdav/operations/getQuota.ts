import { prepareRequestOptions, request } from "../request";
import { handleResponseCode, processResponsePayload } from "../response";
import { parseXML } from "../tools/dav";
import { joinURL } from "../tools/url";
import { parseQuota } from "../tools/quota";
import { DiskQuota, GetQuotaOptions, ResponseDataDetailed, WebDAVClientContext } from "../types";

export async function getQuota(
    context: WebDAVClientContext,
    options: GetQuotaOptions = {}
): Promise<DiskQuota | null | ResponseDataDetailed<DiskQuota | null>> {
    const path = options.path || "/";
    const requestOptions = prepareRequestOptions(
        {
            url: joinURL(context.remoteURL, path),
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
    const quota = parseQuota(result);
    return processResponsePayload(response, quota, options.details);
}
