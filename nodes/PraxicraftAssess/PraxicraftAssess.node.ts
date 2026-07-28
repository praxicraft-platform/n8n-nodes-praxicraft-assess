import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { ASSESS_WEBHOOK_EVENTS, praxicraftAssessApiRequest } from './GenericFunctions';

function asObject(value: IDataObject | IDataObject[] | null): IDataObject {
	if (value === null) return {};
	if (Array.isArray(value)) return { results: value };
	return value;
}

function parseJsonParam(
	ctx: IExecuteFunctions,
	name: string,
	itemIndex: number,
	fallback: IDataObject | IDataObject[] = {},
): IDataObject | IDataObject[] {
	const raw = ctx.getNodeParameter(name, itemIndex, fallback) as string | IDataObject | IDataObject[];
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw || (Array.isArray(fallback) ? '[]' : '{}')) as IDataObject | IDataObject[];
		} catch {
			throw new NodeOperationError(ctx.getNode(), `Invalid JSON for ${name}`, { itemIndex });
		}
	}
	return raw;
}

function cursorQs(ctx: IExecuteFunctions, i: number): IDataObject {
	const cursor = ctx.getNodeParameter('cursor', i, '') as string;
	const pageSize = ctx.getNodeParameter('pageSize', i, 0) as number;
	const qs: IDataObject = {};
	if (cursor) qs.cursor = cursor;
	if (pageSize) qs.page_size = pageSize;
	return qs;
}

const paginationFields: INodeProperties[] = [
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		description: 'Opaque cursor from next_cursor / previous_cursor',
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		default: 20,
		typeOptions: { minValue: 1, maxValue: 100 },
	},
];

export class PraxicraftAssess implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Praxicraft Assess',
		name: 'praxicraftAssess',
		icon: {
			light: 'file:praxicraftAssess.light.svg',
			dark: 'file:praxicraftAssess.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Full Praxicraft Assess Public API wrapper (assessments, cases, invites, pipelines, interviews, webhooks)',
		defaults: { name: 'Praxicraft Assess' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'praxicraftAssessApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Assessment', value: 'assessment' },
					{ name: 'Case', value: 'case' },
					{ name: 'Integration', value: 'integration' },
					{ name: 'Interview', value: 'interview' },
					{ name: 'Invitation', value: 'invitation' },
					{ name: 'Organisation', value: 'organisation' },
					{ name: 'Pipeline', value: 'pipeline' },
					{ name: 'Webhook', value: 'webhook' },
				],
				default: 'invitation',
			},

			// ── Assessment ops ──────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['assessment'] } },
				options: [
					{ name: 'Attach Cases', value: 'attachCases', action: 'Attach cases to assessment' },
					{ name: 'Create', value: 'create', action: 'Create an assessment' },
					{ name: 'Duplicate', value: 'duplicate', action: 'Duplicate an assessment' },
					{ name: 'Get', value: 'get', action: 'Get an assessment' },
					{ name: 'List', value: 'list', action: 'List assessments' },
					{ name: 'List Cases', value: 'listCases', action: 'List assessment cases' },
					{ name: 'List Results', value: 'listResults', action: 'List assessment results' },
					{ name: 'Remove Case', value: 'removeCase', action: 'Remove a case from assessment' },
					{ name: 'Replace Cases', value: 'replaceCases', action: 'Replace assessment cases' },
					{ name: 'Update', value: 'update', action: 'Update an assessment' },
				],
				default: 'list',
			},

			// ── Case ops ────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['case'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create an org case' },
					{ name: 'Delete', value: 'delete', action: 'Delete an org case' },
					{ name: 'Get', value: 'get', action: 'Get an org case' },
					{ name: 'List', value: 'list', action: 'List org cases' },
					{ name: 'List Platform Cases', value: 'listPlatform', action: 'List platform case library' },
					{ name: 'Update', value: 'update', action: 'Update an org case' },
				],
				default: 'list',
			},

			// ── Invitation ops ──────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['invitation'] } },
				options: [
					{ name: 'Bulk Invite', value: 'bulkInvite', action: 'Bulk invite candidates' },
					{ name: 'Cancel', value: 'cancel', action: 'Cancel an invitation' },
					{ name: 'Get', value: 'get', action: 'Get an invitation' },
					{ name: 'Get Result', value: 'getResult', action: 'Get invitation result' },
					{ name: 'Invite', value: 'invite', action: 'Invite a candidate' },
					{ name: 'List', value: 'list', action: 'List invitations' },
					{ name: 'Remind', value: 'remind', action: 'Send invite reminder' },
				],
				default: 'invite',
			},

			// ── Pipeline ops ────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['pipeline'] } },
				options: [
					{ name: 'Bulk Enroll', value: 'bulkEnroll', action: 'Bulk enroll candidates' },
					{ name: 'Enroll', value: 'enroll', action: 'Enroll a candidate' },
					{ name: 'Get', value: 'get', action: 'Get a pipeline' },
					{ name: 'Get Enrollment', value: 'getEnrollment', action: 'Get enrollment status' },
					{ name: 'Hold Enrollment', value: 'hold', action: 'Hold an enrollment' },
					{ name: 'List', value: 'list', action: 'List pipelines' },
					{ name: 'List Enrollments', value: 'listEnrollments', action: 'List pipeline enrollments' },
					{ name: 'Reject Enrollment', value: 'reject', action: 'Reject an enrollment' },
					{ name: 'Unhold Enrollment', value: 'unhold', action: 'Unhold an enrollment' },
				],
				default: 'list',
			},

			// ── Webhook ops ─────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['webhook'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create a webhook' },
					{ name: 'Delete', value: 'delete', action: 'Delete a webhook' },
					{ name: 'Get', value: 'get', action: 'Get a webhook' },
					{ name: 'List', value: 'list', action: 'List webhooks' },
					{ name: 'List Deliveries', value: 'listDeliveries', action: 'List webhook deliveries' },
					{ name: 'Test', value: 'test', action: 'Send webhook test ping' },
					{ name: 'Update', value: 'update', action: 'Update a webhook' },
				],
				default: 'create',
			},

			// ── Organisation ops ────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['organisation'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get organisation' },
					{ name: 'Get Squad', value: 'getSquad', action: 'Get a hiring squad' },
					{ name: 'Get Stats', value: 'stats', action: 'Get organisation stats' },
					{ name: 'List Audit Log', value: 'auditLog', action: 'List audit log' },
					{ name: 'List Squad Members', value: 'listSquadMembers', action: 'List squad members' },
					{ name: 'List Squads', value: 'listSquads', action: 'List hiring squads' },
					{ name: 'List Team', value: 'listTeam', action: 'List organisation team' },
				],
				default: 'get',
			},

			// ── Interview ops ───────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['interview'] } },
				options: [
					{ name: 'Analytics', value: 'analytics', action: 'Get interview analytics' },
					{ name: 'Bulk Create', value: 'bulkCreate', action: 'Bulk create interviews' },
					{ name: 'Cancel', value: 'cancel', action: 'Cancel an interview' },
					{ name: 'Create', value: 'create', action: 'Create an interview' },
					{ name: 'Create Template', value: 'createTemplate', action: 'Create interview template' },
					{ name: 'Delete Template', value: 'deleteTemplate', action: 'Delete interview template' },
					{ name: 'Get', value: 'get', action: 'Get an interview' },
					{ name: 'Get Analysis', value: 'analysis', action: 'Get interview analysis' },
					{ name: 'Get Replay', value: 'replay', action: 'Get interview replay' },
					{ name: 'List', value: 'list', action: 'List interviews' },
					{ name: 'List Org Cases', value: 'listOrgCases', action: 'List interview org cases' },
					{ name: 'List Templates', value: 'listTemplates', action: 'List interview templates' },
					{ name: 'Reschedule', value: 'reschedule', action: 'Reschedule an interview' },
					{ name: 'Share', value: 'share', action: 'Share an interview' },
					{ name: 'Update Template', value: 'updateTemplate', action: 'Update interview template' },
				],
				default: 'list',
			},

			// ── Integration ops ─────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['integration'] } },
				options: [
					{ name: 'Get Connect URL', value: 'connect', action: 'Get ATS connect URL' },
					{ name: 'List', value: 'list', action: 'List integrations' },
					{ name: 'Test', value: 'test', action: 'Test an integration' },
				],
				default: 'list',
			},

			// Shared identifiers
			{
				displayName: 'Assessment Slug',
				name: 'assessmentSlug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['assessment'],
						operation: [
							'get',
							'update',
							'duplicate',
							'listResults',
							'listCases',
							'attachCases',
							'replaceCases',
							'removeCase',
						],
					},
				},
			},
			{
				displayName: 'Assessment Slug',
				name: 'assessmentSlug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['invitation'], operation: ['invite', 'bulkInvite'] },
				},
			},
			{
				displayName: 'Case ID',
				name: 'caseId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['case'],
						operation: ['get', 'update', 'delete'],
					},
				},
			},
			{
				displayName: 'Case ID',
				name: 'caseId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['assessment'],
						operation: ['removeCase'],
					},
				},
			},
			{
				displayName: 'Invite Token',
				name: 'inviteToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['invitation'],
						operation: ['get', 'getResult', 'remind', 'cancel'],
					},
				},
			},
			{
				displayName: 'Pipeline Slug',
				name: 'pipelineSlug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['pipeline'],
						operation: ['get', 'enroll', 'bulkEnroll', 'listEnrollments'],
					},
				},
			},
			{
				displayName: 'Enrollment ID',
				name: 'enrollmentId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['pipeline'],
						operation: ['getEnrollment', 'reject', 'hold', 'unhold'],
					},
				},
			},
			{
				displayName: 'Webhook ID',
				name: 'webhookId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['webhook'],
						operation: ['get', 'update', 'delete', 'listDeliveries', 'test'],
					},
				},
			},
			{
				displayName: 'Interview ID',
				name: 'interviewId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['interview'],
						operation: ['get', 'cancel', 'reschedule', 'analysis', 'replay', 'share'],
					},
				},
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['interview'],
						operation: ['updateTemplate', 'deleteTemplate'],
					},
				},
			},
			{
				displayName: 'Squad ID',
				name: 'squadId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['organisation'],
						operation: ['getSquad', 'listSquadMembers'],
					},
				},
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				options: [
					{ name: 'Ashby', value: 'ashby' },
					{ name: 'BambooHR', value: 'bamboohr' },
					{ name: 'Greenhouse', value: 'greenhouse' },
					{ name: 'Lever', value: 'lever' },
					{ name: 'Workday', value: 'workday' },
				],
				default: 'greenhouse',
				displayOptions: {
					show: { resource: ['integration'], operation: ['connect', 'test'] },
				},
			},

			// Invite fields
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['invitation', 'pipeline'],
						operation: ['invite', 'enroll'],
					},
				},
			},
			{
				displayName: 'Name',
				name: 'candidateName',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['invitation', 'pipeline'],
						operation: ['invite', 'enroll'],
					},
				},
			},
			{
				displayName: 'Send Email',
				name: 'sendEmail',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['invitation', 'pipeline'],
						operation: ['invite', 'bulkInvite', 'enroll', 'bulkEnroll'],
					},
				},
			},
			{
				displayName: 'Expires Days',
				name: 'expiresDays',
				type: 'number',
				default: 7,
				displayOptions: {
					show: { resource: ['invitation'], operation: ['invite', 'bulkInvite'] },
				},
			},
			{
				displayName: 'Candidates (JSON)',
				name: 'candidatesJson',
				type: 'json',
				default: '[{"email":"a@example.com","name":"Alex"}]',
				displayOptions: {
					show: {
						resource: ['invitation', 'pipeline', 'interview'],
						operation: ['bulkInvite', 'bulkEnroll', 'bulkCreate'],
					},
				},
			},

			// Webhook create/update
			{
				displayName: 'URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['webhook'], operation: ['create', 'update'] },
				},
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: ['assessment.completed', 'candidate.passed'],
				options: [...ASSESS_WEBHOOK_EVENTS],
				displayOptions: {
					show: { resource: ['webhook'], operation: ['create', 'update'] },
				},
			},

			// Reject reason
			{
				displayName: 'Reject Reason',
				name: 'rejectReason',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['pipeline'], operation: ['reject'] },
				},
			},

			// Generic JSON body for create/update (full Public API fields)
			{
				displayName: 'Body (JSON)',
				name: 'bodyJson',
				type: 'json',
				default: '{}',
				description:
					'Request body for create/update operations. Merged with simple fields when both are set. See Public API docs.',
				displayOptions: {
					show: {
						resource: ['assessment', 'case', 'interview', 'webhook'],
						operation: [
							'create',
							'update',
							'attachCases',
							'replaceCases',
							'createTemplate',
							'updateTemplate',
							'reschedule',
							'share',
							'cancel',
						],
					},
				},
			},
			{
				displayName: 'Case IDs (JSON Array)',
				name: 'caseIdsJson',
				type: 'json',
				default: '[]',
				displayOptions: {
					show: {
						resource: ['assessment'],
						operation: ['attachCases', 'replaceCases'],
					},
				},
			},

			// Pagination for list ops
			...paginationFields.map((field) => ({
				...field,
				displayOptions: {
					show: {
						resource: [
							'assessment',
							'case',
							'invitation',
							'pipeline',
							'webhook',
							'organisation',
							'interview',
						],
						operation: [
							'list',
							'listResults',
							'listCases',
							'listPlatform',
							'listEnrollments',
							'listDeliveries',
							'listSquads',
							'listSquadMembers',
							'listTeam',
							'auditLog',
							'listTemplates',
							'listOrgCases',
						],
					},
				},
			})),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let response: IDataObject | IDataObject[] | null = null;
				let method: IHttpRequestMethods = 'GET';
				let path = '';
				let body: IDataObject = {};
				let qs: IDataObject = {};

				const enc = (v: string) => encodeURIComponent(v);

				if (resource === 'assessment') {
					const slug = () => enc(this.getNodeParameter('assessmentSlug', i) as string);
					if (operation === 'list') {
						path = '/assessments/';
						qs = cursorQs(this, i);
					} else if (operation === 'get') {
						path = `/assessments/${slug()}/`;
					} else if (operation === 'create') {
						method = 'POST';
						path = '/assessments/create/';
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'update') {
						method = 'PATCH';
						path = `/assessments/${slug()}/update/`;
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'duplicate') {
						method = 'POST';
						path = `/assessments/${slug()}/duplicate/`;
					} else if (operation === 'listResults') {
						path = `/assessments/${slug()}/results/`;
						qs = cursorQs(this, i);
					} else if (operation === 'listCases') {
						path = `/assessments/${slug()}/cases/`;
						qs = cursorQs(this, i);
					} else if (operation === 'attachCases') {
						method = 'POST';
						path = `/assessments/${slug()}/cases/attach/`;
						const caseIds = parseJsonParam(this, 'caseIdsJson', i, []) as IDataObject[];
						const extra = parseJsonParam(this, 'bodyJson', i) as IDataObject;
						body = { case_ids: caseIds, ...extra };
					} else if (operation === 'replaceCases') {
						method = 'PUT';
						path = `/assessments/${slug()}/cases/replace/`;
						const caseIds = parseJsonParam(this, 'caseIdsJson', i, []) as IDataObject[];
						const extra = parseJsonParam(this, 'bodyJson', i) as IDataObject;
						body = { case_ids: caseIds, ...extra };
					} else if (operation === 'removeCase') {
						method = 'DELETE';
						path = `/assessments/${slug()}/cases/remove/`;
						body = { case_id: this.getNodeParameter('caseId', i) as string };
					}
				} else if (resource === 'case') {
					if (operation === 'list') {
						path = '/cases/';
						qs = cursorQs(this, i);
					} else if (operation === 'listPlatform') {
						path = '/platform-cases/';
						qs = cursorQs(this, i);
					} else if (operation === 'create') {
						method = 'POST';
						path = '/cases/create/';
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'get') {
						path = `/cases/${enc(this.getNodeParameter('caseId', i) as string)}/`;
					} else if (operation === 'update') {
						method = 'PATCH';
						path = `/cases/${enc(this.getNodeParameter('caseId', i) as string)}/`;
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'delete') {
						method = 'DELETE';
						path = `/cases/${enc(this.getNodeParameter('caseId', i) as string)}/`;
					}
				} else if (resource === 'invitation') {
					if (operation === 'list') {
						path = '/invites/';
						qs = cursorQs(this, i);
					} else if (operation === 'invite') {
						method = 'POST';
						const slug = enc(this.getNodeParameter('assessmentSlug', i) as string);
						path = `/assessments/${slug}/invites/`;
						const name = this.getNodeParameter('candidateName', i, '') as string;
						body = {
							email: this.getNodeParameter('email', i) as string,
							send_email: this.getNodeParameter('sendEmail', i) as boolean,
							expires_days: this.getNodeParameter('expiresDays', i) as number,
						};
						if (name) body.name = name;
					} else if (operation === 'bulkInvite') {
						method = 'POST';
						const slug = enc(this.getNodeParameter('assessmentSlug', i) as string);
						path = `/assessments/${slug}/invites/bulk/`;
						body = {
							candidates: parseJsonParam(this, 'candidatesJson', i, []) as IDataObject[],
							send_email: this.getNodeParameter('sendEmail', i) as boolean,
							expires_days: this.getNodeParameter('expiresDays', i) as number,
						};
					} else if (operation === 'get') {
						path = `/invites/${enc(this.getNodeParameter('inviteToken', i) as string)}/`;
					} else if (operation === 'getResult') {
						path = `/invites/${enc(this.getNodeParameter('inviteToken', i) as string)}/result/`;
					} else if (operation === 'remind') {
						method = 'POST';
						path = `/invites/${enc(this.getNodeParameter('inviteToken', i) as string)}/remind/`;
					} else if (operation === 'cancel') {
						method = 'DELETE';
						path = `/invites/${enc(this.getNodeParameter('inviteToken', i) as string)}/`;
					}
				} else if (resource === 'pipeline') {
					if (operation === 'list') {
						path = '/pipelines/';
						qs = cursorQs(this, i);
					} else if (operation === 'get') {
						path = `/pipelines/${enc(this.getNodeParameter('pipelineSlug', i) as string)}/`;
					} else if (operation === 'enroll') {
						method = 'POST';
						path = `/pipelines/${enc(this.getNodeParameter('pipelineSlug', i) as string)}/enroll/`;
						const name = this.getNodeParameter('candidateName', i, '') as string;
						body = {
							email: this.getNodeParameter('email', i) as string,
							send_email: this.getNodeParameter('sendEmail', i) as boolean,
						};
						if (name) body.name = name;
					} else if (operation === 'bulkEnroll') {
						method = 'POST';
						path = `/pipelines/${enc(this.getNodeParameter('pipelineSlug', i) as string)}/enroll/bulk/`;
						body = {
							candidates: parseJsonParam(this, 'candidatesJson', i, []) as IDataObject[],
							send_email: this.getNodeParameter('sendEmail', i) as boolean,
						};
					} else if (operation === 'listEnrollments') {
						path = `/pipelines/${enc(this.getNodeParameter('pipelineSlug', i) as string)}/enrollments/`;
						qs = cursorQs(this, i);
					} else if (operation === 'getEnrollment') {
						path = `/pipelines/enrollments/${enc(this.getNodeParameter('enrollmentId', i) as string)}/`;
					} else if (operation === 'reject') {
						method = 'POST';
						path = `/pipelines/enrollments/${enc(this.getNodeParameter('enrollmentId', i) as string)}/reject/`;
						const reason = this.getNodeParameter('rejectReason', i, '') as string;
						if (reason) body = { reason };
					} else if (operation === 'hold') {
						method = 'POST';
						path = `/pipelines/enrollments/${enc(this.getNodeParameter('enrollmentId', i) as string)}/hold/`;
					} else if (operation === 'unhold') {
						method = 'POST';
						path = `/pipelines/enrollments/${enc(this.getNodeParameter('enrollmentId', i) as string)}/unhold/`;
					}
				} else if (resource === 'webhook') {
					if (operation === 'list') {
						path = '/webhooks/';
						qs = cursorQs(this, i);
					} else if (operation === 'create') {
						method = 'POST';
						path = '/webhooks/create/';
						const extra = parseJsonParam(this, 'bodyJson', i) as IDataObject;
						body = {
							url: this.getNodeParameter('webhookUrl', i) as string,
							events: this.getNodeParameter('events', i) as string[],
							...extra,
						};
					} else if (operation === 'get') {
						path = `/webhooks/${enc(this.getNodeParameter('webhookId', i) as string)}/`;
					} else if (operation === 'update') {
						method = 'PATCH';
						path = `/webhooks/${enc(this.getNodeParameter('webhookId', i) as string)}/`;
						const extra = parseJsonParam(this, 'bodyJson', i) as IDataObject;
						body = { ...extra };
						const url = this.getNodeParameter('webhookUrl', i, '') as string;
						const events = this.getNodeParameter('events', i, []) as string[];
						if (url) body.url = url;
						if (events?.length) body.events = events;
					} else if (operation === 'delete') {
						method = 'DELETE';
						path = `/webhooks/${enc(this.getNodeParameter('webhookId', i) as string)}/`;
					} else if (operation === 'listDeliveries') {
						path = `/webhooks/${enc(this.getNodeParameter('webhookId', i) as string)}/deliveries/`;
						qs = cursorQs(this, i);
					} else if (operation === 'test') {
						method = 'POST';
						path = `/webhooks/${enc(this.getNodeParameter('webhookId', i) as string)}/test/`;
					}
				} else if (resource === 'organisation') {
					if (operation === 'get') path = '/org/';
					else if (operation === 'stats') path = '/org/stats/';
					else if (operation === 'listTeam') {
						path = '/org/team/';
						qs = cursorQs(this, i);
					} else if (operation === 'listSquads') {
						path = '/org/squads/';
						qs = cursorQs(this, i);
					} else if (operation === 'getSquad') {
						path = `/org/squads/${enc(this.getNodeParameter('squadId', i) as string)}/`;
					} else if (operation === 'listSquadMembers') {
						path = `/org/squads/${enc(this.getNodeParameter('squadId', i) as string)}/members/`;
						qs = cursorQs(this, i);
					} else if (operation === 'auditLog') {
						path = '/org/audit-log/';
						qs = cursorQs(this, i);
					}
				} else if (resource === 'interview') {
					const id = () => enc(this.getNodeParameter('interviewId', i) as string);
					if (operation === 'list') {
						path = '/interviews/';
						qs = cursorQs(this, i);
					} else if (operation === 'create') {
						method = 'POST';
						path = '/interviews/create/';
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'bulkCreate') {
						method = 'POST';
						path = '/interviews/bulk/';
						body = {
							candidates: parseJsonParam(this, 'candidatesJson', i, []) as IDataObject[],
							...(parseJsonParam(this, 'bodyJson', i) as IDataObject),
						};
					} else if (operation === 'get') {
						path = `/interviews/${id()}/`;
					} else if (operation === 'cancel') {
						method = 'POST';
						path = `/interviews/${id()}/cancel/`;
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'reschedule') {
						method = 'POST';
						path = `/interviews/${id()}/reschedule/`;
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'analysis') {
						path = `/interviews/${id()}/analysis/`;
					} else if (operation === 'replay') {
						path = `/interviews/${id()}/replay/`;
					} else if (operation === 'share') {
						method = 'POST';
						path = `/interviews/${id()}/share/`;
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'analytics') {
						path = '/interviews/analytics/';
					} else if (operation === 'listTemplates') {
						path = '/interviews/templates/';
						qs = cursorQs(this, i);
					} else if (operation === 'createTemplate') {
						method = 'POST';
						path = '/interviews/templates/create/';
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'updateTemplate') {
						method = 'PATCH';
						path = `/interviews/templates/${enc(this.getNodeParameter('templateId', i) as string)}/update/`;
						body = parseJsonParam(this, 'bodyJson', i) as IDataObject;
					} else if (operation === 'deleteTemplate') {
						method = 'DELETE';
						path = `/interviews/templates/${enc(this.getNodeParameter('templateId', i) as string)}/delete/`;
					} else if (operation === 'listOrgCases') {
						path = '/interviews/org-cases/';
						qs = cursorQs(this, i);
					}
				} else if (resource === 'integration') {
					if (operation === 'list') path = '/integrations/';
					else if (operation === 'connect') {
						path = `/integrations/${enc(this.getNodeParameter('provider', i) as string)}/connect/`;
					} else if (operation === 'test') {
						method = 'POST';
						path = `/integrations/${enc(this.getNodeParameter('provider', i) as string)}/test/`;
					}
				}

				if (!path) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation ${resource}.${operation}`,
						{ itemIndex: i },
					);
				}

				response = await praxicraftAssessApiRequest.call(this, method, path, body, qs);
				if (response === null && method === 'DELETE') {
					response = { ok: true, resource, operation };
				}

				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(asObject(response)), {
						itemData: { item: i },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
