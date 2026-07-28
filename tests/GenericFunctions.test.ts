import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import { unwrapAssessResponse, verifyPraxicraftSignature } from '../nodes/PraxicraftAssess/GenericFunctions';

describe('unwrapAssessResponse', () => {
	it('returns flat Public API objects as-is', () => {
		const body = { invite_token: 'abc', email: 'a@b.com' };
		assert.deepEqual(unwrapAssessResponse(body), body);
	});

	it('unwraps legacy status/data envelopes', () => {
		assert.deepEqual(unwrapAssessResponse({ status: 'success', data: { ok: true } }), { ok: true });
	});

	it('handles null', () => {
		assert.equal(unwrapAssessResponse(null), null);
	});
});

describe('verifyPraxicraftSignature', () => {
	it('accepts a valid HMAC signature', () => {
		const secret = 'whsec_test_secret';
		const raw = '{"event":"assessment.completed"}';
		const header = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
		assert.equal(verifyPraxicraftSignature(secret, raw, header), true);
	});

	it('rejects a tampered body', () => {
		const secret = 'whsec_test_secret';
		const header = `sha256=${createHmac('sha256', secret).update('good').digest('hex')}`;
		assert.equal(verifyPraxicraftSignature(secret, 'bad', header), false);
	});

	it('rejects missing header', () => {
		assert.equal(verifyPraxicraftSignature('whsec_x', '{}', undefined), false);
	});
});
