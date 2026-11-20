import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HagbardApi implements ICredentialType {
	name = 'hagbardApi';

	displayName = 'Hagbard API';

	icon: Icon = { light: 'file:../nodes/Hagbard/hagbard.svg', dark: 'file:../nodes/Hagbard/hagbard.dark.svg' };

	documentationUrl = 'https://github.com/Hagbard-Studio/n8n-nodes-hagbard#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create a key in Hagbard under Settings → API (paid and lifetime plans)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://app.hagbard.studio/api/v1',
			url: '/me',
		},
	};
}
