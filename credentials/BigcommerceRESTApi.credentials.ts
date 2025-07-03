import { ICredentialType, INodeProperties } from 'n8n-workflow';
import {IconFile} from "n8n-workflow/dist/Interfaces";

export class BigcommerceRESTApi implements ICredentialType {

	name = 'bigcommerceApi';
	displayName = 'Bigcommerce - REST API';
	documentationUrl = 'https://developer.bigcommerce.com/';
	icon = "file:bigcommerce-logomark-whitebg.svg" as IconFile;
	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: '[REST] Store Hash',
			name: 'storeHash',
			type: 'string',
			default: '',
			hint: 'The store hash is a unique identifier for your BigCommerce store. It can be found in the URL of your store admin panel, or in your API token file, typically in the format `https://store-name.mybigcommerce.com/manage/` or `https://api.bigcommerce.com/stores/name` where `name` is your store hash.',
			placeholder: 'abc123xyz',
			required: false,
		},
		{
			displayName: '[REST] Access Token',
			name: 'token',
			// eslint-disable-next-line
			type: 'string',
			default: '',
			hint: 'The access token from your API credentials. It <b><u>SHOULD BE A</u></b> 31-character string that authorizes access to your BigCommerce store via the API. You can generate this token in your BigCommerce control panel under "Advanced Settings" > "API Accounts". Do not confuse it with the Client ID or Client Secret, which are used for client imitation OAuth authentication.',
			placeholder: 'your-access-token-as-31char-str',
			required: false,
		}
	];
}
