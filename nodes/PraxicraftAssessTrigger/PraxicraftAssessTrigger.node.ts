import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	ASSESS_WEBHOOK_EVENTS,
	praxicraftAssessApiRequest,
	verifyPraxicraftSignature,
} from '../PraxicraftAssess/GenericFunctions';

type WebhookStaticData = {
	webhookId?: string;
	webhookSecret?: string;
};

export class PraxicraftAssessTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Praxicraft Assess Trigger',
		name: 'praxicraftAssessTrigger',
		icon: {
			light: 'file:praxicraftAssess.light.svg',
			dark: 'file:praxicraftAssess.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Assess sends a signed webhook event',
		defaults: {
			name: 'Praxicraft Assess Trigger',
		},
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'praxicraftAssessApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['assessment.completed', 'candidate.passed', 'candidate.failed'],
				description:
					'Events to register with Assess when this workflow is activated. webhook.test is always subscribed by Assess for verification.',
				options: [...ASSESS_WEBHOOK_EVENTS],
			},
			{
				displayName: 'Ignore Test Events',
				name: 'ignoreTestEvents',
				type: 'boolean',
				default: true,
				description: 'Whether to acknowledge webhook.test pings without starting the workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node') as WebhookStaticData;
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookData.webhookId) {
					return false;
				}

				try {
					const response = await praxicraftAssessApiRequest.call(
						this,
						'GET',
						`/webhooks/${encodeURIComponent(webhookData.webhookId)}/`,
					);
					const data = response as IDataObject;
					return data?.url === webhookUrl;
				} catch (error) {
					delete webhookData.webhookId;
					delete webhookData.webhookSecret;
					const message = error instanceof Error ? error.message : String(error);
					if (!/404|not found|does not exist/i.test(message)) {
						throw new NodeApiError(this.getNode(), error as JsonObject);
					}
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				const webhookData = this.getWorkflowStaticData('node') as WebhookStaticData;

				if (!webhookUrl) {
					throw new NodeOperationError(
						this.getNode(),
						'Could not resolve the n8n webhook URL for this trigger',
					);
				}
				if (!events?.length) {
					throw new NodeOperationError(this.getNode(), 'Select at least one event');
				}

				const created = (await praxicraftAssessApiRequest.call(this, 'POST', '/webhooks/create/', {
					url: webhookUrl,
					events,
				})) as IDataObject;

				webhookData.webhookId = String(created.id);
				if (typeof created.secret_key === 'string' && created.secret_key.startsWith('whsec_')) {
					webhookData.webhookSecret = created.secret_key;
				}

				// Activate: Assess requires a successful test ping before delivering live events.
				await praxicraftAssessApiRequest.call(
					this,
					'POST',
					`/webhooks/${encodeURIComponent(String(created.id))}/test/`,
				);

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node') as WebhookStaticData;
				if (!webhookData.webhookId) {
					return true;
				}

				try {
					await praxicraftAssessApiRequest.call(
						this,
						'DELETE',
						`/webhooks/${encodeURIComponent(webhookData.webhookId)}/`,
					);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					delete webhookData.webhookId;
					delete webhookData.webhookSecret;
					// Remote endpoint may already be gone
					if (!/404|not found|does not exist/i.test(message)) {
						throw new NodeApiError(this.getNode(), error as JsonObject, {
							message: `Failed to delete Assess webhook: ${message}`,
						});
					}
					return true;
				}

				delete webhookData.webhookId;
				delete webhookData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const headerData = this.getHeaderData();
		const webhookData = this.getWorkflowStaticData('node') as WebhookStaticData;
		const ignoreTestEvents = this.getNodeParameter('ignoreTestEvents') as boolean;
		const selectedEvents = this.getNodeParameter('events') as string[];

		const signatureHeader =
			(headerData['x-praxicraft-signature'] as string | undefined) ||
			(headerData['X-Praxicraft-Signature'] as string | undefined);
		const eventHeader =
			(headerData['x-praxicraft-event'] as string | undefined) ||
			(headerData['X-Praxicraft-Event'] as string | undefined);

		const rawBody =
			typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)
				? req.rawBody
				: JSON.stringify(req.body ?? {});

		const secret = webhookData.webhookSecret;
		if (secret) {
			const ok = verifyPraxicraftSignature(secret, rawBody, signatureHeader);
			if (!ok) {
				throw new NodeOperationError(this.getNode(), 'Invalid X-Praxicraft-Signature');
			}
		}

		const body = (this.getBodyData() || {}) as IDataObject;
		const eventName =
			eventHeader || (typeof body.event === 'string' ? body.event : undefined) || '';

		if (ignoreTestEvents && eventName === 'webhook.test') {
			return {
				webhookResponse: { status: 'ok' },
				workflowData: [[]],
			};
		}

		if (
			eventName &&
			eventName !== 'webhook.test' &&
			selectedEvents.length > 0 &&
			!selectedEvents.includes(eventName)
		) {
			return {
				webhookResponse: { status: 'ignored' },
				workflowData: [[]],
			};
		}

		return {
			webhookResponse: { status: 'ok' },
			workflowData: [this.helpers.returnJsonArray([{ ...body, event: eventName || body.event }])],
		};
	}
}
