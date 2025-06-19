import { ICredentialType, INodeProperties } from 'n8n-workflow';

//eslint-disable
export class BigcommerceWebDavApi implements ICredentialType {
	//eslint-disable
	name = 'bigcommerceWebDavCredentialsApi';
	displayName = 'Bigcommerce WebDav API';
	documentationUrl = 'https://developer.bigcommerce.com/';
	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: 'Store URL',
			name: 'storeUrl',
			type: 'string',
			default: '',
			hint: 'Your store backend URL, typically in the format `https://store-name.mybigcommerce.com/`',
			placeholder: 'https://store-name.mybigcommerce.com/',
			required: true,
		},
		{
			displayName: 'Staff Username',
			name: 'username',
			type: 'string',
			default: '',
			hint: 'The username for your staff login. It <b><u>IS</u></b> the same as your BigCommerce staff login.',
			placeholder: 'your-login@staff.email',
			required: true,

		},
		{
			displayName: 'Staff WebDav Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			hint: 'The password from your WebDav credentials. It <b><u>IS NOT</u></b> the same as your BigCommerce staff login. This password is generated from your staff account in the BigCommerce backend by a store administrator. See User Guide for more details.',
			placeholder: 'your-webdav-access-password',
			required: true,

		}
	];
}
