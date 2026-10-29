# orpeek — Product Requirements & Technical Specification

**Status:** Ready for implementation (MVP)  
**Version:** 1.0 draft  
**Prepared:** 29 October 2026  
**Working product name:** `orpeek` (npm name/availability and trademarks must be checked before publishing)  
**Target platform:** macOS, Apple Silicon and Intel  
**Distribution:** npm / `npx` first; optional Homebrew or verified installer later

---

## 1. Executive summary

Build a tiny, fast, read-only command-line dashboard for OpenRouter. A macOS user should be able to run a single command, enter an OpenRouter **management API key once**, and immediately see:

1. **Purchased credits**, **credits used**, and **credits remaining**, in USD (account-wide, all time).
2. **Per-model usage for a selected time window**, including OpenRouter-credit spend, API requests, and token counts.
3. A clean, concise terminal view that fits on one screen in ordinary terminal sizes.

Credentials must be persisted in **macOS Keychain**, not plaintext configuration, shell history, or a project `.env` file. Subsequent runs must work without a new login. The CLI is an information-only tool: **no model completions, no changes to API keys, and no billing mutations**.

### Product promise

> **One command. One secure setup. Your OpenRouter usage at a glance.**

### Primary workflow

```console
$ npx orpeek@latest

orpeek · first-time setup
OpenRouter management key: ••••••••••••••••••••
✓ Key verified and securely stored in macOS Keychain

orpeek · OpenRouter usage                            Updated just now

ACCOUNT CREDITS · ALL TIME
Purchased       $100.50
Used             $38.25
Remaining        $62.25
████████████░░░░░░░░                                 62% remaining

MODEL USAGE · LAST 30 DAYS                           Credit spend
MODEL                            SPEND      CALLS       TOKENS
anthropic/claude-sonnet-4       $12.40        418         3.2M
openai/gpt-4.1                   $6.80        236         1.8M
google/gemini-2.5-pro            $4.30        152         940K
deepseek/deepseek-r1             $2.25         84         510K

4 models · 890 calls · 6.45M tokens

Credits are all-time; model usage covers the last 30 days (UTC).
```

**All numbers and model names above are sample data.** The production renderer must derive every value from the relevant API response; the displayed model rows are not intended to reconcile with account-wide all-time credit totals.

---

## 2. Problem and motivation

OpenRouter supports checking credits, key-level limits, and model analytics, but doing so manually requires multiple pages or API requests. Developers often want a short answer in a terminal: *How much credit do I have left, and which models are costing me money?*

### Current friction

- Copying a secret into repeated `curl` commands is inconvenient and can expose credentials.
- `GET /api/v1/key` gives information about **one API key**, not per-model breakdown.
- Account billing and model analytics come from **different API endpoints**.
- The dashboard is useful, but opening a browser is more friction than a CLI for a terminal-first user.
- A custom dashboard should be readable without scrolling, typing multiple commands, or deciphering raw JSON.

### Success criteria

A new user with Node.js installed and a valid management key can reach the dashboard with **one command plus one secret entry**. Returning users need only run `npx orpeek@latest` (or the installed `orpeek` binary). Account totals and model metrics are unambiguous, readable, and accurate to the API responses.

---

## 3. Audience and use cases

**Primary persona:** A macOS developer who uses OpenRouter through coding agents, personal applications, scripts, or AI tools.

**Primary jobs to be done:**

- **Quick balance check:** “What is my remaining OpenRouter balance?”
- **Spend attribution:** “Which models consumed the most credits recently?”
- **Activity monitoring:** “How many calls/tokens did each model use?”
- **Compare windows:** “Did usage change over the last 7, 30, or 90 days?”
- **Secure repeat use:** “I don't want to paste my management key every time.”
- **Automation:** “Can I consume the same data from a script as JSON?”

**Out of scope for MVP:** Windows/Linux, an interactive full-screen TUI, live polling/watch mode, charts over time, notifications, multiple accounts, per-workspace/key drilldowns, model cost predictions, custom spending limits, and editing OpenRouter keys or settings.

---

## 4. Scope and release priorities

| Priority | Feature | Release |
|---|---|---|
| P0 | First-run management-key onboarding | MVP |
| P0 | Secure macOS Keychain storage/retrieval/removal | MVP |
| P0 | Account credits: purchased, used, remaining | MVP |
| P0 | Per-model credit spend, requests, prompt/output/total tokens | MVP |
| P0 | One-screen terminal dashboard with responsive widths | MVP |
| P0 | Clear errors, partial-data indicators, and credential rotation | MVP |
| P0 | `npx` executable, help, version, JSON output | MVP |
| P1 | 7/30/90/365-day selection, top-N and all-model views | MVP if simple |
| P1 | Short-lived caching with visible freshness indicator | MVP if simple |
| P1 | Optional BYOK cost visibility | Follow-up |
| P2 | Multiple profiles, per-key filters, workspace filters | Future |
| P2 | Homebrew formula, macOS standalone binary, watch mode | Future |

**MVP boundary:** Get the main invocation, storage, totals, and per-model breakdown right before implementing advanced controls.

---

## 5. Platform, installation, and naming

### 5.1 Supported environment

- macOS on **arm64** (Apple Silicon) and **x64** (Intel).
- Node.js **20+** (use built-in `fetch`, `AbortController`, and ESM; pin/test a concrete supported Node range before release).
- Terminal.app, iTerm2, Warp, and ordinary macOS terminal emulators.
- UTF-8 terminal preferred, but ASCII fallback required.
- No Docker, browser, service daemon, local web server, or developer toolchain required **at runtime**.

### 5.2 Installation and execution

**Primary zero-commit invocation (after the package is actually published):**

```sh
npx orpeek@latest
```

**Optional persistent install:**

```sh
npm install --global orpeek
orpeek
```

Note: `npx` is a *run-on-demand* workflow and can involve npm registry/cache checks on later invocations. A global install offers the shortest steady-state startup. These commands are **target release syntax**, not a claim that the package already exists.

### 5.3 Package requirements

- Publish the package with an executable `bin` entry named `orpeek`.
- Ship compiled production JS; **do not** make `npx` run TypeScript compilation, `ts-node`, or `tsx`.
- Keep installation small, maintainable, and compatible with both supported architectures.
- Avoid install-time arbitrary network scripts, analytics/telemetry, and unnecessary dependencies.
- If native Keychain access needs a package or helper, distribute compatible **prebuilt** binaries or use a compatible OS-provided mechanism. **Do not** require a local compiler or Xcode installation.
- Publish source code and release notes; provide an explicit MIT (or similarly permissive) license if desired.

**Naming gate:** Verify that `orpeek` is available as an npm package and has no problematic trademark conflicts. If unavailable, select a unique name and replace examples throughout before publishing.

---

## 6. First-run setup, authentication, and lifecycle

### 6.1 Required onboarding flow

When the CLI finds no credential in Keychain:

1. Print a one-sentence explanation of the needed credential: **OpenRouter management key** (not an ordinary inference API key).
2. Display a link to `https://openrouter.ai/settings/management-keys`.
3. Prompt for the secret with **no echo** and no paste into shell arguments.
4. Validate it against a management-key-required, read-only endpoint.
5. If valid, securely store it in macOS Keychain and display a terse confirmation.
6. Immediately load and render the dashboard.

If network validation cannot be completed, do not claim that the key is valid. Prefer keeping it only in memory until validation succeeds, with a clearly presented retry option. **Never silently save an invalid or unverified key.**

**Exactly one secret entry** during the normal setup. Requiring a second copy/paste to make the OS tool work is a UX regression and must not be treated as the finished implementation.

### 6.2 Authentication type

- Management keys are needed for `GET /api/v1/credits` and the Analytics API.
- Regular inference keys are insufficient for model-level analytics and must be rejected during onboarding with an actionable explanation.
- Never assume an inference key supports all features just because `GET /api/v1/key` succeeds.
- **Do not** accept raw keys through a `--key` CLI argument; that leaks into process arguments and possibly shell history.

### 6.3 Credential lifecycle commands

```sh
orpeek auth set       # Enter, verify, and securely replace the key
orpeek auth status    # Show whether a credential is configured, not its value
orpeek auth remove    # Delete the Keychain item and cached usage data
```

`auth set` replaces the existing credential only after verification, and protects the previous working key if the new key fails validation. `auth remove` asks for confirmation when attached to a terminal; offer `--yes` for scripts.

### 6.4 Keychain contract

- Use macOS **Keychain Services** to store a **generic password** item.
- Suggested service ID: `com.orpeek.openrouter`; account: `default`; user-facing label: `orpeek OpenRouter management key`.
- Store **only** the credential secret in the Keychain item; keep non-sensitive preferences elsewhere if necessary.
- Avoid `security add-generic-password -w SECRET`, `shell: true`, `sh -c`, `echo SECRET`, and embedding secrets in spawned command arguments.
- A conventional `security add-generic-password ... -w` without a value avoids command-line exposure but commonly prompts directly through the controlling TTY (possibly twice); this **does not satisfy** the one-entry onboarding requirement by itself.
- **Preferred implementation:** use a carefully reviewed native Keychain Services bridge or equivalent secure integration that accepts the key in-process without placing it in command-line arguments. Confirm it works on Intel and Apple Silicon with no build-on-install requirement.
- Never set indiscriminate access-control flags such as `security -A`. Respect system Keychain permission prompts and access controls; explain that macOS may ask the user to authorize access.
- No plaintext credential fallback, including `~/.orpeek/config.json`, `~/.zshrc`, `.env`, npm config, logs, or caches.
- The secret may reside transiently in application memory while requests are being made; never serialize or print it. Minimize references and their lifetime as practical for Node.js.
- Other software with sufficient user/session or Keychain privileges may still access credentials. **Do not market Keychain as absolute isolation.**
- Before release, audit the credential library/bridge: API behavior, binary provenance, maintenance, permission prompts, and absence of argv/env leakage.

### 6.5 Optional environment-variable override

**Defer to after MVP.** If eventually provided for CI, support a clearly documented variable such as `ORPEEK_MANAGEMENT_KEY` and never write it to Keychain automatically. Environment variables are not as private as Keychain for ordinary local use. A user-provided runtime override must not mutate the persisted credential.

---

## 7. Data definitions: avoid confusing “limit” with “credits”

OpenRouter uses related but different notions:

| Metric | Meaning | Source | Scope |
|---|---|---|---|
| `total_credits` | Total account credits purchased | `/api/v1/credits` | All time, account |
| `total_usage` | Credits already used | `/api/v1/credits` | All time, account |
| Remaining credits | `max(0, total_credits - total_usage)` for the visual bar; see note below | Computed | Account |
| `limit`, `limit_remaining` | Spending cap and remaining cap **on a specific inference key**, if one exists | `/api/v1/key` or `/api/v1/keys/:hash` | Specific key and reset rules |
| `credits_usage` | Charges billed to OpenRouter credits, including BYOK platform fees | `/api/v1/analytics/query` | Selected period, by model |
| `total_usage` (analytics) | Broader usage amount, including estimated BYOK inference cost | `/api/v1/analytics/query` | Selected period, by model |

**Important:** The two `total_usage` fields come from *different endpoints and have different interpretations*. Name them separately in internal types (`accountCreditsUsedUsd` vs. `analyticsTotalUsageUsd`). Do not conflate them.

### 7.1 Primary overview definition

The user asked for “limit, used, remaining.” For v1, show:

- **Purchased credits**: account `total_credits`.
- **Used credits**: account `total_usage`.
- **Remaining credits**: arithmetic difference, allowing a negative raw balance if the API data ever requires it. Do not conceal a negative value in text even if the progress bar is visually clamped to 0–100%.

The purchased amount is **not** an enforced spending limit. Therefore the default label must be **Purchased**, **not Limit**. Add “Per-key limits” in a future scoped feature only when the user has selected a particular key and its reset interval.

### 7.2 Progress bar

- `remainingRatio = clamp(remaining / total_credits, 0, 1)` when `total_credits > 0`.
- If credits are zero, do not divide by zero; show `—` for the percentage and a neutral empty bar.
- Negative remaining balance should display as a negative amount and use an empty bar; zero should be 0% remaining.
- If input values are missing/non-numeric, display an unavailable state rather than inventing numbers.
- Render money with two decimals for summary cards; support more precision in JSON.

### 7.3 Period semantics

- Default model activity: trailing **30 × 24 hours** ending at the current UTC time; show “Last 30 days (UTC)” and exact UTC start/end on demand (or in JSON).
- Supported explicit periods: `7d`, `30d`, `90d`, `365d`.
- All-time purchased/used/remaining figures do **not** change when the user switches the model usage period.
- Model activity does **not** necessarily sum to account all-time charges due to timeframe, BYOK usage, rounding, timing, and other account-level charges.
- API windows/limits are subject to OpenRouter’s actual schema. Validate them and transparently report if the API restricts or truncates a requested interval.

### 7.4 Model usage semantics

In the default table, **SPEND = `credits_usage`**, the amount charged to OpenRouter credits in the chosen window. This is a deliberate product choice so the column reflects OpenRouter-billed spend rather than estimated cost on external BYOK providers.

Also fetch, as available, `total_usage` and `byok_usage` for future details/JSON. Do not mix these cost categories into a misleading grand total or claim that BYOK estimated inference dollars were deducted from the OpenRouter credit balance.

- **Calls:** `request_count`.
- **Prompt tokens:** `tokens_prompt`.
- **Completion tokens:** `tokens_completion`.
- **Total tokens:** `tokens_total` (use API-provided total rather than recomputing if available).
- **Model ID:** API-returned canonical model slug; no hardcoded model list.
- **Sort:** descending `credits_usage`, then descending `request_count`, then ascending model name for stable ties.
- **Zero usage:** if there are no model rows, show a friendly empty state, not a blank layout.

---

## 8. OpenRouter API integration

Use only `https://openrouter.ai/api/v1`, over HTTPS, with `Authorization: Bearer <management-key>`. This is a local CLI that performs read-only requests and does not transmit the key elsewhere.

### 8.1 API endpoints

| Endpoint | Method | When used | Authentication |
|---|---|---|---|
| `/credits` | GET | Account credit summary | Management key |
| `/analytics/meta` | GET | Discover available metrics and dimensions; validate compatibility | Management key |
| `/analytics/query` | POST | Per-model spending, requests, tokens | Management key |
| `/activity` | GET | Optional simple 30 **completed UTC day** fallback, not the default analytics engine | Management key |
| `/key` | GET | Optional future single-inference-key mode; **not** account totals | Inference key for its own metadata |

### 8.2 Credits request/response

Request:

```http
GET /api/v1/credits
Authorization: Bearer <management-key>
```

Illustrative response:

```json
{
  "data": {
    "total_credits": 100.5,
    "total_usage": 25.75
  }
}
```

Calculate `remaining = total_credits - total_usage` **without an extra API call**. Preserve USD decimal precision in the normalized data model; round only for UI display (do not repeatedly round intermediate sums).

### 8.3 Analytics metadata discovery

Use `GET /api/v1/analytics/meta` to confirm requested metrics/dimensions remain supported. Cache successful metadata for a conservative period (e.g., 24 hours); refresh on a schema-related 400 response. The live metadata endpoint is authoritative over examples in this document.

For the MVP, verify `model` and these metrics:

- `credits_usage`
- `request_count`
- `tokens_total`
- `tokens_prompt`
- `tokens_completion`
- Optional: `total_usage`, `byok_usage`

If a required metric is unavailable, display a clear partial/unsupported state. Do not silently map a differently defined field without documenting the change.

### 8.4 Analytics query

Use **one aggregate query** with no `granularity` so there is one result row per model, avoiding unnecessary daily time-series processing and client aggregation.

**Example request** (replace timestamps dynamically; no hardcoded dates in source):

```http
POST /api/v1/analytics/query
Authorization: Bearer <management-key>
Content-Type: application/json
```

```json
{
  "metrics": [
    "credits_usage",
    "request_count",
    "tokens_total",
    "tokens_prompt",
    "tokens_completion",
    "total_usage",
    "byok_usage"
  ],
  "dimensions": ["model"],
  "time_range": {
    "start": "2026-09-29T00:00:00Z",
    "end": "2026-10-29T00:00:00Z"
  },
  "order_by": { "field": "credits_usage", "direction": "desc" },
  "limit": 1000
}
```

*The dates above illustrate the required ISO-8601 UTC format. The CLI must use the chosen rolling window instead. If the server caps ranges or disallows a combination, surface that fact.*

Illustrative shape to parse:

```json
{
  "data": {
    "data": [
      {
        "model": "openai/gpt-4.1",
        "credits_usage": 6.8,
        "request_count": "236",
        "tokens_total": "1800000",
        "tokens_prompt": "1600000",
        "tokens_completion": "200000",
        "total_usage": 6.8,
        "byok_usage": 0
      }
    ],
    "metadata": {
      "row_count": 1,
      "truncated": false,
      "query_time_ms": 42
    }
  }
}
```

**Response parsing rules:**

- The data rows are nested at **`response.data.data`**; metadata is at **`response.data.metadata`**.
- Count metrics may arrive as decimal strings or JSON numbers. Accept both, validate, and avoid integer precision loss for very large values (prefer lossless handling where needed).
- Monetary metrics may be numbers; validate finite numeric values.
- Sanitize all API-provided model names and errors before ANSI formatting. Untrusted control characters must not be able to alter the terminal.
- `metadata.truncated === true` means **partial results**. Retry with a higher permitted limit if reasonable; if still truncated, label the result as incomplete and **do not present incomplete aggregates as complete**.
- API response warnings, if present, must not be silently suppressed when they affect fidelity.
- Return stable, normalized values to the renderer; keep HTTP data shapes out of view code.

### 8.5 Optional fallback to `/activity`

`GET /api/v1/activity` returns activity records grouped by endpoint over the **last 30 completed UTC days**. It is a useful fallback only when analytics cannot be queried and the user accepts its fixed period. It is **not** a drop-in equivalent for current-day or arbitrary date ranges.

If this fallback is implemented:

- Group rows by model in application code.
- Sum `requests`, `prompt_tokens`, and `completion_tokens`.
- Clearly label the time period as **last 30 completed UTC days**.
- Check the endpoint's `usage` and BYOK semantics before using it for the **Credit spend** column; do not silently substitute a different cost definition.
- If correct spend attribution cannot be guaranteed, show model activity without a comparable spend amount and explain why.

**Recommendation:** Do **not** use this fallback in the first implementation unless necessary. Prefer a simple, tested analytics integration and explicit error states.

### 8.6 Parallelism, caching, and resilience

- Fetch `/credits` and `/analytics/query` concurrently once authentication/metadata requirements are satisfied.
- Network request timeout: target **8 seconds** each; allow one bounded retry for transient connection failures or 5xx/429 responses, respecting `Retry-After` where provided.
- Do not retry 400, 401, or 403 indefinitely.
- Cache non-secret normalized response data under `~/Library/Caches/orpeek/` for **up to 60 seconds** to improve repeated invocations; cache files must have `0600` permissions and directory `0700`.
- Cache entries must be scoped to the currently configured credential **without storing a key, reversible fingerprint, or unmasked token**. Rotation invalidates cache.
- `--fresh` bypasses cached data; `--no-cache` bypasses reads/writes if implemented.
- Always distinguish `Live`, `Cached (age)`, and `Stale/offline (age)` results. Never display stale numbers as freshly fetched.
- If one endpoint fails, render the available section and a section-specific error. Avoid reducing a partially successful command to an empty screen.
- For an offline launch, optionally show the last successful cached data with an explicit **STALE** notice; never hide an authentication failure behind a stale cache without a warning.
- Caching usage metadata is a privacy tradeoff; document the local path, provide `auth remove` cleanup, and consider a config toggle in follow-up releases.

---

## 9. CLI commands and flags

### 9.1 Command structure

```text
orpeek [options]              Display the dashboard (default)
orpeek auth set               Verify and store a management key
orpeek auth status            Display authentication status only
orpeek auth remove [--yes]    Remove stored key and cache
orpeek --help                 Usage and documentation
orpeek --version              Package version
```

### 9.2 Dashboard options

| Flag | Default | Behavior |
|---|---|---|
| `--period <7d|30d|90d|365d>` | `30d` | Period for the model analytics table only |
| `--top <N>` | `10` | Show top N models; positive integer, bounded |
| `--all` | false | Show every retrieved model; supersedes `--top` |
| `--sort <spend|calls|tokens>` | `spend` | Sort descending by selected metric |
| `--json` | false | Machine-readable normalized JSON, no ANSI/progress UI |
| `--fresh` | false | Ignore cache and fetch latest available values |
| `--no-color` | automatic | Force plain output |
| `--help` | — | Show help and exit success |
| `--version` | — | Print version and exit success |

Use `NO_COLOR` and `TERM=dumb` conventions. Invalid flags must produce a concise error with a suggestion to run `--help`, rather than being ignored.

**Examples:**

```sh
npx orpeek@latest
orpeek --period 7d
orpeek --period 90d --top 5
orpeek --all --sort calls
orpeek --json | jq '.models[] | {model, credit_spend_usd}'
orpeek --fresh --no-color
orpeek auth set
orpeek auth remove
```

---

## 10. Terminal UI and behavior

### 10.1 Design principles

- **One glance:** credits summary and most important models visible without scrolling on a conventional terminal.
- **Minimal:** no banners, ASCII art, splash screens, heavy border boxes, spinner animations on every run, or irrelevant trivia.
- **Honest labels:** all-time credits versus date-filtered model usage always clearly distinguished.
- **Information hierarchy:** remaining credits prominent; model spend sorted biggest first.
- **Responsive:** different output for narrow terminals, non-interactive pipes, and no-color mode.
- **Accessible:** information must not rely on color alone; all status messages must be textual.

### 10.2 Proposed default layout

```text
orpeek  OPENROUTER USAGE                                        just now
──────────────────────────────────────────────────────────────────────
ACCOUNT CREDITS · ALL TIME

  Purchased         $100.50
  Used               $38.25
  Remaining          $62.25         62% remaining
  ████████████░░░░░░░░

MODEL USAGE · LAST 30 DAYS (UTC)                       Credit spend

  MODEL                             SPEND      CALLS      TOKENS
  anthropic/claude-sonnet-4        $12.40        418        3.2M
  openai/gpt-4.1                    $6.80        236        1.8M
  google/gemini-2.5-pro             $4.30        152        940K
  deepseek/deepseek-r1              $2.25         84        510K

  4 models · 890 calls · 6.45M tokens
  All-time credits and 30-day model spend are different windows.
```

### 10.3 Layout rules

- Default table shows **up to 10 models**; if additional models exist, show `+N more (use --all)`.
- Model IDs may be lengthy; truncate the middle or right side according to available width, but preserve full model IDs in `--json` and never combine distinct models into one row accidentally.
- Align numeric columns right; align model names left.
- Use `$0.00` for normal USD amounts; for positive tiny spend below 1 cent, show `<$0.01` or a documented precision convention instead of misleading `$0.00`.
- Token display: `1,240`, `12.4K`, `3.2M` with stable rounding; exact integers in JSON.
- Use a single accent color for positive/remaining state, muted gray for secondary text, and restrained warning color for errors/very low balance.
- Do not use emoji in critical columns (width varies by terminal font).
- Respect a narrow 80-column terminal; at widths below ~60, collapse from multiple columns into concise per-model rows rather than force horizontal scrolling.
- If stdout is piped, default to plain, stable text without interactive cursor control or progress spinners.
- In `--json` mode write **only valid JSON** to stdout. Send any diagnostic message to stderr, or represent it in the JSON output explicitly.

### 10.4 Loading and empty states

- Show no spinner if requests finish quickly; if they take longer than ~300 ms, a single unobtrusive loading indicator is acceptable only on an interactive TTY.
- Don't print multiple successive screens or scrollback junk.
- If balance is zero, show the zero clearly and do not imply a network failure.
- If no model data exists for the period: `No model usage found in the last 30 days.`
- If one section is unavailable, show `Unavailable` plus a concise reason, while retaining the other section.
- Always show freshness information (`just now`, `cached 38s ago`, or `stale since ...`).

---

## 11. JSON output contract

`--json` is a stable machine-readable output mode. Define and version the shape; do not expose provider-specific nested API structures directly.

Illustrative **v1** output:

```json
{
  "schema_version": 1,
  "source": "openrouter",
  "generated_at": "2026-10-29T09:00:00Z",
  "freshness": "live",
  "period": {
    "label": "30d",
    "start_utc": "2026-09-29T09:00:00Z",
    "end_utc": "2026-10-29T09:00:00Z"
  },
  "account": {
    "purchased_credits_usd": 100.5,
    "used_credits_usd": 25.75,
    "remaining_credits_usd": 74.75
  },
  "models": [
    {
      "model": "openai/gpt-4.1",
      "credit_spend_usd": 6.8,
      "total_usage_usd": 6.8,
      "byok_usage_usd": 0,
      "requests": 236,
      "prompt_tokens": 1600000,
      "completion_tokens": 200000,
      "total_tokens": 1800000
    }
  ],
  "model_results_complete": true,
  "warnings": []
}
```

**Contract requirements:**

- No credential, credential prefix, hashed credential, HTTP Authorization header, or other secret fields.
- Money amounts are USD numbers, never formatted strings. Avoid making unsupported precision claims beyond the source data.
- `null` for unavailable metrics; do not substitute `0` for “unknown.”
- If partial failure occurs, choose a documented machine-consumable strategy: populate unavailable sections as `null`, emit structured warnings, and exit with a nonzero partial-result status. Do not print a malformed fragment.
- Distinguish `model_results_complete: false` if the server truncated rows.
- Stable sort order and full model slugs.

---

## 12. Architecture and implementation guidance

### 12.1 Recommended stack

- **TypeScript**, compiled to an ESM Node.js executable.
- Node.js built-in `fetch`, `AbortController`, `process.stdout.columns`, `node:util`, and `node:fs`.
- Minimal custom ANSI formatting or a single small, audited terminal styling dependency if needed.
- A reviewed **macOS Keychain Services implementation**; security is more important than meeting an arbitrary “zero dependencies” goal.
- Node's built-in test runner (`node:test`) or an equivalent lightweight test tool.
- Build with a single established bundler (e.g., `tsup`/`esbuild`) only when it materially reduces package complexity.

### 12.2 Suggested internal modules

```text
src/
  cli.ts                  # Parse commands/flags and choose output mode
  auth.ts                 # Onboarding, validation, rotation, deletion
  keychain.ts             # Minimal Keychain adapter (no UI logic)
  api.ts                  # HTTPS requests, timeouts, retries
  analytics.ts            # Query construction and response normalization
  credits.ts              # Account balances and derived values
  cache.ts                # Optional non-secret short-lived cache
  render.ts               # TTY layout, accessibility, compact rendering
  format.ts               # USD, token, elapsed time formatting
  types.ts                # Stable domain types / JSON schema
  errors.ts               # Typed error mapping
  index.ts                # Executable entry point

tests/
  fixtures/
  auth.test.ts
  api.test.ts
  analytics.test.ts
  render.test.ts
  cli.test.ts

package.json
README.md
REQUIREMENTS.md
LICENSE
```

This structure is a guide, not a mandate to create unnecessary abstractions. Keep functions plain and avoid framework architecture for a small CLI.

### 12.3 High-level request flow

```text
Command invoked
     |
Parse arguments → help/version/auth actions (exit early as needed)
     |
Read Keychain credential
     | absent
     +--------→ Secure first-run setup → Validate → Store
     |
Determine UTC analytics period and cache validity
     |
Fetch /credits + /analytics/query (in parallel)
     |                 |
Normalize account  Normalize model rows / completeness
     \                 /
      Merge into domain data
              |
      Render TTY or --json
              |
       Exit with status
```

### 12.4 Implementation constraints

- No background daemon or scheduled request loop.
- No user tracking or telemetry unless separately documented and explicitly opted into a later release.
- No shell invocation with an untrusted model name, API field, or user input.
- No automatic update checker in MVP.
- No dynamic eval or runtime downloading of arbitrary code outside npm's ordinary package workflow.
- Networking must be restricted to documented OpenRouter HTTPS endpoints for core functionality.
- Keep all display text and calculations testable without actual network access.

---

## 13. Errors and exit codes

| Situation | Required user experience |
|---|---|
| No key configured | Start onboarding if interactive; print setup instructions + nonzero exit in non-interactive mode |
| Incorrect/expired key (`401`) | State `Management key invalid or expired`; suggest `orpeek auth set`; never echo the key |
| Inference key used for analytics (`403`) | Explain management key requirement and link to management key settings |
| API denies account billing access | Show permissions-specific error, not `No credits` |
| Keychain locked/denied | Explain macOS Keychain permission issue and recovery; no insecure fallback |
| Offline/DNS/TLS failure | Concise network error; optionally show clearly marked stale data |
| Timeout / `408` | Suggest retrying with `--fresh` or narrower period; bounded retries only |
| Rate limit (`429`) | Respect server `Retry-After` when safe; no rapid retry loop |
| OpenRouter `5xx` | Show temporary service failure; preserve independent successful section |
| Invalid analytics schema / `400` | Refresh metadata once, retry only if query can be repaired; otherwise explain unsupported metric |
| Zero credits | Show actual zero and a 0% remaining visual; no exception |
| Empty model data | Friendly `No usage for this period` state |
| Truncated model data | Clearly disclose partial results; don't mark aggregate complete |
| Terminal is too narrow | Render compact rows; never crash |
| Ctrl-C during setup | Cancel cleanly; do not save a partial/invalid key |

**Suggested exit statuses** (document before publishing):

- `0` = successful, complete output.
- `1` = general or unexpected failure.
- `2` = invalid CLI usage/arguments.
- `3` = authentication or Keychain access issue.
- `4` = network/API failure preventing full success.
- `5` = partial/incomplete result (especially useful for `--json`).

Avoid swallowing exceptions or printing raw API error bodies if they could contain sensitive information.

---

## 14. Security and privacy requirements

### Mandatory

- [ ] Management key is never printed, logged, included in cache files, or stored in plaintext config.
- [ ] The key never appears in `ps`/process arguments; no shell command interpolation containing it.
- [ ] Key is not saved to an environment variable, shell history, crash log, analytics service, or a remote server other than OpenRouter.
- [ ] Authentication request headers are stripped/redacted in all errors and debug logs.
- [ ] The Keychain item is removed by `auth remove` and replaced safely by `auth set`.
- [ ] No secret text appears in `--json` under any circumstances.
- [ ] Keychain permissions and OS authorization prompts are handled honestly.
- [ ] Terminal escape/control sequences from untrusted API strings are stripped.
- [ ] HTTPS certificate validation remains enabled; no `--insecure` option.
- [ ] Dependencies are scanned, locked, and reviewed before release; generated build artifacts are inspected.
- [ ] Cache usage data, if enabled, is documented as **non-secret but potentially sensitive** and secured with filesystem permissions.

### Threat model / limitations

Keychain reduces accidental leakage and provides OS-backed credential storage. It does **not** protect against malware with access to the current user's unlocked session, malicious dependencies, compromised terminal tools, or a compromised OpenRouter account. A management key can have administrative capabilities beyond this read-only CLI; treat it as sensitive even though `orpeek` only calls read endpoints.

Do not use `curl | sh` as the default install pattern: it runs remotely fetched code without review and adds unnecessary installer risk. If a future one-liner is offered, pin versions, publish checksums/signatures, and prominently document what the script does.

---

## 15. Performance, reliability, and quality targets

Targets are engineering goals, not guarantees for every network condition:

| Measure | Target |
|---|---|
| Warm cached startup | Dashboard rendered in **under 300 ms** on a representative modern Mac, excluding npm registry overhead |
| Uncached invocation | **Under 5 seconds median** on a healthy typical connection |
| API timeout | Roughly 8 seconds per request, with bounded retries |
| Local idle CPU | Zero between invocations; no daemon |
| Install requirements | Node and npm only; no Xcode required on target machine |
| Data integrity | No falsely labeled current, complete, or zero values |
| Screen size | Reasonably readable at 80 columns; graceful compact fallback |
| Repeat usage | No key re-entry unless revoked, expired, manually rotated, or OS access denied |

Do not let “fast” justify ignoring truncation, auth problems, or stale-response labels.

---

## 16. Testing plan

### 16.1 Unit tests

- Credits arithmetic for normal, zero, negative, fractional, missing, and unexpectedly large values.
- Percent progress edge cases, including `total_credits = 0`.
- USD and token formatting (including sub-cent spend, zero, and millions).
- Analytics parsing with string and numeric counts, null/missing metrics, empty rows, and `metadata.truncated`.
- Stable sorting by spend/calls/tokens and full-name preservation.
- UTC trailing period calculation, leap days, month boundaries, daylight-saving offsets, and clock changes.
- ANSI/control-character sanitization and width-aware truncation.
- Argument parsing, mutually conflicting flags, and non-interactive mode.
- JSON schema validity and deterministic field types; ensure no credential-bearing strings.

### 16.2 API integration tests (mocked)

- All expected response shapes (`credits`, `analytics/meta`, `analytics/query`).
- 400/401/403/408/429/500 statuses, malformed JSON, truncated body, network disconnect, timeout, `Retry-After`.
- Independent failure of credits and analytics requests.
- Metadata change leading to query repair or an honest unsupported-state error.
- Server-reported truncation; repeated larger-limit attempt; incomplete-result warning.
- Cached result with age/freshness; cache invalidation after credential rotation.

### 16.3 macOS manual acceptance matrix

- Fresh install on an **Apple Silicon** Mac.
- Fresh install on an **Intel** Mac (real device or trustworthy equivalent).
- Keychain unlocked, locked, access granted, and access denied.
- Fresh key, invalid key, inference key, expired key, key rotation, key removal.
- Verify via OS process inspection that the key does not appear in argv during setup.
- Terminal.app, iTerm2, and a third terminal emulator.
- 120+, 80, and 50-column widths; `NO_COLOR`; output piped to a file.
- `npx` run, globally installed command, and repeat runs.
- Airplane/offline mode with and without an existing cache.
- An account with zero usage and one with many models.
- On-device validation that no secret is written to plaintext files.

### 16.4 Acceptance scenarios

**Scenario A — first run:** Given macOS with Node and npm, no stored key, and a valid management key, running `npx orpeek@latest` results in one hidden secret entry, successful Keychain storage, and both dashboard sections.

**Scenario B — returning:** Given a stored working key, running `orpeek` shows both sections without prompting for the secret.

**Scenario C — model visibility:** Given model analytics, the table contains genuine model IDs, accurate credit spend, requests and tokens, sorted by spend, with an accurate selected-period label.

**Scenario D — no network:** Given an offline machine, the CLI exits promptly with a useful error; any cached data is explicitly marked stale.

**Scenario E — invalid auth:** Given a regular inference key rather than management key, setup does not misleadingly claim full functionality and links to the correct settings page.

**Scenario F — key removal:** Given a stored key and cache, `orpeek auth remove` deletes both and the next interactive invocation initiates onboarding again.

**Scenario G — automation:** Given a healthy account, `orpeek --json` produces a single parseable JSON document, with no ANSI, secret, or extra stdout chatter.

**Scenario H — data truncation:** Given a truncated analytics response, the CLI retries within limits or prominently reports incompleteness, and `model_results_complete` is false.

---

## 17. Documentation and release checklist

### Repository documentation

- `README.md`: 30-second quick start, sample screenshot/output, key setup link, Node prerequisite, examples.
- `REQUIREMENTS.md`: this specification.
- `SECURITY.md`: how/where credentials are stored, threat model, vulnerability reporting, cache details.
- `CHANGELOG.md`: version history.
- `LICENSE`: clear open-source terms if publishing openly.

### Package/release requirements

- [ ] Confirm `orpeek` npm package name availability.
- [ ] Confirm supported Node version in package `engines`.
- [ ] Confirm package `bin` executes successfully on clean macOS machines.
- [ ] Confirm prebuilt native keychain components work without compilation if used.
- [ ] Ensure published npm tarball contains only needed runtime files.
- [ ] Run all unit/integration tests and macOS acceptance tests.
- [ ] Check dependency audit and release provenance.
- [ ] Validate npm publish permissions and 2FA.
- [ ] Release an initial `0.1.0` and test installation from the public npm registry.
- [ ] Do not promote `npx orpeek@latest` as usable until publishing is complete.
- [ ] Verify README examples against the exact published version and current API contract.

### Suggested milestones

**M1 — Core domain/API:** type definitions, credits calculation, analytics aggregate query, validated schema, fixture-based tests.  
**M2 — Security/onboarding:** macOS Keychain adapter, key verification, first-run UX, rotation/removal tests.  
**M3 — Presentation:** responsive dashboard, sorting, formatting, plain/JSON output, error handling.  
**M4 — Distribution:** compile, package, end-to-end installation testing, README, GitHub release, npm publish.

Do not turn milestones into separate applications or services; one CLI package is enough.

---

## 18. Future improvements (not MVP blockers)

1. **Per-key limits:** Choose an inference key and show its `limit`, `limit_remaining`, `limit_reset`, and time-windowed usage. Clearly separate it from account credits.
2. **BYOK view:** Display OpenRouter credit charges alongside estimated external BYOK inference costs with distinct labels.
3. **Multiple accounts:** Named profiles with separate Keychain items, e.g., `orpeek --profile work`.
4. **Workspaces and apps:** Optional analytics grouping/filtering without changing the default glanceable screen.
5. **Trends:** `--period`, comparisons, sparklines, or top model change over time.
6. **Automatic refresh:** Explicit `--watch` mode with configurable polling; never default to background activity.
7. **Standalone installer:** Verified/checksummed signed binaries or Homebrew; only if it meaningfully improves adoption beyond `npx`.
8. **Budget alerts:** Local threshold warnings based on supported account/key metrics, without misleading guesses or hidden background jobs.
9. **Accessibility/localization:** User-customizable width and color themes, improved screen-reader output.

---

## 19. Open decisions to settle before coding

These are explicit decisions rather than unresolved blockers; the preferred defaults below are safe for the MVP:

| Question | Preferred MVP decision |
|---|---|
| Name | `orpeek`, contingent on npm availability |
| Key type | Management key only |
| Secret storage | Native macOS Keychain Services (one-entry setup; no argv exposure) |
| Credits heading | Purchased / Used / Remaining (not “Limit”) |
| Default model spend | `credits_usage` charged to OpenRouter credits |
| Default time window | Last 30 × 24 hours (UTC) |
| Default rows | 10, sorted by credit spend |
| More models | `--all` |
| First-run non-interactive behavior | Fail helpfully; no insecure prompt fallback |
| Cache | Optional 60-second cache; always disclose freshness |
| Package runtime | Small compiled TypeScript/Node executable |
| API activity fallback | Not needed for initial release |
| Model metric schema drift | Check `/analytics/meta`, fail visibly rather than silently mislabel |
| “Limit” support | Only in future optional key-specific mode |

---

## 20. Authoritative references / implementation links

Checked while drafting this spec on **29 October 2026**. API contracts may change; prefer live OpenRouter metadata and current documentation during implementation.

1. **Get account credits** — https://openrouter.ai/docs/api/api-reference/credits/get-credits  
   Confirms management-key requirement and `total_credits` / `total_usage` response.
2. **OpenRouter Analytics Query** — https://openrouter.ai/docs/api/api-reference/beta-analytics/query-analytics  
   Required metrics/dimensions/query structure (some older URLs contain `beta-analytics`).
3. **OpenRouter Analytics Metadata** — https://openrouter.ai/docs/api/api-reference/beta-analytics/get-analytics-meta  
   The live `GET /api/v1/analytics/meta` endpoint is authoritative even if documentation routes move.
4. **Activity endpoint** — https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity  
   Last 30 completed UTC days and grouped usage response.
5. **Current API-key details** — https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key  
   Single-key limits/usage, not account billing.
6. **OpenRouter's Analytics Query Skill** — https://github.com/OpenRouterTeam/skills/blob/main/skills/openrouter-analytics-query/SKILL.md  
   Detailed response shape, data types, truncation, and time-window notes.
7. **OpenRouter's Analytics Schema Skill** — https://github.com/OpenRouterTeam/skills/blob/main/skills/openrouter-analytics-schema/SKILL.md  
   Definitions of `credits_usage`, `total_usage`, `byok_usage`, and token/call metrics.
8. **Analytics API overview** — https://openrouter.ai/blog/announcements/activity-dashboard/  
   Official overview, metadata-first guidance, account capabilities.
9. **Apple Keychain `security` reference** — https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/security.1  
   Keychain command behavior and warnings about passing passwords on command lines.
10. **Management keys** — https://openrouter.ai/settings/management-keys  
    User-facing location to create the credential required for model analytics.

---

## 21. Final definition of done

The MVP is complete when a user can execute **one published npm command** on a clean supported Mac, provide a management key once through a secret-input flow, have it stored securely in **macOS Keychain**, and immediately get a **clean, fast, correctly labeled account-credit overview and per-model usage table**. Later launches must need no credential entry. Every number must come from a verified OpenRouter response, missing or stale data must be identified honestly, and a JSON option must support scripting without leaking credentials.
