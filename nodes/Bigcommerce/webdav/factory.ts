import Stream from "stream";
import { extractURLPath } from "./tools/url";
import { setupAuth } from "./auth";
import { copyFile } from "./operations/copyFile";
import { createDirectory } from "./operations/createDirectory";
import { createReadStream, createWriteStream } from "./operations/createStream";
import { customRequest } from "./operations/customRequest";
import { deleteFile } from "./operations/deleteFile";
import { exists } from "./operations/exists";
import { getDirectoryContents } from "./operations/directoryContents";
import { getFileContents, getFileDownloadLink } from "./operations/getFileContents";
import { lock, unlock } from "./operations/lock";
import { getQuota } from "./operations/getQuota";
import { getStat } from "./operations/stat";
import { getSearch } from "./operations/search";
import { moveFile } from "./operations/moveFile";
import { getFileUploadLink, putFileContents } from "./operations/putFileContents";
import { partialUpdateFileContents } from "./operations/partialUpdateFileContents";
import { getDAVCompliance } from "./operations/getDAVCompliance";
import { displaynameTagParser } from "./tools/dav";
import {
    AuthType,
    BufferLike,
    CopyFileOptions,
    CreateReadStreamOptions,
    CreateWriteStreamCallback,
    CreateWriteStreamOptions,
    GetDirectoryContentsOptions,
    GetFileContentsOptions,
    GetQuotaOptions,
    Headers,
    LockOptions,
    MoveFileOptions,
    PutFileContentsOptions,
    RequestOptionsCustom,
    SearchOptions,
    StatOptions,
    WebDAVAttributeParser,
    WebDAVClient,
    WebDAVClientContext,
    WebDAVClientOptions,
    WebDAVMethodOptions,
    WebDAVTagParser
} from "./types";

const DEFAULT_CONTACT_HREF =
    "https://github.com/perry-mitchell/webdav-client/blob/master/LOCK_CONTACT.md";

export function createClient(remoteURL: string, options: WebDAVClientOptions = {}): WebDAVClient {
    const {
        authType: authTypeRaw = null,
        remoteBasePath,
        contactHref = DEFAULT_CONTACT_HREF,
        ha1,
        headers = {},
        httpAgent,
        httpsAgent,
        password,
        token,
        username,
        withCredentials
    } = options;
    let authType = authTypeRaw;
    if (!authType) {
        authType = username || password ? AuthType.Password : AuthType.None;
    }
    const context: WebDAVClientContext = {
        authType,
        remoteBasePath,
        contactHref,
        ha1,
        headers: Object.assign({}, headers),
        httpAgent,
        httpsAgent,
        password,
        parsing: {
            attributeNamePrefix: options.attributeNamePrefix ?? "@",
            attributeParsers: [],
            tagParsers: [displaynameTagParser]
        },
        remotePath: extractURLPath(remoteURL),
        remoteURL,
        token,
        username,
        withCredentials
    };
    setupAuth(context, username, password, token, ha1);
    return {
        copyFile: (filename: string, destination: string, options?: CopyFileOptions) =>
            copyFile(context, filename, destination, options),
        createDirectory: (path: string, options?: WebDAVMethodOptions) =>
            createDirectory(context, path, options),
        createReadStream: (filename: string, options?: CreateReadStreamOptions) =>
            createReadStream(context, filename, options),
        createWriteStream: (
            filename: string,
            options?: CreateWriteStreamOptions,
            callback?: CreateWriteStreamCallback
        ) => createWriteStream(context, filename, options, callback),
        customRequest: (path: string, requestOptions: RequestOptionsCustom) =>
            customRequest(context, path, requestOptions),
        deleteFile: (filename: string, options?: WebDAVMethodOptions) =>
            deleteFile(context, filename, options),
        exists: (path: string, options?: WebDAVMethodOptions) => exists(context, path, options),
        getDirectoryContents: (path: string, options?: GetDirectoryContentsOptions) =>
            getDirectoryContents(context, path, options),
        getFileContents: (filename: string, options?: GetFileContentsOptions) =>
            getFileContents(context, filename, options),
        getFileDownloadLink: (filename: string) => getFileDownloadLink(context, filename),
        getFileUploadLink: (filename: string) => getFileUploadLink(context, filename),
        getHeaders: () => Object.assign({}, context.headers),
        getQuota: (options?: GetQuotaOptions) => getQuota(context, options),
        lock: (path: string, options?: LockOptions) => lock(context, path, options),
        moveFile: (filename: string, destinationFilename: string, options?: MoveFileOptions) =>
            moveFile(context, filename, destinationFilename, options),
        putFileContents: (
            filename: string,
            data: string | BufferLike | Stream.Readable,
            options?: PutFileContentsOptions
        ) => putFileContents(context, filename, data, options),
        partialUpdateFileContents: (
            filePath: string,
            start: number,
            end: number,
            data: string | BufferLike | Stream.Readable,
            options?: WebDAVMethodOptions
        ) => partialUpdateFileContents(context, filePath, start, end, data, options),
        getDAVCompliance: (path: string) => getDAVCompliance(context, path),
        search: (path: string, options?: SearchOptions) => getSearch(context, path, options),
        setHeaders: (headers: Headers) => {
            context.headers = Object.assign({}, headers);
        },
        stat: (path: string, options?: StatOptions) => getStat(context, path, options),
        unlock: (path: string, token: string, options?: WebDAVMethodOptions) =>
            unlock(context, path, token, options),
        registerAttributeParser: (parser: WebDAVAttributeParser) => {
            context.parsing.attributeParsers.push(parser);
        },
        registerTagParser: (parser: WebDAVTagParser) => {
            context.parsing.tagParsers.push(parser);
        }
    };
}
