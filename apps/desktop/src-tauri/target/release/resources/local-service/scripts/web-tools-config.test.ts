import assert from 'node:assert/strict';
import { buildWebToolsConfig } from '../src/openclaw/realAdapter';

const perplexityResult = buildWebToolsConfig(
  { search: {}, fetch: {} },
  {
    searchEnabled: true,
    searchProvider: 'perplexity',
    searchApiKey: 'pplx-test',
    searchPerplexityBaseUrl: 'https://api.perplexity.ai',
    searchPerplexityModel: 'perplexity/sonar-pro',
    fetchEnabled: true,
  }
);

assert.equal(perplexityResult.changed, true);
assert.equal(perplexityResult.search?.provider, 'perplexity');
const perplexitySection = perplexityResult.search?.perplexity as Record<string, unknown> | undefined;
assert.equal(perplexitySection?.apiKey, 'pplx-test');
assert.equal(perplexitySection?.baseUrl, 'https://api.perplexity.ai');
assert.equal(perplexitySection?.model, 'perplexity/sonar-pro');
assert.equal(perplexityResult.fetch?.enabled, true);

const braveResult = buildWebToolsConfig(
  { search: {}, fetch: {} },
  {
    searchProvider: 'brave',
    searchApiKey: 'brave-test',
  }
);

assert.equal(braveResult.search?.provider, 'brave');
assert.equal(braveResult.search?.apiKey, 'brave-test');

console.log('web-tools-config tests passed');
