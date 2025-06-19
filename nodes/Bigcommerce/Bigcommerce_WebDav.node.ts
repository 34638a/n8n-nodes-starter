// eslint-disable
import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeParameterValueType,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { AuthType, createClient, FileStat } from './webdav';
import pLimit from "p-limit";

export class Bigcommerce_WebDav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Access Bigcommerce WebDav',
		icon: 'file:bigcommerce-logomark-whitebg.svg',
		name: 'bigcommerceWebDavNode',
		group: ['transform'],
		version: 1,
		description: 'Interact with the Bigcommerce WebDav file management system',
		defaults: {
			name: 'Access Bigcommerce WebDav',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'bigcommerceWebDavCredentialsApi',
				required: true,
			},
		],
		properties: [
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('bigcommerceWebDavCredentialsApi');
		const parameters = Object.keys(this.getNode().parameters);


		const client = createClient(credentials.storeUrl as string, {
			authType: AuthType.Digest,
			username: credentials.username as string,
			password: credentials.password as string,
		});

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

		const executeSingle = async (
			params: Record<string, object | NodeParameterValueType>,
			itemIndex: number = 0,
		): Promise<INodeExecutionData[]> => {
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
							const limit = pLimit(4);

							return (
								await Promise.all(
									contents.map((item) => limit(async () => {
										if (item.type === 'file') {
											// Do actual read of the file
											console.log(`Reading file: ${item.filename}`);
											return newItem(
												{},
												await readFileFromWebDav(item.filename, item),
											);
										}
										return null;
									}))
								)
							).filter((i:any) => i !== null) as INodeExecutionData[];
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
		};

		const safeExecuteSingle = async (itemIndex: number): Promise<INodeExecutionData[]> => {
			try {
				const params = parameters.reduce<Record<string, object | NodeParameterValueType>>(
					(acc, p) => {
						acc[p] = this.getNodeParameter(p, itemIndex);
						return acc;
					},
					{},
				);

				return executeSingle(params, itemIndex);
			} catch (error) {
				if (this.continueOnFail()) {
					return [
						{
							json: this.getInputData(itemIndex)[0].json,
							error,
							pairedItem: itemIndex,
						},
					];
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
		};

		const promises = items.map(async (item, itemIndex): Promise<INodeExecutionData[]> => {
			return await safeExecuteSingle(itemIndex);
		});

		return [(await Promise.all(promises)).flat()];
	}
}
