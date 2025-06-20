
import { XMLParser } from "fast-xml-parser";
import nestedProp from "nested-property";
import { encodePath, normalisePath } from "./path";
import type {
    DAVResult,
    DAVResultPropstatResponse,
    DAVResultRaw,
    DAVResultResponse,
    DAVResultResponseProps,
    DiskQuotaAvailable,
    FileStat,
    SearchResult,
    WebDAVClientError,
    WebDAVParsingContext
} from "../types.ts";
import path from 'node:path';

enum PropertyType {
    Array = "array",
    Object = "object",
    Original = "original"
}

function getParser({
    attributeNamePrefix,
    attributeParsers,
    tagParsers
}: WebDAVParsingContext): XMLParser {
    return new XMLParser({
        allowBooleanAttributes: true,
        attributeNamePrefix,
        textNodeName: "text",
        ignoreAttributes: false,
        removeNSPrefix: true,
        numberParseOptions: {
            hex: true,
            leadingZeros: false
        },
        attributeValueProcessor(_, attrValue, jPath) {
            for (const processor of attributeParsers) {
                try {
                    const value = processor(jPath, attrValue);
                    if (value !== attrValue) {
                        return value;
                    }
                } catch (error) {
                    // skipping this invalid parser
                }
            }
            return attrValue;
        },
        tagValueProcessor(tagName, tagValue, jPath) {
            for (const processor of tagParsers) {
                try {
                    const value = processor(jPath, tagValue);
                    if (value !== tagValue) {
                        return value;
                    }
                } catch (error) {
                    // skipping this invalid parser
                }
            }
            return tagValue;
        }
    });
}

/**
 * Tag parser for the displayname prop.
 * Ensure that the displayname is not parsed and always handled as is.
 * @param path The jPath of the tag
 * @param value The text value of the tag
 */
export function displaynameTagParser(path: string, value: string): string | void {
    if (path.endsWith("propstat.prop.displayname")) {
        // Do not parse the displayname, because this causes e.g. '2024.10' to result in number 2024.1
        return;
    }
    return value;
}

function getPropertyOfType(
    obj: Object,
    prop: string,
    type: PropertyType = PropertyType.Original
): any {
    const val = nestedProp.get(obj, prop);
    if (type === "array" && Array.isArray(val) === false) {
        return [val];
    } else if (type === "object" && Array.isArray(val)) {
        return val[0];
    }
    return val;
}

function normaliseResponse(response: any): DAVResultResponse {
    const output = Object.assign({}, response);
    // Only either status OR propstat is allowed
    if (output.status) {
        nestedProp.set(output, "status", getPropertyOfType(output, "status", PropertyType.Object));
    } else {
        nestedProp.set(
            output,
            "propstat",
            getPropertyOfType(output, "propstat", PropertyType.Object)
        );
        nestedProp.set(
            output,
            "propstat.prop",
            getPropertyOfType(output, "propstat.prop", PropertyType.Object)
        );
    }
    return output;
}

function normaliseResult(result: DAVResultRaw): DAVResult {
    const { multistatus } = result;
    if (multistatus === "") {
        return {
            multistatus: {
                response: []
            }
        };
    }
    if (!multistatus) {
        throw new Error("Invalid response: No root multistatus found");
    }
    const output: any = {
        multistatus: Array.isArray(multistatus) ? multistatus[0] : multistatus
    };
    nestedProp.set(
        output,
        "multistatus.response",
        getPropertyOfType(output, "multistatus.response", PropertyType.Array)
    );
    nestedProp.set(
        output,
        "multistatus.response",
			// @ts-ignore
        nestedProp.get(output, "multistatus.response").map(response => normaliseResponse(response))
    );
    return output as DAVResult;
}

/**
 * Parse an XML response from a WebDAV service,
 *  converting it to an internal DAV result
 * @param xml The raw XML string
 * @param context The current client context
 * @returns A parsed and processed DAV result
 */
export function parseXML(xml: string, context?: WebDAVParsingContext): Promise<DAVResult> {
    // backwards compatibility as this method is exported from the package
    context = context ?? {
        attributeNamePrefix: "@",
        attributeParsers: [],
        tagParsers: [displaynameTagParser]
    };
    return new Promise(resolve => {
        const result = getParser(context).parse(xml);
        resolve(normaliseResult(result));
    });
}

/**
 * Get a file stat result from given DAV properties
 * @param props DAV properties
 * @param filename The filename for the file stat
 * @param isDetailed Whether or not the raw props of the resource should be returned
 * @returns A file stat result
 */
export function prepareFileFromProps(
    props: DAVResultResponseProps,
    filename: string,
    isDetailed: boolean = false
): FileStat {
    // Last modified time, raw size, item type and mime
    const {
        getlastmodified: lastMod = null,
        getcontentlength: rawSize = "0",
        resourcetype: resourceType = null,
        getcontenttype: mimeType = null,
        getetag: etag = null
    } = props;
    const type =
        resourceType &&
        typeof resourceType === "object" &&
        typeof resourceType.collection !== "undefined"
            ? "directory"
            : "file";
    const stat: FileStat = {
			filename,
			basename: path.basename(filename),
			// @ts-ignore
			lastmod: lastMod,
			size: parseInt(rawSize, 10),
			type,
			etag: typeof etag === 'string' ? etag.replace(/"/g, '') : null,
		};
    if (type === "file") {
        stat.mime = mimeType && typeof mimeType === "string" ? mimeType.split(";")[0] : "";
    }
    if (isDetailed) {
        // The XML parser tries to interpret values, but the display name is required to be a string
        if (typeof props.displayname !== "undefined") {
            props.displayname = String(props.displayname);
        }
        stat.props = props;
    }
    return stat;
}

/**
 * Parse a DAV result for file stats
 * @param result The resulting DAV response
 * @param filename The filename that was stat'd
 * @param isDetailed Whether or not the raw props of
 *  the resource should be returned
 * @returns A file stat result
 */
export function parseStat(
    result: DAVResult,
    filename: string,
    isDetailed: boolean = false
): FileStat {
	// @ts-ignore
    let responseItem: DAVResultPropstatResponse = null;
    try {
        // should be a propstat response, if not the if below will throw an error
        if ((result.multistatus.response[0] as DAVResultPropstatResponse).propstat) {
            responseItem = result.multistatus.response[0] as DAVResultPropstatResponse;
        }
    } catch (e) {
        /* ignore */
    }
    if (!responseItem) {
        throw new Error("Failed getting item stat: bad response");
    }
    const {
        propstat: { prop: props, status: statusLine }
    } = responseItem;

    // As defined in https://tools.ietf.org/html/rfc2068#section-6.1
    const [_, statusCodeStr, statusText] = statusLine.split(" ", 3);
    const statusCode = parseInt(statusCodeStr, 10);
    if (statusCode >= 400) {
        const err: WebDAVClientError = new Error(
            `Invalid response: ${statusCode} ${statusText}`
        ) as WebDAVClientError;
        err.status = statusCode;
        throw err;
    }

    const filePath = normalisePath(filename);
    return prepareFileFromProps(props, filePath, isDetailed);
}

/**
 * Parse a DAV result for a search request
 *
 * @param result The resulting DAV response
 * @param searchArbiter The collection path that was searched
 * @param isDetailed Whether or not the raw props of the resource should be returned
 */
export function parseSearch(result: DAVResult, searchArbiter: string, isDetailed: boolean) {
    const response: SearchResult = {
        truncated: false,
        results: []
    };

    response.truncated = result.multistatus.response.some(v => {

			return (
				// @ts-ignore
            (v.status || v.propstat?.status).split(" ", 3)?.[1] === "507" &&
            v.href.replace(/\/$/, "").endsWith(encodePath(searchArbiter).replace(/\/$/, ""))
        );
    });

    result.multistatus.response.forEach(result => {
        if (result.propstat === undefined) {
            return;
        }
        const filename = result.href.split("/").map(decodeURIComponent).join("/");
        response.results.push(prepareFileFromProps(result.propstat.prop, filename, isDetailed));
    });

    return response;
}

/**
 * Translate a disk quota indicator to a recognised
 *  value (includes "unlimited" and "unknown")
 * @param value The quota indicator, eg. "-3"
 * @returns The value in bytes, or another indicator
 */
export function translateDiskSpace(value: string | number): DiskQuotaAvailable {
    switch (String(value)) {
        case "-3":
            return "unlimited";
        case "-2":
        /* falls-through */
        case "-1":
            // -1 is non-computed
            return "unknown";
        default:
            return parseInt(String(value), 10);
    }
}
