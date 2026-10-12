# Zero Waste segmentation tools

This directory contains two Python image-inference entry points:

- [run_sam_maskrcnn_fusion.py](run_sam_maskrcnn_fusion.py) proposes masks with **SAM 2.1 Hiera Tiny**, classifies masked crops with **Trash-Net SIGLIP**, and returns overlay images and JSON. This is the script called by the web API.
- [run_image_seg.py](run_image_seg.py) renders predictions from a YOLO segmentation checkpoint. It optionally launches the SAM + Trash-Net script afterward. It is a separate local experiment.

The scripts use pretrained models; this repository does not include a training pipeline or a systematic accuracy benchmark.

## Setup

Run these commands from the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r ML-seg/requirements.txt
```

Use Python **3.10 or later**. On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1`. PyTorch's CPU/CUDA support depends on your platform; use the appropriate PyTorch installation for your hardware. A GPU is optional, and CPU inference can take substantially longer.

Dependencies are listed with lower bounds in [requirements.txt](requirements.txt), not pinned in a reproducible environment lock. Model compatibility and performance need validation on the selected versions.

The YOLO checkpoint `ML-seg/models/yolov8n-seg.pt` is tracked. SAM and Trash-Net weights download from their model hosts on first use and then use local caches. The scripts do not require a paid inference API.

## YOLO image preview

The sample input is **`image.png` at the repository root**, not `ML-seg/image.png`.

```bash
python ML-seg/run_image_seg.py \
  --image image.png \
  --model yolov8n-seg.pt \
  --device cpu \
  --skip-sam-trashnet \
  --output /tmp/zero-waste-yolo-preview.png
```

The model is resolved first as a supplied path, then relative to `ML-seg/models/`. The script draws the checkpoint's class names and saves an overlay. Do not treat the fallback waste-stream names in the script as proof that an arbitrary YOLO checkpoint was trained for those streams.

Omit `--skip-sam-trashnet` to also invoke the fusion script. That invocation uses `subprocess.run(..., check=False)`, so a successful YOLO exit does not prove the fusion stage succeeded. Run fusion directly when validating it.

## SAM + Trash-Net

```bash
python ML-seg/run_sam_maskrcnn_fusion.py \
  --image image.png \
  --classifier-device cpu \
  --sam-device cpu \
  --sam-score-min 0.4 \
  --min-mask-area-frac 0.02 \
  --max-mask-area-frac 0.4 \
  --classifier-score-min 0.4 \
  --target-point 0.5,0.5 \
  --target-radius-frac 0.25 \
  --output-dir /tmp/zero-waste-fusion \
  --json
```

`--target-point` is optional and repeatable. It identifies an image position using normalized x/y coordinates in [0, 1]; the point and radius prioritize candidate masks around the selected object.

The pipeline filters mask proposals, classifies surviving crops, and emits:

- An annotated `*_sam_trashnet_overlay.png`.
- A metadata `*_sam_trashnet_overlay.json`.
- A JSON payload on stdout when `--json` is set, with diagnostics directed to stderr.

An explicit output directory avoids overwriting the repository's saved example results. Inspect the files and JSON after a run; a generated overlay by itself is not an accuracy score.

## Waste-stream mapping

The current `LABEL_TO_STREAM` mapping is:

| Classifier label | Stream |
| --- | --- |
| `cardboard`, `glass`, `metal`, `paper`, `plastic` | `recycle` |
| `trash` | `landfill` |
| Other labels | `unknown` |

There is **no compost class mapping** in the current fusion helper. This is a prototype mapping, not a complete statement of local disposal rules.

## Web integration

The Express server receives a base64 image and optional selected points at `POST /api/segment`, writes temporary files, and launches the fusion helper with `--json`. It converts the overlay into a base64 response and removes the temporary directory afterward.

The interpreter is selected from `SAM_TRASHNET_PYTHON`, then the repository's `.venv/bin/python3`, then `python3` on PATH. See [web app setup](../website/README.md) for ports and API configuration. The web request does not run the YOLO helper first.

## Validation and limits

For a dependency-free syntax check from the repository root:

```bash
python3 - <<'PY'
import ast
from pathlib import Path

for path in Path("ML-seg").glob("*.py"):
    ast.parse(path.read_text(), filename=str(path))
    print(f"Parsed {path}")
PY
```

The commands above are manual inference checks, not a committed automated test suite. Saved outputs under [results/trash-seg](results/trash-seg) are examples. The project write-up reports controlled usability feedback and notes that model accuracy was not systematically measured.

This documentation review did not install the ML environment, download model weights, or rerun inference. Large research datasets and alternate checkpoints are not included. Review model-specific usage terms separately; this README does not grant a new license.

