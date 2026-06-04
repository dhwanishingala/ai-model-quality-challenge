#!/usr/bin/env python3
"""Load Evals JSONL data and build response matrices for IRT pruning."""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

EVALS_DIR = Path(__file__).resolve().parent.parent.parent / 'Evals'
PART1_DIR = EVALS_DIR / 'Part 1'
MMMU_DIR = EVALS_DIR / 'MMMU'

MODELS = ['gpt-oss-120b', 'kimi-k2.5', 'minimax-m2.5']
BENCHMARKS = ['live_code_bench_v5', 'aa_lcr']
SCORE_KEYS = {'live_code_bench_v5': 'pass', 'aa_lcr': 'acc'}


def load_reviews(benchmark: str, model: str) -> List[Dict[str, Any]]:
    """Load review JSONL for a benchmark/model pair."""
    fpath = PART1_DIR / 'reviews' / f'{benchmark}__{model}.jsonl'
    if not fpath.exists():
        raise FileNotFoundError(f'Review file not found: {fpath}')
    rows = []
    with open(fpath) as f:
        for line in f:
            rows.append(json.loads(line, strict=False))
    return rows


def build_response_matrix(benchmark: str, models: List[str] = None
                          ) -> Tuple[np.ndarray, List[Any], List[str]]:
    """Build (n_items, n_models) response matrix from review files.

    Returns:
        response_matrix: (n_items, n_models) array of scores.
        indices: List of original item indices.
        model_names: List of model names in column order.
    """
    if models is None:
        models = MODELS

    score_key = SCORE_KEYS[benchmark]

    all_reviews = {}
    for model in models:
        reviews = load_reviews(benchmark, model)
        for r in reviews:
            idx = r['index']
            score_val = r['sample_score']['score']['value'][score_key]
            if isinstance(score_val, list):
                score_val = score_val[0] if score_val else 0.0
            score_val = float(score_val)
            if idx not in all_reviews:
                all_reviews[idx] = {}
            all_reviews[idx][model] = score_val

    common_indices = sorted([
        idx for idx, scores in all_reviews.items()
        if len(scores) == len(models)
    ])

    matrix = np.zeros((len(common_indices), len(models)))
    for i, idx in enumerate(common_indices):
        for j, model in enumerate(models):
            matrix[i, j] = all_reviews[idx][model]

    return matrix, common_indices, models


def load_mmmu_reviews() -> Tuple[Dict[str, np.ndarray], Dict[str, List[int]]]:
    """Load all MMMU review files grouped by subject.

    Returns:
        subject_scores: Dict mapping subject name to array of scores.
        subject_indices: Dict mapping subject name to list of indices.
    """
    reviews_dir = MMMU_DIR / 'reviews' / 'glm-4.5v-fp8'
    subject_scores = {}
    subject_indices = {}

    for fpath in sorted(reviews_dir.glob('mmmu_*.jsonl')):
        subject = fpath.stem.replace('mmmu_', '')
        scores = []
        indices = []
        with open(fpath) as f:
            for line in f:
                d = json.loads(line, strict=False)
                score_val = d['sample_score']['score']['value']['acc']
                if isinstance(score_val, list):
                    score_val = score_val[0] if score_val else 0.0
                scores.append(float(score_val))
                indices.append(d['index'])
        subject_scores[subject] = np.array(scores)
        subject_indices[subject] = indices

    return subject_scores, subject_indices


def print_summary():
    """Print summary statistics for all benchmarks."""
    print('=' * 70)
    print('BENCHMARK DATA SUMMARY')
    print('=' * 70)

    for bench in BENCHMARKS:
        matrix, indices, models = build_response_matrix(bench)
        n_items, n_models = matrix.shape

        print(f'\n--- {bench.upper()} ---')
        print(f'  Items: {n_items}, Models: {n_models}')
        print(f'  Score type: {SCORE_KEYS[bench]}')

        for j, model in enumerate(models):
            scores = matrix[:, j]
            print(f'  {model}: mean={np.mean(scores):.3f}, '
                  f'std={np.std(scores):.3f}, '
                  f'pass_rate={np.mean(scores > 0):.3f}')

        difficulty = np.mean(matrix, axis=1)
        variance = np.var(matrix, axis=1)
        zero_disc = np.sum(variance == 0)

        print(f'\n  Item difficulty: mean={np.mean(difficulty):.3f}, '
              f'std={np.std(difficulty):.3f}')
        print(f'  Item discrimination (variance): mean={np.mean(variance):.4f}, '
              f'max={np.max(variance):.4f}')
        print(f'  Zero-discrimination items (all agree): {zero_disc}/{n_items} '
              f'({zero_disc/n_items*100:.1f}%)')

        # Difficulty distribution
        easy = np.sum(difficulty > 0.66)
        medium = np.sum((difficulty >= 0.33) & (difficulty <= 0.66))
        hard = np.sum(difficulty < 0.33)
        print(f'  Difficulty buckets: easy={easy}, medium={medium}, hard={hard}')

    # MMMU summary
    print(f'\n--- MMMU ---')
    subject_scores, subject_indices = load_mmmu_reviews()
    total_samples = sum(len(v) for v in subject_scores.values())
    print(f'  Subjects: {len(subject_scores)}, Total samples: {total_samples}')
    for subj, scores in subject_scores.items():
        print(f'  {subj}: n={len(scores)}, acc={np.mean(scores):.3f}')


if __name__ == '__main__':
    print_summary()
