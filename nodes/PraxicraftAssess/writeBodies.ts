import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

function trimString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function parseCommaIds(raw: string): string[] {
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function collection(ctx: IExecuteFunctions, name: string, itemIndex: number): IDataObject {
	return (ctx.getNodeParameter(name, itemIndex, {}) as IDataObject) || {};
}

function assignDefined(target: IDataObject, source: IDataObject): void {
	for (const [key, value] of Object.entries(source)) {
		if (value === '' || value === undefined || value === null) continue;
		target[key] = value;
	}
}

function candidatesFromFixedCollection(
	ctx: IExecuteFunctions,
	itemIndex: number,
	paramName = 'candidatesUi',
): IDataObject[] {
	const raw = ctx.getNodeParameter(paramName, itemIndex, {}) as {
		candidate?: Array<{ email?: string; name?: string; resume_text?: string }>;
	};
	const rows = raw.candidate || [];
	return rows
		.map((row) => {
			const email = trimString(row.email);
			if (!email) return null;
			const out: IDataObject = { email };
			const name = trimString(row.name);
			if (name) out.name = name;
			const resume = trimString(row.resume_text);
			if (resume) out.resume_text = resume;
			return out;
		})
		.filter((row): row is IDataObject => row !== null);
}

export function taskIdsFromField(ctx: IExecuteFunctions, itemIndex: number): string[] {
	return parseCommaIds(ctx.getNodeParameter('taskIds', itemIndex, '') as string);
}

export function buildTaskWriteBody(
	ctx: IExecuteFunctions,
	itemIndex: number,
	mode: 'create' | 'update',
): IDataObject {
	const body: IDataObject = {};
	const title = trimString(ctx.getNodeParameter('taskTitle', itemIndex, ''));
	const question = ctx.getNodeParameter('taskQuestion', itemIndex, '') as string;
	const description = ctx.getNodeParameter('taskDescription', itemIndex, '') as string;

	if (mode === 'create') {
		if (!title) {
			throw new NodeOperationError(ctx.getNode(), 'Title is required to create a task', {
				itemIndex,
			});
		}
		body.title = title;
		body.task_type = ctx.getNodeParameter('taskType', itemIndex, 'mcq') as string;
		body.difficulty = ctx.getNodeParameter('taskDifficulty', itemIndex, 'medium') as string;
		body.points = ctx.getNodeParameter('taskPoints', itemIndex, 10) as number;
		body.question = question;
		body.description = description;
	} else {
		if (title) body.title = title;
		if (question !== '') body.question = question;
		if (description !== '') body.description = description;
		const taskType = ctx.getNodeParameter('taskType', itemIndex, '') as string;
		if (taskType) body.task_type = taskType;
		const difficulty = ctx.getNodeParameter('taskDifficulty', itemIndex, '') as string;
		if (difficulty) body.difficulty = difficulty;
	}

	const extra = collection(ctx, 'taskAdditionalFields', itemIndex);
	assignDefined(body, extra);

	const optionsRaw = ctx.getNodeParameter('taskOptionsUi', itemIndex, {}) as {
		option?: Array<{ id?: string; text?: string; is_correct?: boolean }>;
	};
	const options = (optionsRaw.option || [])
		.map((opt) => {
			const text = trimString(opt.text);
			if (!text) return null;
			return {
				id: trimString(opt.id) || text.slice(0, 8).toLowerCase(),
				text,
				is_correct: Boolean(opt.is_correct),
			};
		})
		.filter(Boolean);
	if (options.length) body.options = options;

	const tagsRaw = trimString(ctx.getNodeParameter('taskTags', itemIndex, ''));
	if (tagsRaw) body.tags = parseCommaIds(tagsRaw);

	if (mode === 'update' && Object.keys(body).length === 0) {
		throw new NodeOperationError(ctx.getNode(), 'Set at least one task field to update', {
			itemIndex,
		});
	}
	return body;
}

export function buildWebhookWriteBody(
	ctx: IExecuteFunctions,
	itemIndex: number,
	mode: 'create' | 'update',
): IDataObject {
	const body: IDataObject = {};
	const url = trimString(ctx.getNodeParameter('webhookUrl', itemIndex, ''));
	const events = ctx.getNodeParameter('events', itemIndex, []) as string[];

	if (mode === 'create') {
		if (!url) {
			throw new NodeOperationError(ctx.getNode(), 'Webhook URL is required', { itemIndex });
		}
		if (!events?.length) {
			throw new NodeOperationError(ctx.getNode(), 'Select at least one event', { itemIndex });
		}
		body.url = url;
		body.events = events;
	} else {
		if (url) body.url = url;
		if (events?.length) body.events = events;
		const isActive = ctx.getNodeParameter('webhookIsActive', itemIndex, '') as string;
		if (isActive === 'true') body.is_active = true;
		if (isActive === 'false') body.is_active = false;
	}

	if (mode === 'update' && Object.keys(body).length === 0) {
		throw new NodeOperationError(ctx.getNode(), 'Set URL, events, or active state to update', {
			itemIndex,
		});
	}
	return body;
}

export function buildInterviewWriteBody(
	ctx: IExecuteFunctions,
	itemIndex: number,
	mode: 'create' | 'bulk',
): IDataObject {
	const body: IDataObject = {
		title: trimString(ctx.getNodeParameter('interviewTitle', itemIndex, '')) || 'AI Screening Interview',
		interviewer_mode: ctx.getNodeParameter('interviewerMode', itemIndex, 'ai_only') as string,
		interview_type: ctx.getNodeParameter('interviewType', itemIndex, 'mixed') as string,
		send_invite: ctx.getNodeParameter('interviewSendInvite', itemIndex, true) as boolean,
	};

	const jobDescription = ctx.getNodeParameter('jobDescription', itemIndex, '') as string;
	const resumeText = ctx.getNodeParameter('resumeText', itemIndex, '') as string;
	if (jobDescription) body.job_description = jobDescription;
	if (resumeText) body.resume_text = resumeText;

	const scheduledAt = trimString(ctx.getNodeParameter('scheduledAt', itemIndex, ''));
	if (scheduledAt) body.scheduled_at = scheduledAt;

	const extra = collection(ctx, 'interviewAdditionalFields', itemIndex);
	assignDefined(body, extra);

	const codingIds = parseCommaIds(ctx.getNodeParameter('codingTaskIds', itemIndex, '') as string);
	const orgIds = parseCommaIds(ctx.getNodeParameter('orgTaskIds', itemIndex, '') as string);
	if (codingIds.length) body.coding_task_ids = codingIds;
	if (orgIds.length) body.org_task_ids = orgIds;

	const persona = collection(ctx, 'interviewPersona', itemIndex);
	if (Object.keys(persona).length) body.persona = persona;

	if (mode === 'create') {
		const email = trimString(ctx.getNodeParameter('interviewCandidateEmail', itemIndex, ''));
		if (!email) {
			throw new NodeOperationError(ctx.getNode(), 'Candidate Email is required', { itemIndex });
		}
		body.candidate_email = email;
		const name = trimString(ctx.getNodeParameter('interviewCandidateName', itemIndex, ''));
		if (name) body.candidate_name = name;
	} else {
		const candidates = candidatesFromFixedCollection(ctx, itemIndex, 'interviewCandidatesUi');
		if (!candidates.length) {
			throw new NodeOperationError(ctx.getNode(), 'Add at least one candidate', { itemIndex });
		}
		body.candidates = candidates;
	}

	return body;
}

export function buildInterviewRescheduleBody(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
	const scheduledAt = trimString(ctx.getNodeParameter('scheduledAt', itemIndex, ''));
	if (!scheduledAt) {
		throw new NodeOperationError(ctx.getNode(), 'Scheduled At is required to reschedule', {
			itemIndex,
		});
	}
	return { scheduled_at: scheduledAt };
}

export function buildInterviewShareBody(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
	return {
		expires_days: ctx.getNodeParameter('shareExpiresDays', itemIndex, 14) as number,
	};
}

export function buildTemplateWriteBody(
	ctx: IExecuteFunctions,
	itemIndex: number,
	mode: 'create' | 'update',
): IDataObject {
	const body: IDataObject = {};
	const name = trimString(ctx.getNodeParameter('templateName', itemIndex, ''));
	if (mode === 'create') {
		if (!name) {
			throw new NodeOperationError(ctx.getNode(), 'Template Name is required', { itemIndex });
		}
		body.name = name;
	} else if (name) {
		body.name = name;
	}

	const configRaw = ctx.getNodeParameter('templateConfig', itemIndex, '') as string;
	if (configRaw && configRaw.trim() && configRaw.trim() !== '{}') {
		try {
			body.config = JSON.parse(configRaw) as IDataObject;
		} catch {
			throw new NodeOperationError(ctx.getNode(), 'Template Config must be valid JSON', {
				itemIndex,
			});
		}
	} else if (mode === 'create') {
		body.config = {};
	}

	if (mode === 'update' && Object.keys(body).length === 0) {
		throw new NodeOperationError(ctx.getNode(), 'Set Name and/or Config to update the template', {
			itemIndex,
		});
	}
	return body;
}

export function buildCandidatesBody(
	ctx: IExecuteFunctions,
	itemIndex: number,
	extras: IDataObject = {},
): IDataObject {
	const candidates = candidatesFromFixedCollection(ctx, itemIndex);
	if (!candidates.length) {
		throw new NodeOperationError(ctx.getNode(), 'Add at least one candidate', { itemIndex });
	}
	return { candidates, ...extras };
}

export const candidatesUiProperty = (ops: {
	resource: string[];
	operation: string[];
}): INodeProperties => ({
	displayName: 'Candidates',
	name: 'candidatesUi',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Candidate',
	default: {},
	required: true,
	displayOptions: { show: ops },
	options: [
		{
			name: 'candidate',
			displayName: 'Candidate',
			values: [
				{
					displayName: 'Email',
					name: 'email',
					type: 'string',
					placeholder: 'name@email.com',
					default: '',
					required: true,
				},
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
				},
			],
		},
	],
});

export const taskWriteProperties: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'taskTitle',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
	},
	{
		displayName: 'Title',
		name: 'taskTitle',
		type: 'string',
		default: '',
		description: 'Leave empty to keep the current title',
		displayOptions: { show: { resource: ['task'], operation: ['update'] } },
	},
	{
		displayName: 'Task Type',
		name: 'taskType',
		type: 'options',
		default: 'mcq',
		options: [
			{ name: 'MCQ', value: 'mcq' },
			{ name: 'Coding', value: 'coding' },
			{ name: 'Text', value: 'text' },
		],
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
	},
	{
		displayName: 'Task Type',
		name: 'taskType',
		type: 'options',
		default: '',
		options: [
			{ name: 'Unchanged', value: '' },
			{ name: 'MCQ', value: 'mcq' },
			{ name: 'Coding', value: 'coding' },
			{ name: 'Text', value: 'text' },
		],
		displayOptions: { show: { resource: ['task'], operation: ['update'] } },
	},
	{
		displayName: 'Difficulty',
		name: 'taskDifficulty',
		type: 'options',
		default: 'medium',
		options: [
			{ name: 'Easy', value: 'easy' },
			{ name: 'Medium', value: 'medium' },
			{ name: 'Hard', value: 'hard' },
		],
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
	},
	{
		displayName: 'Difficulty',
		name: 'taskDifficulty',
		type: 'options',
		default: '',
		options: [
			{ name: 'Unchanged', value: '' },
			{ name: 'Easy', value: 'easy' },
			{ name: 'Medium', value: 'medium' },
			{ name: 'Hard', value: 'hard' },
		],
		displayOptions: { show: { resource: ['task'], operation: ['update'] } },
	},
	{
		displayName: 'Points',
		name: 'taskPoints',
		type: 'number',
		default: 10,
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
	},
	{
		displayName: 'Description',
		name: 'taskDescription',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		displayOptions: { show: { resource: ['task'], operation: ['create', 'update'] } },
	},
	{
		displayName: 'Question',
		name: 'taskQuestion',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Candidate-facing question (Markdown supported)',
		displayOptions: { show: { resource: ['task'], operation: ['create', 'update'] } },
	},
	{
		displayName: 'Tags',
		name: 'taskTags',
		type: 'string',
		default: '',
		description: 'Comma-separated tags',
		displayOptions: { show: { resource: ['task'], operation: ['create', 'update'] } },
	},
	{
		displayName: 'MCQ Options',
		name: 'taskOptionsUi',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['create', 'update'] } },
		options: [
			{
				name: 'option',
				displayName: 'Option',
				values: [
					{ displayName: 'ID', name: 'id', type: 'string', default: '' },
					{ displayName: 'Text', name: 'text', type: 'string', default: '', required: true },
					{ displayName: 'Is Correct', name: 'is_correct', type: 'boolean', default: false },
				],
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'taskAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Allow Multiple Answers', name: 'allow_multiple', type: 'boolean', default: false },
			{
				displayName: 'Expected Output',
				name: 'expected_output',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				default: 'python',
				options: [
					{ name: 'JavaScript', value: 'javascript' },
					{ name: 'Python', value: 'python' },
					{ name: 'SQL', value: 'sql' },
				],
			},
			{ displayName: 'Points', name: 'points', type: 'number', default: 10 },
			{
				displayName: 'Rubric',
				name: 'rubric',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
			{
				displayName: 'Starter Code',
				name: 'starter_code',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
			},
			{ displayName: 'Time Limit (Minutes)', name: 'time_limit_minutes', type: 'number', default: 30 },
		],
	},
];

export const interviewWriteProperties: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'interviewTitle',
		type: 'string',
		default: 'AI Screening Interview',
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Candidate Email',
		name: 'interviewCandidateEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['interview'], operation: ['create'] } },
	},
	{
		displayName: 'Candidate Name',
		name: 'interviewCandidateName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['interview'], operation: ['create'] } },
	},
	{
		displayName: 'Candidates',
		name: 'interviewCandidatesUi',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Candidate',
		default: {},
		required: true,
		displayOptions: { show: { resource: ['interview'], operation: ['bulkCreate'] } },
		options: [
			{
				name: 'candidate',
				displayName: 'Candidate',
				values: [
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						required: true,
					},
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{
						displayName: 'Resume Text',
						name: 'resume_text',
						type: 'string',
						typeOptions: { rows: 2 },
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Interviewer Mode',
		name: 'interviewerMode',
		type: 'options',
		default: 'ai_only',
		options: [
			{ name: 'AI Only', value: 'ai_only' },
			{ name: 'Human Only', value: 'human_only' },
			{ name: 'Hybrid', value: 'hybrid' },
		],
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Interview Type',
		name: 'interviewType',
		type: 'options',
		default: 'mixed',
		options: [
			{ name: 'Behavioral', value: 'behavioral' },
			{ name: 'Coding', value: 'coding' },
			{ name: 'Mixed', value: 'mixed' },
			{ name: 'System Design', value: 'system_design' },
			{ name: 'Technical', value: 'technical' },
		],
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Job Description',
		name: 'jobDescription',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Required for AI / hybrid modes',
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Resume Text',
		name: 'resumeText',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Required for AI / hybrid modes (per-candidate resume can override on bulk)',
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Send Invite',
		name: 'interviewSendInvite',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Scheduled At',
		name: 'scheduledAt',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				resource: ['interview'],
				operation: ['create', 'bulkCreate', 'reschedule'],
			},
		},
	},
	{
		displayName: 'Coding Task IDs',
		name: 'codingTaskIds',
		type: 'string',
		default: '',
		description: 'Comma-separated platform task UUIDs',
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Org Task IDs',
		name: 'orgTaskIds',
		type: 'string',
		default: '',
		description: 'Comma-separated org task UUIDs',
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
	},
	{
		displayName: 'Persona',
		name: 'interviewPersona',
		type: 'collection',
		placeholder: 'Add Persona Field',
		default: {},
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'Tone',
				name: 'tone',
				type: 'options',
				default: 'warm',
				options: [
					{ name: 'Warm', value: 'warm' },
					{ name: 'Formal', value: 'formal' },
					{ name: 'Conversational', value: 'conversational' },
				],
			},
			{ displayName: 'Seniority', name: 'seniority', type: 'string', default: '' },
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'interviewAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['interview'], operation: ['create', 'bulkCreate'] },
		},
		options: [
			{ displayName: 'Active Language', name: 'active_language', type: 'string', default: 'python' },
			{
				displayName: 'Difficulty',
				name: 'difficulty',
				type: 'options',
				default: 'mid',
				options: [
					{ name: 'Entry', value: 'entry' },
					{ name: 'Mid', value: 'mid' },
					{ name: 'Senior', value: 'senior' },
					{ name: 'Staff', value: 'staff' },
				],
			},
			{ displayName: 'Human Can Join', name: 'human_can_join', type: 'boolean', default: false },
			{
				displayName: 'Pipeline Enrollment ID',
				name: 'pipeline_enrollment_id',
				type: 'string',
				default: '',
			},
			{ displayName: 'Target Company', name: 'target_company', type: 'string', default: '' },
			{ displayName: 'Target Role', name: 'target_role', type: 'string', default: '' },
			{ displayName: 'Time Limit (Minutes)', name: 'time_limit_minutes', type: 'number', default: 60 },
			{ displayName: 'Voice Mode', name: 'voice_mode', type: 'boolean', default: false },
		],
	},
	{
		displayName: 'Share Expires (Days)',
		name: 'shareExpiresDays',
		type: 'number',
		default: 14,
		typeOptions: { minValue: 1, maxValue: 365 },
		displayOptions: { show: { resource: ['interview'], operation: ['share'] } },
	},
	{
		displayName: 'Template Name',
		name: 'templateName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['interview'], operation: ['createTemplate'] },
		},
	},
	{
		displayName: 'Template Name',
		name: 'templateName',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['interview'], operation: ['updateTemplate'] },
		},
	},
	{
		displayName: 'Template Config',
		name: 'templateConfig',
		type: 'json',
		default: '{}',
		description: 'Template configuration object',
		displayOptions: {
			show: { resource: ['interview'], operation: ['createTemplate', 'updateTemplate'] },
		},
	},
];
