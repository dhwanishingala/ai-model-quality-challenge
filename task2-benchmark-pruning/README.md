# Task 2: Benchmark Compression for a Real Customer

Benchmark pruning system implemented as an extension to [modelscope/evalscope](https://github.com/modelscope/evalscope).

## Pinned EvalScope Commit

```
SHA: 8cded2aeb0425d5c7346f1a8e2df3e330fe02381
Date: Jun 4, 2026
```

## Setup

```bash
cd task2-benchmark-pruning

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install evalscope in dev mode
cd evalscope
pip install -e ".[all]"
cd ..

# Install analysis dependencies
pip install numpy scipy scikit-learn matplotlib seaborn Pillow
```

## What's Included

### EvalScope Extension (`evalscope/evalscope/benchmarks/`)

| Module | Purpose |
|--------|---------|
| `pruner/` | Core pruning engine: IRT-based item discrimination, noise correction, validation |
| `pruned/` | Universal pruned benchmark adapter — wraps any benchmark with index-based filtering |
| `mmmu_probe/` | MMMU multimodal encoder-stress probe with perturbation testing |

### Analysis Tools (`analysis/`)

| Script | Purpose |
|--------|---------|
| `analyze_data.py` | Load Evals JSONL data, build response matrices, print summaries |
| `fit_irt.py` | Run IRT pruning, produce index files, run cross-validation |
| `compare_runs.py` | Compare full vs pruned benchmark results with statistical tests |
| `visualize.py` | Generate figures for handouts |

### Deliverables (`handouts/`)

- **Handout A** — Technical audience (1 page): approach, results, assumptions, extensions
- **Handout B** — Mixed audience (0.5 page): business impact, how to run, why it matters

## Running the Pruned Benchmarks

```bash
# Part A: Pruned coding benchmark (69/315 items retained)
evalscope eval --model <model_endpoint> --datasets live_code_bench_pruned

# Part A: Pruned long-context benchmark (30/100 items retained)
evalscope eval --model <model_endpoint> --datasets aa_lcr_pruned

# Part A: Custom indices
evalscope eval --model <model_endpoint> --datasets live_code_bench_pruned \
    --dataset-args '{"live_code_bench_pruned": {"pruned_indices_path": "/path/to/indices.json"}}'

# Part B: Multimodal encoder probe (all axes)
evalscope eval --model <model_endpoint> --datasets mmmu_probe

# Part B: Specific probe axes
evalscope eval --model <model_endpoint> --datasets mmmu_probe \
    --dataset-args '{"mmmu_probe": {"probe_axes": ["ocr", "spatial"]}}'

# Part B: With image perturbation (encoder stress test)
evalscope eval --model <model_endpoint> --datasets mmmu_probe \
    --dataset-args '{"mmmu_probe": {"enable_perturbations": true, "perturbation_type": "downsample", "perturbation_severity": 0.5}}'
```

## Running the Analysis

```bash
cd analysis

# Data summary
python analyze_data.py

# Fit IRT pruner and produce indices
python fit_irt.py

# Compare full vs pruned results
python compare_runs.py

# Generate figures
python visualize.py
```

## Results Summary

### Part A: Benchmark Compression

| Benchmark | Full | Pruned | Retention | Top-1 Correct | Pearson r | LOO Rate |
|-----------|------|--------|-----------|---------------|-----------|----------|
| LCB v5    | 315  | 69     | 21.9%     | Yes           | 0.987     | 2/3      |
| AA-LCR    | 100  | 30     | 30.0%     | Yes           | 0.990     | 2/3      |

**Key finding**: 64.8% of LCB items and 57% of AA-LCR items have zero discrimination (all models agree). The pruner removes these and retains only items that differentiate model quality.

### Part B: MMMU Multimodal Probe

The `mmmu_probe` benchmark selects items from MMMU's 12K dataset that specifically stress image encoders across five visual capability axes:

- **OCR-heavy**: items requiring text reading from images
- **Fine-grained**: charts, diagrams, molecular structures
- **Spatial**: architecture/engineering drawings
- **Multi-image**: cross-image synthesis
- **Domain-specific**: medical imaging, circuits, biology

Perturbation testing (downsample, noise, crop, compression, blur) measures encoder robustness by comparing accuracy on original vs degraded images.

## Architecture

```
evalscope/benchmarks/
├── pruner/                    # Core pruning engine (reusable)
│   ├── base.py                # BasePruner ABC, PruningResult
│   ├── irt_pruner.py          # IRT-inspired stratified discrimination
│   ├── noise_correction.py    # LLM judge noise estimation
│   └── validation.py          # Rank correlation, LOO cross-validation
├── pruned/                    # Universal pruned adapter
│   ├── pruned_adapter.py      # Wraps any benchmark with index filtering
│   └── indices/               # Pre-computed pruned index sets
│       ├── live_code_bench_v5_irt.json
│       └── aa_lcr_irt.json
└── mmmu_probe/                # Multimodal encoder probe
    ├── mmmu_probe_adapter.py  # Extends MMMUAdapter
    ├── probe_classifier.py    # Visual capability axis classification
    └── perturbations.py       # Image transforms for stress testing
```

## Pruning Method: Not a Forbidden Baseline

The IRT-inspired approach is:
- **Not uniform random** — items are ranked by discrimination and stratified by difficulty
- **Not top-k easiest/hardest** — stratification ensures coverage across difficulty levels
- **Not hand-picked** — fully algorithmic
- **Not model-overfit** — item discrimination is intrinsic; validated via leave-one-model-out
