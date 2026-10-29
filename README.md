# orpeek

Your OpenRouter balance and model usage, in one quiet terminal view.

macOS 11+ · Node.js 20+ · no runtime dependencies · no telemetry

**Release status:** source available; npm publication is pending. The bare
`npx orpeek` command is not available until the package is published.

Run from this repository now:

```sh
npx github:harshalranjhani/orpeek
```

Enter your [OpenRouter management key](https://openrouter.ai/settings/management-keys)
once at the hidden prompt. macOS Keychain stores it for subsequent runs.
An ordinary inference key cannot provide account analytics.

Illustrative output (sample values):

```text
orpeek  /  OpenRouter usage
Live

ACCOUNT CREDITS / ALL TIME
Purchased  $100.50
Used       $38.25
Remaining  $62.25
[============        ] 62% remaining

MODEL USAGE / LAST 30 DAYS (UTC)
MODEL                                  SPEND     CALLS      TOKENS
anthropic/claude-sonnet-4              $12.40       418        3.2M
openai/gpt-4.1                          $6.80       236        1.8M

2 models
Credits are all-time; model usage is period-specific.
```

After npm publication, run `npx orpeek` or install with `npm i -g orpeek`.

## Options

```sh
orpeek --period 7d
orpeek --period 90d --top 5
orpeek --all --sort calls
orpeek --json
orpeek auth set
orpeek auth status
orpeek auth remove
orpeek auth remove --yes
```

Periods: 7d, 30d, 90d, 365d; default 30d. Sort: spend, calls, tokens.
JSON always includes every retrieved model, regardless of the display row limit.
Spend means OpenRouter credits charged, not estimated external BYOK costs.
Missing metrics are null. Counts beyond JavaScript's safe integer range are
decimal strings; other counts are numbers. Model names remain intact in JSON.
Terminal output is sanitized, plain ASCII, and automatically compact below
60 columns. No color is required to interpret it.

No local usage cache is written. Every invocation fetches data; `--fresh` is
accepted for convenience. Upstream cached responses are identified separately.
The API may reject a window or return incomplete results; these are disclosed.

Exit statuses: 0 complete; 1 unexpected failure; 2 arguments; 3 authentication
or Keychain; 4 API/network; 5 partial results. Partial JSON retains successful
sections and structured warnings. Fatal errors go to stderr.

## Development

```sh
npm ci
npm test
npm run build
npm pack --dry-run
```

Runtime JavaScript is shipped directly, without a compiler or install hooks.
The included universal Intel/Apple Silicon Keychain helper is built from
`native/keychain.c`. Rebuilding it requires Apple's command line developer tools;
end users do not need them. It uses Apple's legacy generic-password API, which
is deprecated but remains available for the login Keychain.

Before publishing: validate real management-key onboarding and rotation,
Keychain permission prompts, both Mac architectures, and registry installation.
The automated tests use synthetic data and mocked requests, not a live account.
