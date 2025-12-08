# ML Segmentation Harnesses

Local Python tooling that powers the trash-seg demo pipeline:

1. **Ultralytics YOLOv8n-seg** (`ML-seg/models/yolov8n-seg.pt`) for fast,
   coarse landfill/recycle/compost masks.
2. **Meta SAM 2.1 Hiera Tiny** via Hugging Face to propose high-quality masks.
3. **Trash-Net SIGLIP classifier** (`prithivMLmods/Trash-Net`) to turn SAM masks
   into semantic labels mapped to waste streams.

The YOLO pass provides instant feedback; SAM + Trash-Net produces the JSON that
the Express server ingests to simulate production segmentation.

---

## Setup

### 1. Prerequisites

- Python 3.10+
- Git & pip
- (Optional) CUDA-capable GPU for faster PyTorch inference

> Apple Silicon / CPU-only users can stay on the CPU wheels; GPU installs should
> follow the platform-specific PyTorch instructions below.

### 2. Create & activate a virtual environment

```bash
cd /trash-seg
python3 -m venv .venv
source .venv/bin/activate   # macOS/Linux
# On Windows PowerShell: .venv\\Scripts\\Activate.ps1
```

Keep the venv activated whenever you run the harnesses.

### 3. Install dependencies

```bash
pip install --upgrade pip
pip install -r ML-seg/requirements.txt
```

PyTorch publishes platform-specific wheels. If you need a CUDA build, replace
the default install step with:

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r ML-seg/requirements.txt --no-deps
```

### 4. Model weights & assets

- `ML-seg/models/yolov8n-seg.pt` is checked into the repo for convenience.
- SAM (`facebook/sam2.1-hiera-tiny`) and Trash-Net weights download automatically
  the first time you run the scripts via Hugging Face/Ultralytics caches.
- Large research datasets (e.g., TACO) remain untracked; place them under
  `ML-seg/data/` if you need to experiment.

### 5. Smoke test

```bash
python ML-seg/run_image_seg.py --image ML-seg/image.png
```

You should see `image_yolov8n-seg_overlay.png` plus a SAM+Trash-Net overlay
under `ML-seg/results/<cwd-stem>/`. Pass `--skip-sam-trashnet` if you only want
the YOLO preview during testing.

---

## YOLO quick-pass + optional fusion

```
python ML-seg/run_image_seg.py \
  --image ML-seg/image.png \
  --model yolov8n-seg.pt \
  --imgsz 320 \
  --conf 0.3
```

- Loads the requested YOLO checkpoint (resolved relative to `ML-seg/models/`).
- Draws soft-colored masks with optional labels and confidences.
- Saves `<image_stem>_<model>_overlay.png` unless `--output` overrides it.
- Runs the SAM + Trash-Net helper afterward unless `--skip-sam-trashnet`.
- Useful flags: `--device cpu|cuda:0`, `--hide-labels`, `--sam-script` to point
  at a custom fusion entry point.

## SAM 2.1 + Trash-Net fusion

```
python ML-seg/run_sam_maskrcnn_fusion.py \
  --image ML-seg/image.png \
  --sam-score-min 0.4 \
  --min-mask-area-frac 0.02 \
  --max-mask-area-frac 0.4 \
  --classifier-score-min 0.4 \
  --target-point 0.5,0.5 \
  --target-radius-frac 0.25 \
  --json
```

- Generates automatic masks with `pipeline("mask-generation", "facebook/sam2.1-hiera-tiny")`
  and filters them by area, score, and optional ROI clicks from the UI.
- Classifies each surviving crop with SIGLIP Trash-Net, mapping labels such as
  `cardboard` or `plastic` into streams via `LABEL_TO_STREAM`.
- Produces an annotated overlay plus structured metadata JSON under
  `ML-seg/results/<cwd-stem>/` unless `--output-dir` overrides it.
- Device controls: `--sam-device`, `--classifier-device`, padding controls, and
  per-stage thresholds let you balance recall vs. precision.

## Large artifacts

The raw TACO dataset, alternate YOLO weights, and MobileSAM checkpoints are
**not** stored in Git. Keep them local under `ML-seg/data/` or `MobileSAM/`
folders (ignored via `.gitignore`).

