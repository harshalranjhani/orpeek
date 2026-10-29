#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { Failure, request, credits, analytics, sortModels, currentKey } from './api.js';
import { keychain, prompt, setup } from './auth.js';
import { render } from './render.js';
const help = `orpeek — OpenRouter usage at a glance

Usage: orpeek [options]
       orpeek auth set|status|remove [--yes]

  --period 7d|30d|90d|365d    Model usage window (default 30d)
  --top N                    Rows to show (1–10000, default 10)
  --all                      Show every retrieved model
  --sort spend|calls|tokens   Sort models (default spend)
  --json                     Full normalized JSON output
  --fresh                    Fetch current data (always enabled)
  --no-color                 Plain output
  --help                     Show help
  --version                  Show version

Requires macOS, Node 20+, and an OpenRouter API key.
`;
async function main() {
  let args;
  try { args = parseArgs({allowPositionals:true,options:Object.fromEntries(['period','top','sort'].map(x => [x,{type:'string'}]).concat(['all','json','fresh','no-color','help','version','yes'].map(x => [x,{type:'boolean'}])))}); }
  catch { throw new Failure('Invalid arguments. Run orpeek --help.',2); }
  const o = args.values, command = args.positionals.join(' ');
  if (o.help) return console.log(help);
  if (o.version) return console.log(JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version);
  o.period ??= '30d'; o.top ??= '10'; o.sort ??= 'spend';
  if (!['7d','30d','90d','365d'].includes(o.period) || !/^[1-9]\d*$/.test(o.top) || Number(o.top)>10000 || !['spend','calls','tokens'].includes(o.sort) || !['','auth set','auth status','auth remove'].includes(command) || (o.yes && command !== 'auth remove')) throw new Failure('Invalid arguments. Run orpeek --help.',2);
  if (process.platform !== 'darwin') throw new Failure('orpeek requires macOS Keychain.',3);
  if (command === 'auth set') { await setup(); return; }
  if (command === 'auth status') { console.log(await keychain('get') === null ? 'No API key configured.' : 'API key configured (not remotely verified).'); return; }
  if (command === 'auth remove') {
    if (!o.yes && (await prompt('Remove the saved API key? [y/N] ')).toLowerCase() !== 'y') return;
    await keychain('remove'); console.log('API key removed.'); return;
  }
  let key = await keychain('get');
  if (key === null) {
    if (o.json) throw new Failure('Run orpeek auth set in an interactive terminal first.',3);
    key = await setup();
  }
  const now = new Date(), period = {label:o.period,start_utc:new Date(now.getTime()-parseInt(o.period)*86400000).toISOString(),end_utc:now.toISOString()};
  const data = {schema_version:1,source:'openrouter',generated_at:now.toISOString(),freshness:'live',period,account:null,models:null,model_results_complete:false,warnings:[]};
  const keyUsage = await currentKey(key);
  data.mode = keyUsage.is_management_key ? 'management' : 'inference';
  if (data.mode === 'inference') {
    data.key_usage = keyUsage;
    data.period = null;
    data.capabilities = {account_credits:false,model_analytics:false};
    console.log(o.json ? JSON.stringify(data,null,2) : render(data,o,process.stdout.columns ?? 80).trimEnd());
    return;
  }
  const results = await Promise.allSettled([request(key,'/credits').then(credits),analytics(key,period)]);
  for (const [i,result] of results.entries()) {
    if (result.status === 'rejected') data.warnings.push({section:i ? 'models' : 'account',message:result.reason instanceof Failure ? result.reason.message : 'Unexpected API schema.',code:result.reason.code ?? 4});
    else if (!i) data.account = result.value;
    else {
      data.models = sortModels(result.value.rows,o.sort);
      data.model_results_complete = result.value.complete;
      if (result.value.cachedAt) { data.freshness = 'cached'; data.analytics_cached_at = result.value.cachedAt; }
      if (!result.value.complete) data.warnings.push({section:'models',message:'OpenRouter returned incomplete results.'});
      if (result.value.warnings) data.warnings.push({section:'models',message:'OpenRouter reported query warnings; results may be incomplete.'});
      if (data.models.some(row => ['credit_spend_usd','requests','total_tokens','prompt_tokens','completion_tokens'].some(k => row[k] === null))) data.warnings.push({section:'models',message:'Some required metrics are unavailable.'});
    }
  }
  console.log(o.json ? JSON.stringify(data,null,2) : render(data,o,process.stdout.columns ?? 80).trimEnd());
  if (data.warnings.length) process.exitCode = data.account || data.models ? 5 : data.warnings.some(w => w.code === 3) ? 3 : 4;
}
main().catch(error => { console.error(error instanceof Failure ? error.message : 'orpeek failed unexpectedly. Retry or report this issue.'); process.exitCode = error.code ?? 1; });
