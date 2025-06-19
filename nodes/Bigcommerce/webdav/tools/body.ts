import Stream from "stream";
import { isArrayBuffer } from "../compat/arrayBuffer";
import { isBuffer } from "../compat/buffer";
import { Headers, RequestDataPayload } from "../types";
import { BodyInit } from 'node-fetch';

export function requestDataToFetchBody(data: RequestDataPayload): [BodyInit, Headers] {
    if (data instanceof Stream.Readable) {
        // @ts-ignore
        return [data, {}];
    }
    if (typeof data === "string") {
        return [data, {}];
    } else if (isBuffer(data)) {
        return [data as Buffer, {}];
    } else if (isArrayBuffer(data)) {
			// @ts-ignore
        return [data as ArrayBuffer, {}];
    } else if (data && typeof data === "object") {
        return [
            JSON.stringify(data as Record<string, any>),
            {
                "content-type": "application/json"
            }
        ];
    }
    throw new Error(`Unable to convert request body: Unexpected body type: ${typeof data}`);
}
