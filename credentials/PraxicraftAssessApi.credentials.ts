import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PraxicraftAssessApi implements ICredentialType {
	name = 'praxicraftAssessApi';

	displayName = 'Praxicraft Assess API';

	documentationUrl = 'https://docs.praxicraft.com/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Organisation API key from Assess → Developer → API Keys (starts with ct_live_)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://assess.praxicraft.com',
			description: 'Assess host (no trailing slash). Override only for staging or custom domains.',
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
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/public/org/',
			method: 'GET',
		},
	};
}
