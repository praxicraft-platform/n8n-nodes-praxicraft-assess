import { createHmac, timingSafeEqual } from 'crypto';

import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IRequestOptions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type AssessContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

/**
 * Public API responses are flat JSON (no { status, data } wrapper).
 * Still unwrap a legacy envelope if present so workflows stay stable.
 */
export function unwrapAssessResponse(body: unknown): IDataObject | IDataObject[] | null {
	if (body === null || body === undefined || body === '') {
		return null;
	}
	if (typeof body !== 'object') {
		return { value: body } as IDataObject;
	}
	const obj = body as IDataObject;
	if (
		typeof obj.status === 'string' &&
		Object.prototype.hasOwnProperty.call(obj, 'data') &&
		(obj.status === 'success' || obj.status === 'ok')
	) {
		return (obj.data as IDataObject | IDataObject[]) ?? null;
	}
	return obj;
}

export async function praxicraftAssessApiRequest(
	this: AssessContext,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject | IDataObject[] | null> {
	const credentials = await this.getCredentials('praxicraftAssessApi');
	const baseUrl = String(credentials.baseUrl || 'https://assess.praxicraft.com').replace(/\/$/, '');
	const urlPath = path.startsWith('/') ? path : `/${path}`;

	const options: IRequestOptions = {
		method,
		url: `${baseUrl}/api/v1/public${urlPath}`,
		qs,
		json: true,
		headers: {
			Accept: 'application/json',
		},
	};

	if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
		options.body = body;
		options.headers = {
			...options.headers,
			'Content-Type': 'application/json',
		};
	} else if (method === 'DELETE' && Object.keys(body).length > 0) {
		options.body = body;
	}

	try {
		const response = await this.helpers.requestWithAuthentication.call(
			this,
			'praxicraftAssessApi',
			options,
		);
		return unwrapAssessResponse(response);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export function verifyPraxicraftSignature(
	secret: string,
	rawBody: string | Buffer,
	signatureHeader: string | undefined,
): boolean {
	if (!signatureHeader || !secret) {
		return false;
	}
	const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
	const a = Buffer.from(expected);
	const b = Buffer.from(signatureHeader);
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}

export const ASSESS_WEBHOOK_EVENTS = [
	{ name: 'Assessment Started', value: 'assessment.started' },
	{ name: 'Assessment Completed', value: 'assessment.completed' },
	{ name: 'Candidate Violation', value: 'candidate.violation' },
	{ name: 'Candidate Passed', value: 'candidate.passed' },
	{ name: 'Candidate Failed', value: 'candidate.failed' },
	{ name: 'Invitation Expired', value: 'invitation.expired' },
	{ name: 'Pipeline Advanced', value: 'pipeline.advanced' },
	{ name: 'Pipeline Completed', value: 'pipeline.completed' },
	{ name: 'Pipeline Rejected', value: 'pipeline.rejected' },
	{ name: 'Interview Scheduled', value: 'interview.scheduled' },
	{ name: 'Interview Started', value: 'interview.started' },
	{ name: 'Interview Completed', value: 'interview.completed' },
	{ name: 'Interview Cancelled', value: 'interview.cancelled' },
	{ name: 'Interview Analysis Ready', value: 'interview.analysis_ready' },
] as const;
