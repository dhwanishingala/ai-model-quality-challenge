# Handout B — Why This Matters and How to Use It

**Audience**: Developers, test engineers, product, customer team

## What Changes for the Customer Conversation

Today, evaluating a candidate model against our coding and long-context benchmarks means running 415 test items. With pruning, that drops to **99 items — a 76% reduction** — while keeping the same go/no-go answer.

In concrete terms: a sales engineer can get a model quality verdict in a single meeting instead of waiting overnight for full results. Engineering can run the pruned suite in CI on every model update without blocking the pipeline.

## How to Run It Tomorrow

The pruners are built into evalscope. A deployment lead runs:

```bash
# Pruned coding benchmark (69 items instead of 315)
evalscope eval --model <model_endpoint> --datasets live_code_bench_pruned

# Pruned long-context benchmark (30 items instead of 100)
evalscope eval --model <model_endpoint> --datasets aa_lcr_pruned

# Multimodal encoder probe (if customer expands to vision)
evalscope eval --model <model_endpoint> --datasets mmmu_probe
```

The output is the same evalscope report format teams already use. No new tools, no new workflows.

## What the Multimodal Probe Gives You

If the customer asks about image understanding next quarter, the `mmmu_probe` benchmark tests **whether the model's image encoder is actually working**, not just whether the model can guess answers from text clues.

It does this two ways:
1. **Targeted selection**: picks questions where the image is essential — charts that need precise reading, medical scans, engineering diagrams.
2. **Perturbation testing**: degrades the images (blur, crop, compression) and measures how much accuracy drops. A model with a good encoder degrades gracefully; a weak encoder collapses.

Random sampling from MMMU mostly tests text reasoning (many questions have decorative images). The probe surfaces encoder-specific weaknesses that would otherwise be hidden in an aggregate score.

## Why a Customer-Facing PM Should Care

- **Faster evaluation cycles**: Prospects get answers in hours, not days. Shorter sales cycles.
- **Defensible methodology**: The pruning is based on psychometric theory (Item Response Theory), not gut feeling. When a prospect asks "why only 69 items?", the answer is: "because the other 246 items give the same answer regardless of model quality."
- **Extensible**: Adding pruning to a new benchmark is a one-line config change, not a new project. As we onboard new benchmarks, the pruning framework scales with us.
- **Multimodal readiness**: When the customer's roadmap extends to vision, we have a probe ready — not a 12,000-item evaluation.
