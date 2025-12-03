# SAM + Trash-Net Fusion Harness

This directory contains the local Python tooling for running object
segmentation/classification before the results are forwarded to the web UI or
Node server.

## SAM + Trash-Net

```
python ML-seg/run_sam_maskrcnn_fusion.py \
  --image ML-seg/image.png \
  --sam-score-min 0.4 \
  --min-mask-area-frac 0.02 \
  --max-mask-area-frac 0.4 \
  --edge-margin-frac 0.02 \
  --classifier-score-min 0.4 \
  --target-point 0.5,0.5 \
  --target-radius-frac 0.25 \
  --json
```

- The script uses the Hugging Face SAM 2.1 Hiera Tiny pipeline to generate masks,
  ranks them by confidence, and keeps only those that cover the user-provided
  ROI clicks (or the center if no clicks were provided).
- The Trash-Net classifier (`prithivMLmods/Trash-Net`) labels each mask with
  `cardboard`, `plastic`, etc., and those labels are mapped to waste streams.
- Outputs are written to `ML-seg/results/<timestamp>` unless you pass
  `--output-dir`. Use `--json` to emit a summary to stdout (useful for the server).

## YOLO harness with fusion

```
python ML-seg/run_image_seg.py \
  --model yolov8n-seg.pt \
  --image ML-seg/image.png
```

This runs Ultralytics YOLO as a quick preview, writes an overlay, and then
invokes the SAM+Trash-Net helper unless `--skip-sam-trashnet` is passed. The CLI
accepts the same options as before (`--imgsz`, `--conf`, etc.).

## Large artifacts

The raw TACO dataset and MobileSAM weights are **not** stored in Git. Download
them locally if you need to experiment and keep them under `ML-seg/data/taco/`
and `MobileSAM/weights/`—both paths are ignored by `.gitignore`.

