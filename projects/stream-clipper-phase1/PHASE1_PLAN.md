# Phase 1 Plan (Cost-Optimized): Livestream Clip Detection MVP

## TL;DR
Build a **single-stream, Twitch-first** system that detects highlight candidates in near real time, creates **draft clips only**, and pushes them to a lightweight review queue for humans.

For Phase 1, optimize for:
1. **Reliability** (retries, idempotency, dead-letter queue)
2. **Observability** (metrics/logs/traces from day one)
3. **Low cost + low ops overhead** (few moving parts, managed services where it matters)

---

## 0) Product Scope and Non-Goals

### In-scope for Phase 1
- Watch one Twitch stream source.
- Keep a rolling video buffer (e.g., last 5–10 minutes).
- Detect candidate moments via heuristics + optional ML signal.
- Generate draft clip assets.
- Store full metadata and scoring rationale.
- Provide review UI queue (approve / reject / needs-edit).
- Add lightweight moderation hooks.

### Explicit non-goals for Phase 1
- No auto-posting.
- No multi-platform publishing.
- No advanced multi-tenant access model.
- No hard dependency on any single ML model.

---

## 1) Proposed Phase 1 Architecture

```text
Twitch Stream
   |
   v
[Ingest Worker]
  - streamlink + FFmpeg segmenter
  - rolling buffer in object storage
   |
   +--> segment.ready (queue)
             |
             v
      [Signal/Detector Worker]
       - audio/motion/chat heuristics
       - optional ML score adapter
       - dedupe + cooldown
             |
             +--> candidate.created (queue)
                         |
                         v
                  [Clip Worker]
                   - FFmpeg clip extraction
                   - thumbnail generation
                   - moderation hook call
                         |
                         +--> clip.draft_ready (queue)
                                       |
                                       v
                          [Review API + Web UI]
                           - queue view + playback
                           - approve/reject/needs-edit

State: Postgres
Blob storage: S3-compatible (MinIO local, S3/R2 prod)
Queue: Redis Streams
```

### Why this architecture?
- Minimal number of deployables.
- Async queues isolate failures between stages.
- Easy to swap Twitch adapter and add future platform outputs.
- FFmpeg pipeline remains explicit and debuggable.

---

## 2) Service Boundaries (Phase 1)

## A) Ingest Service
**Responsibilities**
- Connect to Twitch stream.
- Segment stream to short chunks (2–4s).
- Manage rolling retention window.
- Emit `segment.ready`.

**Owns tables/events**
- `stream_sources`, `stream_sessions`, `buffer_segments`.

## B) Detection Service
**Responsibilities**
- Compute segment/window features.
- Run heuristic scoring + optional ML plugin.
- Create clip candidates with rationale.
- Enforce cooldown + dedupe.

**Owns tables/events**
- `segment_signals`, `clip_candidates`, `candidate.created`.

## C) Clip Service
**Responsibilities**
- Resolve candidate boundaries.
- Build draft clip + thumbnail with FFmpeg.
- Register assets and draft records.

**Owns tables/events**
- `draft_clips`, `clip.draft_ready`.

## D) Moderation Hook (module first, service later)
**Responsibilities**
- Rule-based safety checks initially.
- Optional third-party moderation adapters.

**Owns tables/events**
- `moderation_flags`.

## E) Review App (API + UI)
**Responsibilities**
- Serve pending queue.
- Show rationale + moderation flags + playback.
- Record decision and audit event.

**Owns tables/events**
- `review_decisions`, audit/event trail.

---

## 3) Recommended Stack (Best for Cost + Speed)

## Runtime split (recommended)
- **Python workers** for ingest/detection/clip pipeline.
- **Next.js (TypeScript)** for review API + UI (fits existing repo).

## Core components
- FFmpeg + ffprobe (media pipeline)
- streamlink (Twitch ingest reliability)
- Redis Streams (queue + low-latency worker handoff)
- Postgres (source of truth)
- S3-compatible object storage (MinIO local, S3/R2 prod)
- OpenTelemetry + Prometheus metrics + structured logs

## Managed services recommendation (cost-aware)
- **Database**: Managed Postgres (Neon/Supabase/RDS small tier)
- **Queue/cache**: Managed Redis (Upstash/Elasticache small tier)
- **Object storage**: Cloudflare R2 (egress-friendly) or S3
- **Hosting**:
  - Review app: Vercel
  - Workers: single low-cost VM (Hetzner/DigitalOcean/AWS Lightsail) initially

### Why this is cost efficient
- One worker VM can handle a single stream MVP cheaply.
- Object storage + queue costs scale mostly with usage.
- Keep expensive ML calls optional and sampled.
- Avoid Kubernetes in Phase 1.

---

## 4) Cost Envelope (Early Estimate)

For **1 stream, ~8 hrs/day, moderate clipping volume**:

- Worker VM (2–4 vCPU): **$20–$60/month**
- Managed Postgres small tier: **$0–$30/month**
- Managed Redis small tier: **$0–$20/month**
- Object storage (clips + short retention buffer): **$5–$25/month**
- Observability SaaS (optional at first): **$0–$30/month**

**Expected MVP total:** roughly **$25–$135/month** depending on provider and usage.

Cost control levers:
- Shorter buffer retention (5 min vs 10 min).
- Lower output bitrate for drafts.
- Cap max clips/hour.
- Run optional ML scorer only on pre-filtered high-signal windows.

---

## 5) Data Model (Phase 1)

### stream_sources
- `id`, `platform`, `channel_name`, `status`, `created_at`, `updated_at`

### stream_sessions
- `id`, `stream_source_id`, `started_at`, `ended_at`, `health_status`, `last_segment_ts`

### buffer_segments
- `id`, `stream_session_id`, `sequence_no`, `started_at`, `duration_ms`, `storage_key`, `checksum`

### segment_signals
- `id`, `segment_id`, `audio_rms`, `audio_peak`, `motion_score`, `scene_change_score`, `chat_velocity`, `ml_score`, `computed_at`

### clip_candidates
- `id`, `stream_session_id`, `anchor_ts`, `window_start_ts`, `window_end_ts`, `heuristic_score`, `ml_score`, `total_score`, `reason_codes[]`, `status`, `created_at`

### draft_clips
- `id`, `candidate_id`, `stream_session_id`, `start_ts`, `end_ts`, `duration_ms`, `video_storage_key`, `thumb_storage_key`, `rationale_json`, `moderation_state`, `created_at`

### moderation_flags
- `id`, `draft_clip_id`, `flag_type`, `severity`, `details_json`, `created_at`

### review_decisions
- `id`, `draft_clip_id`, `decision`, `reviewer`, `notes`, `created_at`

### pipeline_events
- `id`, `event_type`, `entity_type`, `entity_id`, `payload_json`, `trace_id`, `created_at`

### processing_failures
- `id`, `stage`, `entity_type`, `entity_id`, `error_class`, `error_message`, `retry_count`, `resolved_at`

---

## 6) Event Flow End-to-End

1. Stream source is configured (`twitch:<channel>`).
2. Ingest worker starts session + writes short segments.
3. Each segment upload triggers `segment.ready` event.
4. Detection worker computes features and rolling-window scores.
5. If score threshold passes and cooldown allows, create `clip_candidate`.
6. Clip worker extracts pre/post context window using FFmpeg.
7. Draft clip + thumbnail saved to storage, DB record written.
8. Moderation hook attaches flags (if any).
9. Review UI shows pending draft with rationale panel.
10. Reviewer action recorded: approve/reject/needs-edit.
11. Audit/event records stored for later analytics.

Reliability mechanics:
- Idempotency keys for each stage.
- Retry with exponential backoff.
- Dead-letter queue for poison jobs.
- Periodic reconciliation job for stuck entities.

---

## 7) Detection Approach: Heuristics First, ML Optional

## Heuristic signals (must-have)
- Audio spike / RMS change
- Silence-to-loud transition
- Frame-diff/motion spike
- Chat velocity spike (optional if chat ingest enabled)

## Scoring
`total_score = w1*audio + w2*motion + w3*chat + w4*ml_optional`

Rules:
- If ML unavailable, set `ml_optional = 0`.
- Persist full feature vector + weights used for transparency.
- Add per-stream dynamic threshold (rolling percentile) after baseline week.

## ML adapter (later in Phase 1 or Phase 2)
- Keep behind interface (`score_window(features) -> float`).
- Start with mock deterministic scorer.
- Allow shadow-mode evaluation without affecting production gating.

---

## 8) MVP Milestones (Small, Taskable)

## Milestone 0: Repo and infra scaffolding (1–2 days)
- [ ] Create `projects/stream-clipper-phase1/` docs + task backlog.
- [ ] Add docker compose: Postgres, Redis, MinIO.
- [ ] Define base environment variables and secrets contract.
- [ ] Define event payload schemas.

## Milestone 1: Ingest + rolling buffer (2–4 days)
- [ ] Twitch config + session lifecycle.
- [ ] Segment writer (2–4s chunks).
- [ ] Buffer pruning job (TTL).
- [ ] `segment.ready` publisher.
- [ ] Heartbeat + reconnect logic.

## Milestone 2: Detection worker (3–5 days)
- [ ] Audio + motion feature extraction.
- [ ] Candidate scoring + threshold + cooldown.
- [ ] Reason-code/rationale persistence.
- [ ] Candidate dedupe (time overlap + fingerprint).

## Milestone 3: Draft clip generation (2–4 days)
- [ ] Candidate window resolution.
- [ ] FFmpeg export + thumbnail.
- [ ] Object storage upload + metadata write.
- [ ] Retry/backoff/DLQ handling.

## Milestone 4: Review queue UI/API (2–4 days)
- [ ] Pending queue endpoint.
- [ ] Clip detail endpoint.
- [ ] Review action endpoint.
- [ ] Internal UI: list + player + rationale panel + moderation tags.

## Milestone 5: Moderation and observability hardening (2–3 days)
- [ ] Rule-based moderation checks.
- [ ] Structured JSON logs + correlation IDs.
- [ ] Metrics and basic alerts.
- [ ] Lightweight runbook.

## Milestone 6: Stabilization + demo (1–2 days)
- [ ] Replay test using recorded stream fixture.
- [ ] Tune thresholds for acceptable reviewer load.
- [ ] Demo run-through and bug sweep.

---

## 9) Technical Risks + Mitigations

1. **Ingest instability**
   - Auto-reconnect, heartbeat watchdog, session state machine.
2. **Too many false positives**
   - Cooldown, dedupe, and threshold tuning with rejection feedback.
3. **Clip boundaries miss key moment**
   - Add pre-roll/post-roll defaults and fallback re-encode.
4. **Storage growth/cost spikes**
   - Strict TTL + compression + daily storage alarms.
5. **Operational complexity creep**
   - Keep to 2 deployables initially (workers + review app).
6. **Moderation misses**
   - Human approval required before any downstream use.

---

## 10) Build vs Mock in Iteration 1

## Build now
- Real Twitch ingest
- Real FFmpeg segmentation/extraction
- Real queue + workers
- Real Postgres persistence
- Real review queue interface

## Mock/stub now
- External moderation APIs
- Advanced ML scoring models
- Speech-to-text/NLP enrichments
- Publishing connectors (TikTok/YouTube/IG/X)

Rationale: reduce delivery risk while preserving extension points.

---

## 11) Local Dev + Deployment

## Local dev
- `docker compose up` for Postgres/Redis/MinIO.
- Run workers via Python env (`uv` or `poetry`).
- Run review app in Next.js dev mode.
- Use one fixture stream file for deterministic pipeline tests.

## Deployment recommendation
### Phase 1 fastest path
- Review app on Vercel.
- Workers on one VM with process supervisor.
- Managed Postgres + managed Redis + R2/S3.

### Phase 2 scale path
- Move workers to container scheduler (ECS/K8s) only when concurrency and uptime demand it.

---

## 12) Observability: Required Day-One Signals

## Metrics
- `ingest_reconnect_total`
- `segment_ingest_lag_seconds`
- `segments_processed_total{stage=...}`
- `candidate_created_total`
- `clip_draft_latency_ms` (p50/p95)
- `clip_generation_fail_total`
- `queue_lag_seconds{topic=...}`
- `review_queue_pending`
- `review_decision_latency_minutes`
- `storage_bytes{type=buffer|clips}`

## Logging
- JSON logs only.
- Required fields: `trace_id`, `session_id`, `segment_id`, `candidate_id`, `clip_id`, `stage`, `attempt`.

## Tracing
- OpenTelemetry trace continuity across queue hops.

## Alerts
- No segments arriving while stream expected live.
- Queue lag over threshold.
- Clip failure rate spike.
- Storage approaching configured cap.

---

## 13) Suggested Folder Layout

```text
projects/stream-clipper-phase1/
  PHASE1_PLAN.md
  architecture/
    event_schemas.md
    service_boundaries.md
  tasks/
    backlog_phase1.md
```

---

## 14) Decision: Python vs Node

### Recommended
- **Python workers + Node/Next.js review app**.

### Why
- Better signal processing and media tooling in Python.
- Fast internal product UI development in Next.js.
- Lowest risk path to a working MVP with clean future expansion.

If team must stay single-language, Node-only is feasible but likely slower for robust media detection quality.
