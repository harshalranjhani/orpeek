export class Failure extends Error {
  constructor(message, code = 4) { super(message); this.code = code; }
}
export async function request(key, path, body, fetcher = fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetcher('https://openrouter.ai/api/v1' + path, {
        method: body ? 'POST' : 'GET', redirect: 'error',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000)
      });
    } catch {
      if (!attempt) continue;
      throw new Failure('Network request failed or timed out. Check your connection and retry.');
    }
    if (response.ok) {
      try { return await response.json(); } catch { throw new Failure('OpenRouter returned invalid JSON.'); }
    }
    if (response.status === 401) throw new Failure('API key invalid or expired. Run orpeek auth set.', 3);
    if (response.status === 403) throw new Failure('Management key permission required: https://openrouter.ai/settings/management-keys', 3);
    if (!attempt && (response.status >= 500 || [408,429].includes(response.status))) {
      const header = response.headers.get('retry-after');
      const delay = header ? (/^\d+$/.test(header) ? Number(header)*1000 : Date.parse(header)-Date.now()) : 500;
      if (Number.isFinite(delay) && delay <= 8000) { await new Promise(r => setTimeout(r, Math.max(0,delay))); continue; }
    }
    throw new Failure('OpenRouter HTTP ' + response.status + '. Retry later or select a narrower period.');
  }
}
const mapping = {credits_usage:'credit_spend_usd',request_count:'requests',tokens_total:'total_tokens',tokens_prompt:'prompt_tokens',tokens_completion:'completion_tokens',total_usage:'total_usage_usd',byok_usage:'byok_usage_usd'};
export const required = Object.keys(mapping).slice(0,5);
export function numeric(value, count = false) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^-?\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (count && (!Number.isSafeInteger(n) || n < 0)) return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value).toString() : null;
  return n;
}
export function credits(response) {
  const purchased = numeric(response?.data?.total_credits), used = numeric(response?.data?.total_usage);
  if (purchased === null || used === null || !Number.isFinite(purchased-used)) throw new Failure('Account credits unavailable: unexpected response.');
  return {purchased_credits_usd:purchased,used_credits_usd:used,remaining_credits_usd:purchased-used};
}
export function models(response) {
  if (!Array.isArray(response?.data?.data)) throw new Failure('Model usage unavailable: unexpected response.');
  return response.data.data.map(row => {
    if (typeof row.model !== 'string') throw new Failure('Model usage unavailable: missing model ID.');
    return Object.fromEntries([['model',row.model], ...Object.entries(mapping).map(([source,target]) => [target,numeric(row[source],source === 'request_count' || source.startsWith('tokens_'))])]);
  });
}
export async function analytics(key, period) {
  const meta = (await request(key,'/analytics/meta')).data;
  const names = meta?.metrics?.map(x => x.name);
  if (!names || !meta?.dimensions?.some(x => x.name === 'model') || required.some(x => !names.includes(x))) throw new Failure('Analytics schema unsupported: required model metrics unavailable.');
  const body = {metrics:Object.keys(mapping).filter(x => names.includes(x)),dimensions:['model'],time_range:{start:period.start_utc,end:period.end_utc},order_by:{field:'credits_usage',direction:'desc'},limit:1000};
  let result = await request(key,'/analytics/query',body);
  if (result?.data?.metadata?.truncated) result = await request(key,'/analytics/query',{...body,limit:10000});
  return {rows:models(result),complete:result?.data?.metadata?.truncated === false, warnings: Boolean(result?.data?.warnings?.length), cachedAt: result?.data?.cachedAt};
}
export function sortModels(rows, sort) {
  const field = {spend:'credit_spend_usd',calls:'requests',tokens:'total_tokens'}[sort];
  const compare = (a,b) => a === b ? 0 : a == null ? 1 : b == null ? -1 : (typeof a === 'string' || typeof b === 'string' ? BigInt(a) > BigInt(b) : a > b) ? -1 : 1;
  return rows.sort((a,b) => compare(a[field],b[field]) || compare(a.requests,b.requests) || a.model.localeCompare(b.model,'en'));
}

export async function currentKey(key, fetcher = fetch) {
  const {data} = await request(key,'/key',undefined,fetcher);
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      (typeof data.is_management_key !== 'boolean' && numeric(data.usage) === null)) {
    throw new Failure('Key details unavailable: unexpected response.');
  }
  return {
    is_management_key: data.is_management_key === true,
    limit_usd: numeric(data.limit),
    unlimited: data.limit === null,
    remaining_limit_usd: numeric(data.limit_remaining),
    limit_reset: data.limit_reset === null ? null : ['daily','weekly','monthly'].includes(data.limit_reset) ? data.limit_reset : 'unknown',
    include_byok_in_limit: typeof data.include_byok_in_limit === 'boolean' ? data.include_byok_in_limit : null,
    usage_usd: numeric(data.usage),
    usage_daily_usd: numeric(data.usage_daily),
    usage_weekly_usd: numeric(data.usage_weekly),
    usage_monthly_usd: numeric(data.usage_monthly),
    byok_usage_usd: numeric(data.byok_usage)
  };
}
