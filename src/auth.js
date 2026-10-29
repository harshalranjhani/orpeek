import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Failure, request } from './api.js';
export function keychain(action, secret) {
  return new Promise((resolve,reject) => {
    const child = spawn(fileURLToPath(new URL('../bin/keychain',import.meta.url)),[action],{stdio:['pipe','pipe','ignore']});
    let output = '';
    child.stdout.setEncoding('utf8').on('data',chunk => { output += chunk; });
    child.on('error',() => reject(new Failure('Cannot start macOS Keychain helper.',3)));
    child.stdin.on('error',() => {});
    child.on('close',code => code === 0 ? resolve(output) : code === 2 && action === 'get' ? resolve(null) : reject(new Failure('Keychain access failed. Unlock your login Keychain and allow access, then retry.',3)));
    child.stdin.end(secret);
  });
}
export function prompt(label, hidden = false) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Failure('Run orpeek auth set in an interactive terminal first.',3);
  process.stderr.write(label);
  return new Promise((resolve,reject) => {
    let value = '';
    const previous = process.stdin.isRaw;
    process.stdin.setRawMode(true); process.stdin.setEncoding('utf8'); process.stdin.resume();
    function finish(error) {
      process.stdin.removeListener('data',input); process.stdin.setRawMode(previous); process.stdin.pause();
      process.stderr.write('\n'); error ? reject(error) : resolve(value.trim());
    }
    function input(chunk) {
      for (const char of chunk) {
        if (char === '\u0003' || char === '\u0004') return finish(new Failure('Cancelled.',3));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f') value = value.slice(0,-1);
        else if (char >= ' ' && value.length < 4096) { value += char; if (!hidden) process.stderr.write(char); }
      }
    }
    process.stdin.on('data',input);
  });
}
export async function setup() {
  process.stderr.write('Enter an OpenRouter management key (not an inference key).\nhttps://openrouter.ai/settings/management-keys\n');
  const key = await prompt('Management key (hidden): ',true);
  if (!key || /\s/.test(key)) throw new Failure('Invalid key format; nothing saved.',3);
  await request(key,'/analytics/meta');
  await request(key,'/credits');
  await keychain('set',key);
  process.stderr.write('Key verified and stored in macOS Keychain.\n');
  return key;
}
