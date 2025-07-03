import {
	type IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData, INodeProperties,
	INodeType,
	INodeTypeDescription,
	NodeParameterValueType,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { setTimeout as delay } from 'timers/promises';
import querystring from 'querystring';
import {AuthType, createClient, FileStat} from "./webdav";
import {esmImport} from "../util/esmImport";

// @ts-ignore
const RESTProperties: INodeProperties[] = [
	{
		displayName: 'API Endpoint Path',
		name: 'apiEndpointPath',
		type: 'string',
		default: '',
		placeholder: '/v3/catalog/products',
		description:
			'The API endpoint path to call. This should be the path after the store hash, e.g., `/v3/catalog/products`. Check the BigCommerce API documentation for available endpoints. Leading Slash is required.',
		required: true,
		validateType: 'string',
	},
	{
		displayName: 'Request Type',
		name: 'requestType',
		type: 'options',
		options: [
			{
				name: 'GET',
				value: 'get',
			},
			{
				name: 'POST',
				value: 'post',
			},
			{
				name: 'PUT',
				value: 'put',
			},
			{
				name: 'DELETE',
				value: 'delete',
			},
		],
		default: 'get',
		description:
			'The HTTP request type to use for the API call. Check the BigCommerce API documentation for the correct request type to use for each endpoint.',
		required: true
	},
	{
		displayName: 'Query Parameters',
		name: 'queryParameters',
		type: 'json',
		placeholder: 'Add Query Parameter',
		default: '{}',
		description:
			'Optional query parameters to include in the API request. These will be appended to the URL as query strings.',
		hint: "If bigcommerce specifies a array/list of items as your input. For example `id:in`, and your data is a JS Array: `[1,2,3]`, you can use the expression `{{ $json.id.join(',') }}` to convert it to a comma-separated string. This is necessary because Bigcommerce does not support array inputs in query parameters."
	},
	{
		displayName: 'Body JSON',
		name: 'bodyParameters',
		type: 'json',
		default: '{}',
		placeholder: '{"key": "value"}',
		description:
			'Optional body parameters to include in the API request. This is typically used for POST and PUT requests where you need to send data to the server.',
		hint: 'This should be a valid JSON object. If you need to send an array, as the body, be sure to wrap the entire input `[{"text": "value1"}, {"text": "value2"}` in square brackets. BigCommerce API expects the body to be an array for certain endpoints.`'
	},
	{
		displayName: 'Special Options',
		name: 'specialOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Respect 429 Backoff and Retry Later',
				name: 'backoff429',
				type: 'boolean',
				default: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
				description: 'When the API returns a 429 Too Many Requests error, this node will automatically back off and retry the request after a delay',
			}, /*
					{
						displayName: "Send As Form Data",
						name: "sendAsFormData",
						type: "boolean",
						default: false,
						description: 'When enabled, the body parameters will be sent as form data instead of JSON. This is useful for endpoints that expect form-encoded data, mostly File upload api calls.'
					},//*/
			{
				displayName: 'Get All Pages',
				name: 'autoPaginate',
				type: 'boolean',
				default: false,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
				description: 'Automatically handle pagination and retrieve all pages of results. This will make multiple API calls until all pages are retrieved. If disabled, only the first page of results will be returned.',
				hint: 'This will only work for endpoints that support pagination and return a `meta.pagination` object in the response (V3 API calls). If the endpoint does not support pagination, this option will have no effect.',
			},
			{
				displayName: 'Override Pagination Limit on V2 API Calls',
				name: 'autoPaginateOverride',
				type: 'boolean',
				default: false,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
				description: 'There is a hard cap of 1000 calls to a v2 API request implemented to prevent runnaway loops. If you are sure that the endpoint supports more than 1000 pages, you can enable this option to override the limit. This will allow the node to continue fetching pages until all data is retrieved.',
				hint: 'This will only work for endpoints that return pages of non-indexed pagination data (V2 API calls). If the endpoint does not support pagination, this option will have no effect.',
			}
		]
	},
].map(p=>{
	return {
		...p,
		displayOptions: {
			show: {
				operation: ['rest'],
			}
		}
	} as INodeProperties
});//*/

// @ts-ignore
const GraphQLProperties: INodeProperties[] = [
	{
		displayName: "GraphQL Query String",
		name: 'graphqlQuery',
		type: 'string',
		default: '',
		description:
			'The GraphQL query string to execute. This should be a valid GraphQL query. Check the BigCommerce API documentation for available queries.',
		required: true,
		validateType: 'string',
	},
	{
		displayName: 'GraphQL Variables',
		name: 'graphqlVariables',
		type: 'json',
		default: '{}',
		description:
			'Optional variables to include in the GraphQL query. This should be a valid JSON object.',
		hint: 'This should be a valid JSON object. The variables will be passed to the GraphQL query as variables. For example, if your query is `query($id: ID!) { product(id: $id) { name } }`, you can pass the variable as `{"id": 123}`.',
	},
].map(p=>{
	return {
		...p,
		displayOptions: {
			show: {
				operation: ['graphql'],
			}
		}
	} as INodeProperties
});//*/

// @ts-ignore
const WebDavProperties: INodeProperties[] = [
	{
		displayName:
			"This node is used to interact with the Bigcommerce WebDav file management system. Controlling this node requires a WebDav credential generated from a staff member's account.",
		type: 'notice',
		name: 'notice',
		default: '',
	},
	{
		displayName: 'Action',
		name: 'action',
		type: 'options',
		// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
		options: [
			{
				name: 'File / Folder Exists',
				value: 'exists',
			},
			{
				name: 'List Files / Folders in Directory',
				value: 'listContents',
			},
			{
				name: 'Get File',
				value: 'getFile',
			},
			{
				name: 'Upload File',
				value: 'uploadFile',
			},
			{
				name: 'Copy File (On BigCommerce WebDav)',
				value: 'copyFile',
				hint: 'This action is used to copy a file or folder on the BigCommerce WebDav server. It requires the source and destination paths to be specified. To download a file, use the "Get File" action instead.',
			},
			{
				name: 'Move File (On BigCommerce WebDav)',
				value: 'moveFile',
				hint: 'This action is used to copy a file or folder on the BigCommerce WebDav server. It requires the source and destination paths to be specified. To download a file, use the "Get File" action instead.',
			},
			{
				name: 'Create Folder',
				value: 'createFolder',
			},
			{
				name: 'Delete Folder',
				value: 'deleteFolder',
			},

		],
		default: 'exists',
	},
	{
		displayName: 'Read All Files in Directory',
		name: 'readAllFilesInDirectory',
		type: 'boolean',
		default: false,
		// eslint-disable-next-line
		description:
			'If enabled, the node will read all files in the directory specified by the WebDav Path. If disabled, it will only read the file specified by the WebDav Path.',
		hint: 'This option is only relevant for the "Get File" action. If enabled, the node will read all files in the directory specified by the WebDav Path. If disabled, it will only read the file specified by the WebDav Path.',
		displayOptions: {
			show: {
				action: ['getFile'],
			},
		},
	},
	{
		displayName: 'Upload File From Field',
		name: 'uploadFileFromField',
		type: 'string',
		default: "webDavFile",
		// eslint-disable-next-line
		description:
			'If enabled, the node will read all files in the directory specified by the WebDav Path. If disabled, it will only read the file specified by the WebDav Path.',
		hint: 'This option is only relevant for the "Get File" action. If enabled, the node will read all files in the directory specified by the WebDav Path. If disabled, it will only read the file specified by the WebDav Path.',
		displayOptions: {
			show: {
				action: ['getFile'],
			},
		},
	},
	{
		displayName: 'Overwrite Existing File',
		name: 'overwriteExistingFile',
		type: 'boolean',
		default: false,
		// eslint-disable-next-line
		description:
			'If enabled, the node will read all files in the directory specified by the WebDav Path. If disabled, it will only read the file specified by the WebDav Path.',
		hint: 'This option is only relevant for the "Get File" action. If enabled, the node will read all files in the directory specified by the WebDav Path. If disabled, it will only read the file specified by the WebDav Path.',
		displayOptions: {
			show: {
				action: ['getFile'],
			},
		},
	},
	{
		displayName: 'WebDav Path',
		name: 'davPath',
		type: 'string',
		default: '',
		placeholder: '/dav/content',
		hint: 'All paths should start with a leading slash dav `/dav`',
		description:
			'Path to the WebDav resource you want to access. This should be the path after the store hash, e.g., `/dav/content`. Check the BigCommerce WebDav documentation for available paths. Leading Slash is required.',
		required: true,
		validateType: 'string',
	},
].map(p=>{
	return {
		...p,
		displayOptions: {
			show: {
				operation: ['webdav'],
			}
		}
	}
});//*/







export class Bigcommerce_Action implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Call Bigcommerce API',
		icon: 'file:bigcommerce-logomark-whitebg.svg',
		name: 'bigcommerceActionNode',
		group: ['transform'],
		version: 1,
		description: 'Interact with the Bigcommerce API',
		defaults: {
			name: 'Call Bigcommerce API',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],

		credentials: [
			{
				name: 'bigcommerceApi',
				displayName: "REST API Token",
				required: true,
				displayOptions: { hide: { operation: ['graphql', 'webdav',] } }
			},
			{
				name: 'bigcommerceGraphQLApi',
				displayName: "GraphQL API Token",
				required: true,
				displayOptions: { hide: { operation: ['rest', 'webdav',] } }
			},//*/
			{
				name: 'bigcommerceWebDavApi',
				displayName: "WebDav API Token",
				required: true,
				displayOptions: { hide: { operation: ['rest', 'graphql',] } }
			},//*/
		],

		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Request Type',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'REST',
						value: 'rest',
					},
					{
						name: 'GraphQL',
						value: 'graphql',
					},
					{
						name: 'WebDav',
						value: 'webdav',
					},//*/
				],
				default: 'rest',
				required: true,
			},
			...RESTProperties,
			...GraphQLProperties,
			...WebDavProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const parameters = Object.keys(this.getNode().parameters);

		const executeSingleREST = async (
			params: Record<string, object | NodeParameterValueType>,
		): Promise<INodeExecutionData[]> => {
			const specialOptions = params['specialOptions'] as IDataObject;
			const backoff429: boolean = specialOptions['backoff429'] as boolean;
			const autoPaginate: boolean = specialOptions['autoPaginate'] as boolean;
			const autoPaginateOverride: boolean = specialOptions['autoPaginateOverride'] as boolean;
			const credentials = await this.getCredentials('bigcommerceApi');

			const generateRequestOptions = (params: Record<string, object | NodeParameterValueType>, queryExtra: Record<string, object | NodeParameterValueType> = {}): IHttpRequestOptions => {
				return {
					abortSignal: this.getExecutionCancelSignal(),
					url: `https://api.bigcommerce.com/stores/${credentials.storeHash}${params['apiEndpointPath']}${(()=>{
						try {
							const temp = querystring.stringify({...(JSON.parse(params['queryParameters'] as string) || {}), ...queryExtra});
							return temp ? `?${temp}` : '';
						} catch (_){return undefined}})() || ""}`,
					method: params['requestType'] as IHttpRequestMethods,
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						'X-Auth-Token': credentials.token,
					},
					body: params['bodyParameters'] || {},
					ignoreHttpStatusErrors: true, // We handle errors manually
				};
			}

			const fetchWithBackoff = async (fetchFn: () => Promise<any>): Promise<any> => {
				let response = await fetchFn();

				if (backoff429 && response.status === 429) {
					const retryAfterHeader = response.headers.get('X-Retry-After');
					let waitTime = 1000; // Default backoff 1 second

					if (retryAfterHeader) {
						const parsed = parseInt(retryAfterHeader, 10);
						if (!isNaN(parsed)) {
							waitTime = parsed * 1000;
						} else {
							const retryDate = new Date(retryAfterHeader).getTime();
							const now = Date.now();
							if (retryDate > now) {
								waitTime = retryDate - now;
							}
						}
					}

					console.log(`Received 429. Backing off for ${waitTime}ms before retrying...`);
					await delay(waitTime);

					return fetchWithBackoff(fetchFn);
				} else if(response.status >= 400) {
					throw response;
				}

				return response;
			};

			const originalFetch = fetchWithBackoff(() => this.helpers.httpRequest(generateRequestOptions(params)));
			const originalData:any = await originalFetch;
			if (!originalData) {
				console.warn('Bigcommerce API returned no data.');
				return [];
			}
			if (Array.isArray(originalData)) {
				// This endpoint does not support pagination, handle accordingly
				console.log('Received an array response, treating as a v2 API call.');
				if (autoPaginate) {
					console.warn('Auto-pagination is enabled, but the endpoint returned an array. This may not work as expected.');
					let page = params['page'] as number || 1;
					let gatheredData: any[] = [...originalData];
					let lastPageData:any[] = [...originalData];
					while (true) {
						if (page===100) {
							console.error("Large data set detected, Be sure to check that this is intended, as this may cause performance issues.");
						}
						if (page === 1000 && !autoPaginateOverride) {
							throw new NodeOperationError(this.getNode(), 'Bigcommerce API returned more than 1000 pages of data. This is likely an error in the API or the request parameters. Please check your request parameters and try again.', params);
						}
						lastPageData = await fetchWithBackoff(() =>
							this.helpers.httpRequest(generateRequestOptions(params, { page: page++ })),
						);
						if (Array.isArray(lastPageData)) {
							gatheredData = gatheredData.concat(lastPageData);
							continue;
						}
						break;
					}

					return gatheredData.filter(d=>!!d).map((data) => ({json: data}));
				}
				return originalData.filter(d=>!!d).map((data) => ({json: data}));
			}

			if (autoPaginate) {
				const paginationData:any = originalData?.meta?.pagination || {};
				const totalPages = paginationData.total_pages || 1;
				const currentPage = paginationData.current_page || 1;
				const ret:INodeExecutionData[] = [{json: originalData}];
				await Promise.all(
					[...new Array(totalPages - currentPage).keys()]
						.map((n) => totalPages - n)
						.reverse()
						.map((page) =>
							fetchWithBackoff(() =>
								this.helpers.httpRequest(generateRequestOptions(params, { page: page })),
							),
						),
				).then((arr) => arr.forEach(async (p) => (ret.push({json: await p}))));

				return ret;
			}

			return [{json: originalData}];
		};


		const executeSingleWebDav = async (params: Record<string, object | NodeParameterValueType>, itemIndex: number): Promise<INodeExecutionData[]> => {
			const credentials = await this.getCredentials('bigcommerceWebDavApi');
			const client = createClient(credentials.storeUrl as string, {
				authType: AuthType.Digest,
				username: credentials.username as string,
				password: credentials.password as string,
			});

			// Sub-Functions
			const readFileFromWebDav = async (path: string, item: FileStat): Promise<IBinaryData> => {
				return this.helpers.prepareBinaryData(
					client.createReadStream(path, {
						signal: this.getExecutionCancelSignal(),
					}),
					item.filename,
					item.mime || undefined,
				);
			};

			const getDirectoryContents = async (path: string): Promise<FileStat[]> => {
				const contents = (await client.getDirectoryContents(path)) as FileStat[];
				const pathEquivalent = path.endsWith('/') ? path.slice(0, path.length - 1) : path;
				return contents
					?.map((item) => {
						item.filename = item.filename.replace(/\\/g, '/');
						return item;
					})
					.filter(
						(item) =>
							item.type === 'file' ||
							(item.type === 'directory' && item.filename !== pathEquivalent),
					);
			};

			try {
				await client.exists('/dav');
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Failed to connect to BigCommerce WebDav. Either the credentials are not valid or there is a issue on Bigcommerce Servers: ${error.message}`,
				);
			}

			const action = params['action'] as string;
			const path = params['davPath'] as string;
			console.log(
				`Bigcommerce_WebDav: Executing action "${action}" on path "${path}" for item index ${itemIndex}`,
			);

			const query = async () => {
				const newItem = (json: any, binary?: IBinaryData): INodeExecutionData => {
					const newItem: INodeExecutionData = {
						json: json || {},
						binary: {},
						pairedItem: {
							item: itemIndex,
						},
					};

					if (binary) newItem.binary!['davFile'] = binary;

					return newItem;
				};

				switch (action) {
					case 'exists':
						const exists = await client.exists(path);
						return newItem({ exists: exists });

					case 'listContents':
						return newItem({ files: getDirectoryContents(path) });

					case 'getFile':
						const fileMetadata = (await client.stat(path)) as FileStat;

						if (!(params['readAllFilesInDirectory'] as boolean)) {
							if (fileMetadata.type !== 'file') {
								throw new NodeOperationError(
									this.getNode(),
									`The path "${path}" is not a file. If you want to read all files in a directory, enable "Read All Files in Directory" in the node settings.`,
								);
							}

							// If the path is a file, we read it and return the binary data
							return newItem({}, await readFileFromWebDav(path, fileMetadata));
						} else {
							if (fileMetadata.type === 'file') {
								throw new NodeOperationError(
									this.getNode(),
									`The path "${path}" is a file, and you have requested all files in a directory. If you want to read a single file in a directory, disable "Read All Files in Directory" in the node settings.`,
								);
							}

							// If the path is a folder, we read it and return the files within as binary data
							const contents = await getDirectoryContents(path);

							const pLimit = await esmImport('p-limit');
							const limit = pLimit.default(4);

							return (
								await Promise.all(
									contents.map((item) =>
										limit(async () => {
											if (item.type === 'file') {
												// Do actual read of the file
												console.log(`Reading file: ${item.filename}`);
												return newItem(
													{},
													await readFileFromWebDav(item.filename, item),
												);
											}
											return null;
										}),
									),
								)
							).filter((i: any) => i !== null) as INodeExecutionData[];
						}

					default:
						return newItem({});
				}
			};

			if (action === 'uploadFile') {
				return [];
			} else if (action === 'createFolder') {
			}
			return [await query()].flat();
		}

		const executeSingleGraphQL = async (params: Record<string, object | NodeParameterValueType>): Promise<INodeExecutionData[]> => {

			const credentials = await this.getCredentials('bigcommerceGraphQLApi');

			const request = JSON.parse(await this.helpers.request({
				abortSignal: this.getExecutionCancelSignal(),
				url: `https://api.bigcommerce.com/accounts/${credentials.graphQLAccountId}/graphql`,
				method: "POST",
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					'X-Auth-Token': credentials.graphQLToken,
				},
				body: {
					"query": params['graphqlQuery'] as string,
					"variables": JSON.parse(params['graphqlVariables'] as string) || "{}",
				}
			} as IHttpRequestOptions));

			return [{json: request}];
		}

		const safeExecuteSingle = async (itemIndex: number): Promise<INodeExecutionData[]> => {
			try {
				const params = parameters.reduce<Record<string, object | NodeParameterValueType>>(
					(acc, p) => {
						acc[p] = this.getNodeParameter(p, itemIndex);
						return acc;
					},
					{},
				);

				if (params["operation"] === "graphql") {
					return executeSingleGraphQL(params);
				}

				if (params["operation"] === "webdav") {
					return executeSingleWebDav(params, itemIndex);
				}
				return executeSingleREST(params);
			} catch (error) {
				if (this.continueOnFail()) {
					return [{
						json: this.getInputData(itemIndex)[0].json,
						error,
						pairedItem: itemIndex,
					}];
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		const promises = items.map(async (item, itemIndex): Promise<INodeExecutionData[]> => {
			return await safeExecuteSingle(itemIndex);
		});

		return [(await Promise.all(promises)).flat()];
	}
}
