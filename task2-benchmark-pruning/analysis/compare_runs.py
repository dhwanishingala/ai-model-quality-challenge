#!/usr/bin/env python3
"""Compare full vs pruned benchmark results.

Computes correlation metrics between full-suite and pruned-suite model scores.
Can run standalone against the shipped Evals data or against evalscope output dirs.

Usage:
    python compare_runs.py                        # Compare using shipped Evals data
    python compare_runs.py --full DIR --pruned DIR # Compare evalscope output directories
"""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

PRUNER_DIR = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruner'


def _load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


_base = _load_module('evalscope.benchmarks.pruner.base', PRUNER_DIR / 'base.py')
_noise = _load_module('evalscope.benchmarks.pruner.noise_correction', PRUNER_DIR / 'noise_correction.py')
_irt = _load_module('evalscope.benchmarks.pruner.irt_pruner', PRUNER_DIR / 'irt_pruner.py')
_val = _load_module('evalscope.benchmarks.pruner.validation', PRUNER_DIR / 'validation.py')

from analyze_data import BENCHMARKS, MODELS, build_response_matrix


def compare_from_evals():
    """Compare full vs pruned using shipped Evals data and pre-computed indices."""
    indices_dir = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruned' / 'indices'

    print('=' * 70)
    print('FULL vs PRUNED BENCHMARK COMPARISON')
    print('=' * 70)

    for benchmark in BENCHMARKS:
        indices_file = indices_dir / f'{benchmark}_irt.json'
        if not indices_file.exists():
            print(f'\n[SKIP] {benchmark}: no pruned indices found at {indices_file}')
            continue

        matrix, all_indices, models = build_response_matrix(benchmark)
        with open(indices_file) as f:
            data = json.load(f)
        pruned_indices = set(data['selected_indices'])

        sel_positions = [i for i, idx in enumerate(all_indices) if idx in pruned_indices]

        result = _val.validate_pruning(matrix, sel_positions, models)

        print(f'\n--- {benchmark.upper()} ---')
        print(f'  Full suite:  {result["n_items_full"]} items')
        print(f'  Pruned suite: {result["n_items_pruned"]} items '
              f'({result["compression_ratio"]:.1%} retained)')
        print()
        print(f'  {"Model":<20} {"Full Score":>12} {"Pruned Score":>12} {"Delta":>8}')
        print(f'  {"-"*52}')
        for model in models:
            full = result['full_scores'][model]
            pruned = result['pruned_scores'][model]
            delta = pruned - full
            print(f'  {model:<20} {full:>12.3f} {pruned:>12.3f} {delta:>+8.3f}')
        print()
        print(f'  Rank preserved: {result["rank_preserved"]}')
        print(f'  Full ranking:   {" > ".join(result["full_ranking"])}')
        print(f'  Pruned ranking: {" > ".join(result["pruned_ranking"])}')
        print()
        print(f'  Pearson r:       {result["pearson_r"]:.4f}')
        print(f'  Kendall tau:     {result["kendall_tau"]:.4f}')
        print(f'  Spearman rho:    {result["spearman_rho"]:.4f}')
        print(f'  MAE:             {result["mae"]:.4f}')
        print(f'  Max abs error:   {result["max_absolute_error"]:.4f}')

        # LOO validation
        print(f'\n  Leave-one-model-out cross-validation:')
        loo = _val.leave_one_out_validation(
            matrix, all_indices,
            pruner_cls=_irt.IRTPruner,
            pruner_kwargs={
                'n_strata': 3,
                'min_per_stratum': 3,
                'noise_correction': benchmark == 'aa_lcr',
                'noise_sigma': 0.08,
            },
            n_select=len(pruned_indices),
            model_names=models,
        )
        print(f'    Rank preserved: {loo["rank_preserved_folds"]}/{loo["n_folds"]} folds')
        print(f'    Avg MAE: {loo["avg_mae"]:.4f}')
        for fold in loo['fold_results']:
            held = fold['held_out_model']
            print(f'    Fold (held={held}): rank_ok={fold["rank_preserved"]}, '
                  f'mae={fold["mae"]:.4f}')


def main():
    parser = argparse.ArgumentParser(description='Compare full vs pruned benchmark results')
    parser.add_argument('--full', type=str, help='Path to full evalscope results directory')
    parser.add_argument('--pruned', type=str, help='Path to pruned evalscope results directory')
    args = parser.parse_args()

    if args.full and args.pruned:
        print('Comparison from evalscope output directories not yet implemented.')
        print('Use without arguments to compare using shipped Evals data.')
        sys.exit(1)

    compare_from_evals()


if __name__ == '__main__':
    main()
