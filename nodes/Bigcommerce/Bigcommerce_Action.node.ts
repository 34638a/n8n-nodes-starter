import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeParameterValueType,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { setTimeout as delay } from 'timers/promises';
import querystring from 'querystring';

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
		usableAsTool: true,
		credentials: [
			{
				name: 'bigcommerceApi',
				required: true,
			},
		],
		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'REST or GraphQL',
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
				],
				default: 'rest',
				required: true,
			},
			{
				displayName: "GraphQL Query String",
				name: 'graphqlQuery',
				type: 'string',
				default: '',
				description:
					'The GraphQL query string to execute. This should be a valid GraphQL query. Check the BigCommerce API documentation for available queries.',
				required: true,
				validateType: 'string',
				displayOptions: {
					show: {
						operation: ['graphql'],
					}
				}
			},
			{
				displayName: 'GraphQL Variables',
				name: 'graphqlVariables',
				type: 'json',
				default: '{}',
				description:
					'Optional variables to include in the GraphQL query. This should be a valid JSON object.',
				hint: 'This should be a valid JSON object. The variables will be passed to the GraphQL query as variables. For example, if your query is `query($id: ID!) { product(id: $id) { name } }`, you can pass the variable as `{"id": 123}`.',
				displayOptions: {
					show: {
						operation: ['graphql'],
					}
				}
			},
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
				displayOptions: {
					show: {
						operation: ['rest'],
					}
				}
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
				required: true,
				displayOptions: {
					show: {
						operation: ['rest'],
					}
				}
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'json',
				placeholder: 'Add Query Parameter',
				default: '{}',
				description:
					'Optional query parameters to include in the API request. These will be appended to the URL as query strings.',
				hint: "If bigcommerce specifies a array/list of items as your input. For example `id:in`, and your data is a JS Array: `[1,2,3]`, you can use the expression `{{ $json.id.join(',') }}` to convert it to a comma-separated string. This is necessary because Bigcommerce does not support array inputs in query parameters.",
				displayOptions: {
					show: {
						operation: ['rest'],
					}
				}
			},
			{
				displayName: 'Body JSON',
				name: 'bodyParameters',
				type: 'json',
				default: '{}',
				placeholder: '{"key": "value"}',
				description:
					'Optional body parameters to include in the API request. This is typically used for POST and PUT requests where you need to send data to the server.',
				hint: 'This should be a valid JSON object. If you need to send an array, as the body, be sure to wrap the entire input `[{"text": "value1"}, {"text": "value2"}` in square brackets. BigCommerce API expects the body to be an array for certain endpoints.`',
				displayOptions: {
					show: {
						operation: ['rest'],
					}
				}
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
					},
				],
				displayOptions: {
					show: {
						operation: ['rest'],
					}
				}
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('bigcommerceApi');
		const parameters = Object.keys(this.getNode().parameters);

		const executeSingleREST = async (
			params: Record<string, object | NodeParameterValueType>,
		): Promise<INodeExecutionData[]> => {
			const specialOptions = params['specialOptions'] as IDataObject;
			const backoff429: boolean = specialOptions['backoff429'] as boolean;
			const autoPaginate: boolean = specialOptions['autoPaginate'] as boolean;
			const autoPaginateOverride: boolean = specialOptions['autoPaginateOverride'] as boolean;

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

		const executeSingleGraphQL = async (params: Record<string, object | NodeParameterValueType>): Promise<INodeExecutionData[]> => {

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
