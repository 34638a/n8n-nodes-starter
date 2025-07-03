import { ICredentialType, INodeProperties } from 'n8n-workflow';
import {IconFile} from "n8n-workflow/dist/Interfaces";

export class BigcommerceGraphQLApi implements ICredentialType {

	name = 'bigcommerceGraphQLApi';
	displayName = 'Bigcommerce - GraphQL API';
	documentationUrl = 'https://developer.bigcommerce.com/';
	icon = "file:bigcommerce-logomark-whitebg.svg" as IconFile;
	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: '[GraphQL] Account UUID',
			name: 'graphQLAccountId',
			type: 'string',
			default: '',
			hint: '',
			placeholder: 'ABCDEF01-2345-6789-ABCD-EF0123456789',
			required: false,
		},
		{
			displayName: '[GraphQL] Access Token',
			name: 'graphQLToken',
			// eslint-disable-next-line
			type: 'string',
			default: '',
			hint: '',
			placeholder: 'your-access-token-as-31char-str',
			required: false,
		},
	];
}
