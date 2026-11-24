// POST-08 live contract check: drives the app's real USDA + OFF clients against the live APIs (weekly CI and
// `npm run test:live`). Never part of `npm test`. Never records or prints URLs, headers, the key or raw values (ARCH-15, PROV-12).
import fs from 'fs';
import path from 'path';

import { providerFailureDetails } from '@/data/api/diagnostics';
import { OpenFoodFactsClient } from '@/data/api/open-food-facts/client';
import { mapOpenFoodFactsProduct } from '@/data/api/open-food-facts/mapper';
import { UsdaClient } from '@/data/api/usda/client';
import { mapUsdaSearchFood, type FoodCandidate } from '@/data/api/usda/mapper';
import { parseConfig, type RawEnv } from '@/shared/config/env';
import {
  NotFoundError,
  ProviderConfigurationError,
  ProviderResponseError,
  RateLimitError,
  TimeoutError,
} from '@/shared/errors';
import type { Logger } from '@/shared/logging/logger';

const liveFetch = (globalThis as { liveFetch?: typeof fetch }).liveFetch;
if (!liveFetch) throw new Error('The live suite needs Node fetch: run it with `npm run test:live`.');

const appVersion = (
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../app.json'), 'utf8')) as { expo: { version: string } }
).expo.version;
const config = parseConfig(process.env as RawEnv, appVersion);
const key = process.env.USDA_API_KEY?.trim() || 'DEMO_KEY';
const full = key !== 'DEMO_KEY';

// Only the last response is kept (never its URL or headers).
let lastBody: Response | null = null;
let lastOk = false;
const recordingFetch: typeof fetch = async (url, init) => {
  const response = await liveFetch(url, init);
  lastBody = response.clone();
  lastOk = response.ok;
  return response;
};

const silent: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const usda = new UsdaClient(config, { getUsdaApiKeyForRequest: async () => key }, recordingFetch, silent);
const off = new OpenFoodFactsClient(config, recordingFetch, {}, silent);

function report(line: string): void {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, `${line}\n`);
  else process.stderr.write(`${line}\n`);
}

const signal = () => new AbortController().signal;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rawHits(field: 'foods' | 'hits'): Promise<unknown[]> {
  const body = (await lastBody!.json()) as Record<string, unknown>;
  const hits = body[field];
  return Array.isArray(hits) ? hits : [];
}

/** Fails if more than half of the raw hits no longer parse: PROV-07 would drop them silently. */
function expectHitsParse(label: string, hits: unknown[], parse: (hit: unknown) => unknown): void {
  let dropped = 0;
  for (const hit of hits) {
    try {
      parse(hit);
    } catch {
      dropped += 1;
    }
  }
  if (dropped > 0) report(`warning: ${label}: ${dropped} of ${hits.length} hits fail their schema`);
  if (dropped * 2 > hits.length) throw new Error(`${label}: ${dropped} of ${hits.length} hits fail their schema`);
}

type Verdict = { kind: 'transient'; text: string } | { kind: 'fail'; text: string };

/** The classification table of the T11 plan: contract drift, setup and retired fixtures fail; network trouble passes. */
function classify(error: unknown, provider: string, check: string): Verdict {
  const where = `${provider} ${check}`;
  const type = error instanceof Error ? error.constructor.name : typeof error;
  if (error instanceof TimeoutError) return { kind: 'transient', text: `${where} ${type}` };
  if (error instanceof RateLimitError) return { kind: 'transient', text: `${where} ${type} 429` };
  if (error instanceof NotFoundError)
    return {
      kind: 'fail',
      text: `${where}: fixture ID retired (NotFoundError). Re-pick the ID and re-capture the fixtures (PROV-13).`,
    };
  if (error instanceof ProviderConfigurationError)
    return {
      kind: 'fail',
      text: `${where}: the USDA key was rejected (secret USDA_API_KEY, or DEMO_KEY changed by data.gov).`,
    };
  if (error instanceof ProviderResponseError) {
    const { status, issuePath } = providerFailureDetails(error) ?? {};
    if (issuePath !== undefined) return { kind: 'fail', text: `${where}: schema drift at "${issuePath}"` };
    if (status !== undefined) {
      if (status >= 500 || (provider === 'usda' && status === 400))
        return { kind: 'transient', text: `${where} ${type} ${status}` };
      return { kind: 'fail', text: `${where}: unexpected HTTP ${status}` };
    }
    // No status and no issue path: a 200 that is not JSON is drift; no response at all is the network.
    if (lastOk) return { kind: 'fail', text: `${where}: a successful response was not valid JSON` };
    return { kind: 'transient', text: `${where} ${type} network` };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return { kind: 'fail', text: `${where}: ${detail}` };
}

/** Runs one check, with one test-level retry after 30 s on top of the clients' own PROV-10 retries. */
function live(provider: 'usda' | 'off', check: string, fn: () => Promise<void>): void {
  it(`${provider}: ${check}`, async () => {
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await sleep(30_000);
      lastBody = null;
      lastOk = false;
      try {
        await fn();
        return;
      } catch (error) {
        last = error;
      }
    }
    const verdict = classify(last, provider, check);
    if (verdict.kind === 'transient') {
      report(`transient: ${verdict.text}`);
      return;
    }
    report(`FAILED: ${verdict.text}`);
    throw new Error(verdict.text);
  });
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} is missing`);
  return value;
}

function expectFood(food: FoodCandidate | null, expectedId: string): FoodCandidate {
  const result = must(food, 'food');
  expect(result.externalId).toBe(expectedId);
  expect(result.input.nutrients.energyKcal).toBeGreaterThan(0);
  return result;
}

const genericTypes = new Set(['Foundation', 'SR Legacy', 'Survey (FNDDS)']);

describe('USDA FoodData Central', () => {
  if (!full) report('warning: no USDA_API_KEY: USDA runs the reduced DEMO_KEY set (POST-08).');

  live('usda', 'search "egg"', async () => {
    const page = await usda.search('egg', 1, signal());
    const hits = await rawHits('foods');
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expectHitsParse('usda search', hits, mapUsdaSearchFood);
    expect(page.candidates.length).toBeGreaterThanOrEqual(5);
    expect(hits.some((hit) => genericTypes.has(String((hit as { dataType?: unknown }).dataType)))).toBe(true);
    const first = hits.find((hit) => String((hit as { fdcId?: unknown }).fdcId) === page.candidates[0]!.externalId);
    expect(genericTypes.has(String((first as { dataType?: unknown }).dataType))).toBe(true); // PROV-08 ordering
    expect(page.candidates.some((c) => c.input.nutrients.proteinG != null)).toBe(true);
    expect(page.page).toBe(1);
    expect(page.pageCount).toBeGreaterThanOrEqual(2);
  });

  live('usda', 'detail Foundation 747997', async () => {
    const food = expectFood(await usda.getFood('747997', signal()), '747997');
    expect(food.input.servings.some((s) => s.unit !== 'g' && s.unit !== 'oz')).toBe(true);
  });

  live('usda', 'detail Branded 2035482', async () => {
    const food = expectFood(await usda.getFood('2035482', signal()), '2035482');
    expect(food.input.servings.some((s) => s.unit === 'serving')).toBe(true);
    expect(food.input.barcode).toBeTruthy(); // DATA-24 gtinUpc
  });

  if (full) {
    live('usda', 'detail SR Legacy 174980', async () => {
      const food = expectFood(await usda.getFood('174980', signal()), '174980');
      expect(food.input.servings.some((s) => s.unit !== 'g' && s.unit !== 'oz')).toBe(true);
    });

    live('usda', 'detail FNDDS 2705413', async () => {
      const food = expectFood(await usda.getFood('2705413', signal()), '2705413');
      expect(food.input.servings.some((s) => s.unit !== 'g' && s.unit !== 'oz')).toBe(true);
    });

    live('usda', 'barcode search', async () => {
      const id = await usda.findBarcode('00031200037206', signal());
      if (id === null) report('note: usda barcode search found no match for the fixture GTIN (data, not contract)');
    });
  }
});

describe('Open Food Facts', () => {
  live('off', 'search "iogurte grego"', async () => {
    const page = await off.search('iogurte grego', 1, signal(), 'pt-PT');
    const hits = await rawHits('hits');
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expectHitsParse('off search', hits, mapOpenFoodFactsProduct);
    expect(page.candidates.length).toBeGreaterThanOrEqual(3);
    expect(page.candidates.some((c) => c.input.brand)).toBe(true);
    expect(
      page.candidates.some((c) => c.input.nutrients.proteinG != null || c.input.nutrients.carbohydrateG != null),
    ).toBe(true);
    expect(page.pageCount).toBeGreaterThanOrEqual(1);
  });

  live('off', 'product 5601009983179', async () => {
    expectFood(await off.getFood('5601009983179', signal()), '5601009983179');
  });
});
