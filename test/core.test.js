import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credits, numeric, models, sortModels, request } from '../src/api.js';
import { render, clean, money } from '../src/render.js';
import { spawnSync } from 'node:child_process';
test('credits preserve zero, fractional and negative balances', () => {
  for (const [p,u] of [[0,0],[10,11],[100.5,25.75]]) assert.equal(credits({data:{total_credits:p,total_usage:u}}).remaining_credits_usd,p-u);
  assert.throws(() => credits({data:{}}));
});
test('counts remain lossless and unknown values remain null', () => {
  assert.equal(numeric('9007199254740993',true),'9007199254740993');
  assert.equal(numeric(9007199254740992,true),null);
  for (const value of [null,undefined,'',false,'Infinity']) assert.equal(numeric(value),null);
  assert.equal(numeric('236',true),236);
});
test('nested analytics and deterministic sort', () => {
  const rows = models({data:{data:[{model:'z',credits_usage:2,request_count:'2'},{model:'a',credits_usage:2,request_count:'3'}]}});
  assert.equal(sortModels(rows,'spend')[0].model,'a');
  assert.equal(rows[0].total_tokens,null);
  assert.throws(() => models({data:[]}));
});
test('renderer handles narrow widths, zero balance and hostile strings', () => {
  const data = {freshness:'live',period:{label:'30d'},account:credits({data:{total_credits:0,total_usage:0}}),models:[{model:'bad\x1b[31m\nmodel',credit_spend_usd:.001,requests:2,total_tokens:12}],warnings:[],model_results_complete:true};
  for (const width of [20,50,80,120]) {
    const out=render(data,{},width);
    assert.ok(out.split('\n').every(line => line.length <= width));
    assert.ok(!out.includes('\x1b'));
    assert.ok(!out.includes('NaN'));
  }
  assert.equal(clean('\x1b[31mhello\n'),'hello');
  assert.equal(money(.001),'<$0.01');
});
test('API handles auth, malformed JSON and transient failures without leaking secrets', async () => {
  await assert.rejects(request('SECRET','/credits',null,async () => new Response('',{status:401})), e => e.code===3 && !e.message.includes('SECRET'));
  await assert.rejects(request('SECRET','/credits',null,async () => new Response('invalid')),/invalid JSON/);
  let attempts=0;
  const result=await request('SECRET','/credits',null,async (url,options) => {
    assert.equal(options.redirect,'error'); assert.ok(url.startsWith('https://openrouter.ai/'));
    if (!attempts++) throw Error('SECRET');
    return Response.json({data:{}});
  });
  assert.deepEqual(result,{data:{}}); assert.equal(attempts,2);
});
test('CLI help/version and invalid arguments do not touch Keychain', () => {
  for (const flag of ['--help','--version']) assert.equal(spawnSync(process.execPath,['src/cli.js',flag]).status,0);
  for (const flags of [['--key','SECRET'],['--period','2d'],['--top','0'],['oops']]) {
    const run=spawnSync(process.execPath,['src/cli.js',...flags],{encoding:'utf8'});
    assert.equal(run.status,2); assert.ok(!run.stderr.includes('SECRET'));
  }
});
