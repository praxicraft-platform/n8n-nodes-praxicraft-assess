import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PraxicraftAssess } from '../nodes/PraxicraftAssess/PraxicraftAssess.node';
import { PUBLIC_API_OPERATIONS } from '../nodes/PraxicraftAssess/operations.contract';

describe('PraxicraftAssess Public API parity', () => {
	it('exposes every contracted resource/operation in the node UI', () => {
		const node = new PraxicraftAssess();
		const props = node.description.properties;

		const resourceProp = props.find((p) => p.name === 'resource' && p.type === 'options');
		assert.ok(resourceProp && 'options' in resourceProp && Array.isArray(resourceProp.options));

		const resources = new Set(
			(resourceProp.options as Array<{ value: string }>).map((o) => o.value),
		);

		const opsByResource = new Map<string, Set<string>>();
		for (const prop of props) {
			if (prop.name !== 'operation' || prop.type !== 'options') continue;
			const show = prop.displayOptions?.show?.resource;
			const resourceValues = Array.isArray(show) ? show : show ? [show] : [];
			for (const resource of resourceValues) {
				if (!opsByResource.has(String(resource))) opsByResource.set(String(resource), new Set());
				for (const opt of (prop.options as Array<{ value: string }>) || []) {
					opsByResource.get(String(resource))!.add(opt.value);
				}
			}
		}

		for (const row of PUBLIC_API_OPERATIONS) {
			assert.ok(resources.has(row.resource), `missing resource ${row.resource}`);
			const ops = opsByResource.get(row.resource);
			assert.ok(ops?.has(row.operation), `missing ${row.resource}.${row.operation}`);
		}
	});

	it('covers at least 60 Public API operations', () => {
		assert.ok(PUBLIC_API_OPERATIONS.length >= 60, `only ${PUBLIC_API_OPERATIONS.length} ops`);
	});
});
