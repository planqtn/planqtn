# PlanqTN Capsule Examples

Reproducible QEC analysis capsules built with [Marqov](https://github.com/marqov/marqov) `CapsuleBuilder`.

## Prerequisites

- Python 3.11+
- `planqtn` installed (for real runs)
- `marqov` capsule branch (for `CapsuleBuilder`)

```bash
pip install -r requirements.txt
```

## Quick Start

### Standalone analysis (no marqov needed)

```bash
# Steane [[7,1,3]] — fast, known-good WEP
python steane_code_analysis.py

# Rotated surface code d=3
python surface_code_analysis.py 3

# CSS code (Steane via Tanner graph)
python css_code_analysis.py
```

### Build capsules (mock mode — no planqtn needed)

```bash
python build_capsules.py --mock
```

### Build capsules (real computation)

```bash
python build_capsules.py
```

## Capsule Structure

Each capsule directory contains YAML definitions that describe the analysis:

```
capsules/
├── rotated-surface-d3/
│   ├── workflow.yaml      # Task definition, inputs, function reference
│   ├── environment.yaml   # Python version and dependencies
│   └── backends.yaml      # Compute backend configuration
├── rotated-surface-d5/
├── rotated-surface-d7/
└── steane-7-1-3/
```

After running `build_capsules.py`, each directory also contains a sealed `capsule.yaml` with:

- Task execution record (inputs, outputs, timing)
- Result digest (SHA-256 of weight enumerator)
- QEC-specific metadata (code type, minimum weight)

## Verification

Capsule digests are deterministic — running the same analysis twice produces identical SHA-256 hashes, confirming reproducibility. The Steane code additionally checks against the known WEP `{0: 1, 3: 7, 4: 7, 7: 1}`.

## Analysis Scripts

| Script | Code | Parameters |
|---|---|---|
| `surface_code_analysis.py` | Rotated surface code | `distance` (default 5) |
| `css_code_analysis.py` | CSS Tanner code | `hx`, `hz` matrices |
| `steane_code_analysis.py` | Steane [[7,1,3]] | None (fixed code) |
