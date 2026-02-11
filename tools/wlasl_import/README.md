
# WLASL Import Tools

Tools to import WLASL videos into the dataset schema. Supports **streaming** and **segmentation**.

## Requirements
```bash
pip install opencv-python mediapipe numpy
```

## Quick Start (Streaming Mode)

This is the recommended way to process the dataset. It writes to a compressed JSONL file line-by-line, so it uses very little RAM.

### 1. Build Dataset (Streaming Mode)

#### Option A: WLASL300 (Folder Structure)
If you extracted the WLASL300 dataset (folders 1, 2, 3...) and have a `labels.txt`:

```bash
python3 tools/wlasl_import/build_dataset.py \
  --folder_root data/wlasl300/wlasl300_dataset/WLASL300 \
  --label_map data/wlasl300/wlasl300_dataset/labels.txt \
  --out tools/wlasl_import/wlasl_dataset.jsonl.gz \
  --out_format jsonl \
  --gzip \
  --resume
```

#### Option B: Standard WLASL (JSON + Videos)
If you have the standard structure with `WLASL_v0.3.json`:

```bash
python3 tools/wlasl_import/build_dataset.py \
  --wlasl_root tools/wlasl_import/data \
  --out tools/wlasl_import/wlasl_dataset.jsonl.gz \
  --out_format jsonl \
  --gzip \
  --resume
```

### 2. Optional: Segmentation
If your model requires fixed inputs (e.g. exactly 5 windows), use the segmentation flags:
```bash
python3 tools/wlasl_import/build_dataset.py \
  --wlasl_root tools/wlasl_import/data \
  --out tools/wlasl_import/wlasl_segmented.jsonl.gz \
  --out_format jsonl \
  --gzip \
  --segment_windows 5 \
  --segment_stride 1
```

### 3. Validate
Works on `.jsonl.gz` files too!
```bash
python3 tools/wlasl_import/validate_dataset.py tools/wlasl_import/wlasl_dataset.jsonl.gz
```

### 4. Finalize (Convert to JSON Array)
If your app needs a single JSON array (like `dataset.json`):

```bash
python3 tools/wlasl_import/finalize_jsonl.py \
  tools/wlasl_import/wlasl_dataset.jsonl.gz \
  dataset.json
```

## Merging with Existing Data
You can also merge using the finalize script or Python:
```bash
# Append local data to the list?
# Easiest is to keep them separate or merge once at the end.
```
