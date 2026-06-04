#!/usr/bin/env python3
"""Run IRT-based pruning on LCB and AA-LCR benchmarks.

Produces pruned index files and validation reports.
"""

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

PRUNER_DIR = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruner'


def _load_module(name, filepath):
    """Load a Python module from file path without triggering evalscope's full import chain."""
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# Load pruner modules directly to avoid evalscope's heavy dependency chain
_base = _load_module('evalscope.benchmarks.pruner.base', PRUNER_DIR / 'base.py')
_noise = _load_module('evalscope.benchmarks.pruner.noise_correction', PRUNER_DIR / 'noise_correction.py')
_irt = _load_module('evalscope.benchmarks.pruner.irt_pruner', PRUNER_DIR / 'irt_pruner.py')
_val = _load_module('evalscope.benchmarks.pruner.validation', PRUNER_DIR / 'validation.py')

IRTPruner = _irt.IRTPruner
validate_pruning = _val.validate_pruning
leave_one_out_validation = _val.leave_one_out_validation

from analyze_data import BENCHMARKS, MODELS, build_response_matrix

OUTPUT_DIR = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruned' / 'indices'


def fit_and_save(benchmark: str, target_ratio: float = 0.25,
                 noise_correction: bool = False) -> dict:
    """Fit IRT pruner and save indices.

    Args:
        benchmark: Benchmark name.
        target_ratio: Fraction of items to keep.
        noise_correction: Whether to apply noise correction.

    Returns:
        Validation results dict.
    """
    matrix, indices, models = build_response_matrix(benchmark)
    n_items = len(indices)
    n_select = max(int(n_items * target_ratio), 10)

    print(f'\n{"="*70}')
    print(f'FITTING IRT PRUNER: {benchmark.upper()}')
    print(f'{"="*70}')
    print(f'Items: {n_items}, Target: {n_select} ({target_ratio*100:.0f}%)')
    print(f'Noise correction: {noise_correction}')

    pruner = IRTPruner(
        n_strata=3,
        min_per_stratum=3,
        noise_correction=noise_correction,
        noise_sigma=0.08,
    )

    pruner.fit(matrix, indices)
    result = pruner.select(n_select)

    print(f'\nSelected {len(result.selected_indices)} items '
          f'(compression: {result.compression_ratio:.2%})')
    print(f'Diagnostics:')
    for key, val in result.diagnostics.items():
        if key == 'strata_coverage':
            print(f'  Strata coverage:')
            for s, info in val.items():
                print(f'    {s}: {info["selected"]}/{info["total"]} '
                      f'({info["retention"]:.1%} retained)')
        else:
            print(f'  {key}: {val}')

    # Validation
    sel_positions = [i for i, idx in enumerate(indices)
                     if idx in set(result.selected_indices)]
    val_result = validate_pruning(matrix, sel_positions, models)
    print(f'\nValidation:')
    print(f'  Full scores:   {val_result["full_scores"]}')
    print(f'  Pruned scores:  {val_result["pruned_scores"]}')
    print(f'  Pearson r:      {val_result["pearson_r"]:.4f}')
    print(f'  Kendall tau:    {val_result["kendall_tau"]:.4f}')
    print(f'  MAE:            {val_result["mae"]:.4f}')
    print(f'  Rank preserved: {val_result["rank_preserved"]}')
    print(f'  Full ranking:   {val_result["full_ranking"]}')
    print(f'  Pruned ranking: {val_result["pruned_ranking"]}')

    # Leave-one-out cross-validation
    print(f'\nLeave-one-model-out cross-validation:')
    loo_result = leave_one_out_validation(
        matrix, indices,
        pruner_cls=IRTPruner,
        pruner_kwargs={
            'n_strata': 3,
            'min_per_stratum': 3,
            'noise_correction': noise_correction,
            'noise_sigma': 0.08,
        },
        n_select=n_select,
        model_names=models,
    )
    print(f'  Rank preserved: {loo_result["rank_preserved_folds"]}/{loo_result["n_folds"]}')
    print(f'  Avg MAE: {loo_result["avg_mae"]:.4f}')
    for fold in loo_result['fold_results']:
        held = fold['held_out_model']
        print(f'  Fold (held={held}): rank_ok={fold["rank_preserved"]}, '
              f'mae={fold["mae"]:.4f}, '
              f'ranking={fold["pruned_ranking"]}')

    # Save indices
    out_name = f'{benchmark}_irt.json'
    result.save(str(OUTPUT_DIR / out_name))
    print(f'\nSaved indices to {OUTPUT_DIR / out_name}')

    return {
        'benchmark': benchmark,
        'n_items': n_items,
        'n_selected': len(result.selected_indices),
        'compression_ratio': result.compression_ratio,
        'validation': val_result,
        'loo': loo_result,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    results = {}

    # LCB: binary scores, no noise correction needed
    results['lcb'] = fit_and_save(
        'live_code_bench_v5',
        target_ratio=0.22,
        noise_correction=False,
    )

    # AA-LCR: LLM judge scores, apply noise correction
    results['aa_lcr'] = fit_and_save(
        'aa_lcr',
        target_ratio=0.30,
        noise_correction=True,
    )

    # Summary
    print(f'\n{"="*70}')
    print('SUMMARY')
    print(f'{"="*70}')
    for key, r in results.items():
        print(f'{key}: {r["n_selected"]}/{r["n_items"]} items, '
              f'rank_preserved={r["validation"]["rank_preserved"]}, '
              f'LOO={r["loo"]["rank_preserved_folds"]}/{r["loo"]["n_folds"]}')


if __name__ == '__main__':
    main()
