export const clean = text => String(text).replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g,'');
export const money = n => n == null ? '-' : n > 0 && n < .01 ? '<$0.01' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const count = n => n == null ? '-' : typeof n === 'string' ? n : new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
export function render(data, options = {}, width = 80) {
  width = Math.max(20,Math.min(width,100));
  const fit = (s,n) => { s = clean(s); return Array.from(s).length > n ? Array.from(s).slice(0,n-1).join('')+'~' : s; };
  const lines = ['orpeek  /  OpenRouter usage',data.freshness === 'live' ? 'Live' : 'Cached by OpenRouter', '', 'ACCOUNT CREDITS / ALL TIME'];
  if (data.account) {
    const a = data.account;
    lines.push('Purchased  '+money(a.purchased_credits_usd),'Used       '+money(a.used_credits_usd),'Remaining  '+money(a.remaining_credits_usd));
    const ratio = a.purchased_credits_usd > 0 ? Math.min(1,Math.max(0,a.remaining_credits_usd/a.purchased_credits_usd)) : null;
    lines.push('['+'='.repeat(Math.round((ratio??0)*20))+' '.repeat(20-Math.round((ratio??0)*20))+'] '+(ratio === null ? '-' : Math.round(ratio*100)+'%')+' remaining');
  } else lines.push('Unavailable');
  lines.push('', 'MODEL USAGE / LAST '+parseInt(data.period.label)+' DAYS (UTC)');
  if (!data.models) lines.push('Unavailable');
  else if (!data.models.length) lines.push('No model usage found in this period.');
  else {
    const rows = data.models.slice(0,options.all ? undefined : options.top ?? 10);
    const modelWidth = width-33;
    if (width >= 60) lines.push('MODEL'.padEnd(modelWidth)+'SPEND'.padStart(11)+'CALLS'.padStart(10)+'TOKENS'.padStart(12));
    for (const row of rows) {
      if (width < 60) lines.push(fit(row.model,width),'  '+money(row.credit_spend_usd)+' / '+count(row.requests)+' calls / '+count(row.total_tokens)+' tokens');
      else lines.push(fit(row.model,modelWidth-1).padEnd(modelWidth)+money(row.credit_spend_usd).padStart(11)+count(row.requests).padStart(10)+count(row.total_tokens).padStart(12));
    }
    if (rows.length < data.models.length) lines.push('+'+(data.models.length-rows.length)+' more (use --all)');
    lines.push('',data.models.length+' models'+(data.model_results_complete ? '' : ' / incomplete results'));
  }
  lines.push('Credits are all-time; model usage is period-specific.');
  for (const warning of data.warnings) lines.push('! '+warning.message);
  return lines.map(line => fit(line,width)).join('\n')+'\n';
}
