#!/usr/bin/env python3
"""Generate visualizations for handouts and analysis."""

import importlib.util
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

PRUNER_DIR = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruner'
OUTPUT_DIR = Path(__file__).resolve().parent / 'figures'


def _load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


_base = _load_module('evalscope.benchmarks.pruner.base', PRUNER_DIR / 'base.py')
_noise = _load_module('evalscope.benchmarks.pruner.noise_correction', PRUNER_DIR / 'noise_correction.py')
_irt = _load_module('evalscope.benchmarks.pruner.irt_pruner', PRUNER_DIR / 'irt_pruner.py')

from analyze_data import BENCHMARKS, MODELS, build_response_matrix, load_mmmu_reviews


def plot_item_discrimination(benchmark: str, ax=None):
    """Plot item difficulty vs discrimination."""
    matrix, indices, models = build_response_matrix(benchmark)
    difficulty = np.mean(matrix, axis=1)
    discrimination = np.var(matrix, axis=1)

    indices_dir = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruned' / 'indices'
    indices_file = indices_dir / f'{benchmark}_irt.json'
    selected = set()
    if indices_file.exists():
        with open(indices_file) as f:
            selected = set(json.load(f)['selected_indices'])

    is_selected = np.array([idx in selected for idx in indices])

    if ax is None:
        fig, ax = plt.subplots(1, 1, figsize=(8, 5))

    ax.scatter(difficulty[~is_selected], discrimination[~is_selected],
               alpha=0.4, s=30, c='#cccccc', label='Pruned (removed)')
    ax.scatter(difficulty[is_selected], discrimination[is_selected],
               alpha=0.8, s=50, c='#e63946', label='Retained', edgecolors='black', linewidths=0.5)
    ax.set_xlabel('Item Difficulty (mean score across models)')
    ax.set_ylabel('Item Discrimination (cross-model variance)')
    ax.set_title(f'{benchmark.replace("_", " ").title()}: Item Selection')
    ax.legend()
    ax.set_xlim(-0.05, 1.05)

    return ax


def plot_score_comparison():
    """Plot full vs pruned scores for all benchmarks."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    indices_dir = Path(__file__).resolve().parent.parent / 'evalscope' / 'evalscope' / 'benchmarks' / 'pruned' / 'indices'

    for i, benchmark in enumerate(BENCHMARKS):
        ax = axes[i]
        matrix, all_indices, models = build_response_matrix(benchmark)
        indices_file = indices_dir / f'{benchmark}_irt.json'

        full_scores = np.mean(matrix, axis=0)

        if indices_file.exists():
            with open(indices_file) as f:
                selected = set(json.load(f)['selected_indices'])
            sel_positions = [j for j, idx in enumerate(all_indices) if idx in selected]
            pruned_scores = np.mean(matrix[sel_positions], axis=0)
        else:
            pruned_scores = full_scores

        x = np.arange(len(models))
        width = 0.35

        bars1 = ax.bar(x - width / 2, full_scores, width, label='Full Suite',
                        color='#457b9d', alpha=0.8)
        bars2 = ax.bar(x + width / 2, pruned_scores, width, label='Pruned Suite',
                        color='#e63946', alpha=0.8)

        ax.set_xlabel('Model')
        ax.set_ylabel('Score')
        ax.set_title(benchmark.replace('_', ' ').title())
        ax.set_xticks(x)
        ax.set_xticklabels([m.replace('-', '\n') for m in models], fontsize=8)
        ax.legend()
        ax.set_ylim(0, 1.0)

        for bar in bars1:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
                    f'{bar.get_height():.2f}', ha='center', va='bottom', fontsize=7)
        for bar in bars2:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
                    f'{bar.get_height():.2f}', ha='center', va='bottom', fontsize=7)

    plt.tight_layout()
    return fig


def plot_mmmu_by_subject():
    """Plot MMMU accuracy by subject."""
    subject_scores, _ = load_mmmu_reviews()

    subjects = sorted(subject_scores.keys())
    means = [np.mean(subject_scores[s]) for s in subjects]

    fig, ax = plt.subplots(1, 1, figsize=(12, 6))
    colors = sns.color_palette('viridis', len(subjects))
    y_pos = np.arange(len(subjects))

    bars = ax.barh(y_pos, means, color=colors, alpha=0.8)
    ax.set_yticks(y_pos)
    ax.set_yticklabels([s.replace('_', ' ') for s in subjects], fontsize=8)
    ax.set_xlabel('Accuracy')
    ax.set_title('MMMU Accuracy by Subject (glm-4.5v-fp8)')
    ax.set_xlim(0, 1.0)
    ax.axvline(x=np.mean(means), color='red', linestyle='--', alpha=0.7, label=f'Mean: {np.mean(means):.3f}')
    ax.legend()

    plt.tight_layout()
    return fig


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style='whitegrid')

    # Item discrimination plots
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    for i, bench in enumerate(BENCHMARKS):
        plot_item_discrimination(bench, ax=axes[i])
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / 'item_discrimination.png', dpi=150, bbox_inches='tight')
    print(f'Saved: {OUTPUT_DIR / "item_discrimination.png"}')

    # Score comparison
    fig = plot_score_comparison()
    fig.savefig(OUTPUT_DIR / 'score_comparison.png', dpi=150, bbox_inches='tight')
    print(f'Saved: {OUTPUT_DIR / "score_comparison.png"}')

    # MMMU by subject
    fig = plot_mmmu_by_subject()
    fig.savefig(OUTPUT_DIR / 'mmmu_by_subject.png', dpi=150, bbox_inches='tight')
    print(f'Saved: {OUTPUT_DIR / "mmmu_by_subject.png"}')

    plt.close('all')
    print('\nAll figures saved.')


if __name__ == '__main__':
    main()
