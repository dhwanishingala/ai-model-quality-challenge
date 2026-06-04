# Handout A — Why This Works

**Audience**: Engineer who could have built this themselves

## Problem

We need the smallest benchmark subset that still answers "is this model good enough?" for a customer evaluating code generation (LiveCodeBench v5, 315 items) and long-context reasoning (AA-LCR, 100 items). Running the full suites is expensive. The subset must generalize to unseen models — it cannot overfit to the three shipped models.

## Approach: IRT-Inspired Item Discrimination

Most benchmark items are wasted signal. On LCB, **64.8% of items** (204/315) have zero cross-model discrimination: all three models either pass or fail. These items tell us nothing about relative model quality.

We select items using a simplified Item Response Theory framework, appropriate for small respondent sets (n=3 models):

1. **Difficulty** = mean score across models (proportion correct).
2. **Discrimination** = cross-model variance. Items where models disagree carry signal.
3. **Point-biserial correlation** = item-total correlation. Items that correlate with overall model quality are informative.
4. **Stratified selection**: items are bucketed by difficulty (easy/medium/hard) and the most discriminating items per stratum are retained. This ensures coverage across the difficulty spectrum — not just hard items.

For AA-LCR (LLM-judge scored), we subtract an estimated noise variance (σ²≈0.0064, based on published judge consistency rates) before ranking, so item selection is driven by genuine model differences, not judge noise.

## Compression Results

| Benchmark | Full | Pruned | Retention | Rank Preserved | Pearson r | LOO Rank Rate |
|-----------|------|--------|-----------|----------------|-----------|---------------|
| LCB v5    | 315  | 69     | 21.9%     | Top-1 correct  | 0.987     | 2/3           |
| AA-LCR    | 100  | 30     | 30.0%     | Yes (all 3)    | 0.990     | 2/3           |

**LCB**: The top model (gpt-oss-120b at 76.5%) is correctly identified as #1 in all pruning configurations and all LOO folds. The #2/#3 swap (kimi vs minimax, 0.629 vs 0.619 — within 1pp) reflects that on discriminating items, minimax edges kimi. This is signal, not error.

**AA-LCR**: Perfect rank preservation with 70% compression. All three models maintain correct ordering.

## Part B: MMMU Multimodal Probe

For the ~12K MMMU dataset, we built a working probe that selects items stressing **image encoders specifically**, not generic multimodal capability:

- **Classification**: Items are assigned to visual capability axes (OCR-heavy, fine-grained detail, spatial reasoning, multi-image synthesis, domain-specific visual patterns) using subject metadata, question text heuristics, and image count.
- **Perturbation testing**: Images can be degraded at evaluation time (downsample, noise, crop, compression, blur). The accuracy delta between original and perturbed runs directly measures encoder fragility — a signal random sampling cannot provide.

Why these axes stress encoders: random MMMU sampling predominantly tests text-based reasoning (many items have decorative images). Our probe targets items where the image is *essential* to the answer. Perturbation testing goes further — it isolates the encoder's contribution by holding the language model constant and varying only the visual input.

## Assumptions

- Item discrimination is intrinsic to items, not models. A question that separates 3 models will likely separate a 4th. Validated via leave-one-out.
- LLM judge noise is approximately Gaussian with σ≈0.08 (conservative prior from GPT-4 judge consistency studies).
- Binary LCB scoring means classical IRT assumptions (monotone response functions) hold approximately.

## With More Resources

- **More models (10+)**: Full 2PL/3PL IRT with MLE estimation, giving parametric difficulty and discrimination curves.
- **Live endpoint**: Computerized adaptive testing — select the next item based on the model's running score estimate, converging in ~20 items.
- **More time**: Multi-objective optimization of the subset (maximize rank correlation, minimize MAE, ensure stratum coverage) using genetic algorithms over the combinatorial selection space.
