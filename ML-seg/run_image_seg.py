#!/usr/bin/env python3
"""
Single-image segmentation harness for Ultralytics YOLO models plus SAM+TrashNet fusion.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Tuple
import sys

import cv2
import numpy as np
from ultralytics import YOLO

CLASS_NAMES = ["landfill", "recycle", "compost"]
CLASS_COLORS: Dict[int, Tuple[int, int, int]] = {
    0: (128, 128, 128),
    1: (34, 139, 34),
    2: (42, 42, 165),
}

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run YOLO segmentation and optionally SAM+TrashNet fusion on a static image."
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8n-seg.pt",
        help="Checkpoint filename or path (resolved relative to --model-dir).",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=DEFAULT_MODEL_DIR,
        help="Directory searched when --model is not an absolute path.",
    )
    parser.add_argument("--image", type=Path, required=True, help="Path to input image.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output path. Defaults to <image_stem>_<model>_overlay.png",
    )
    parser.add_argument("--imgsz", type=int, default=320, help="Inference resolution.")
    parser.add_argument("--conf", type=float, default=0.3, help="Confidence threshold.")
    parser.add_argument(
        "--device",
        type=str,
        default="",
        help="Torch device override such as 'cpu' or 'cuda:0'. Leave empty for auto.",
    )
    parser.add_argument(
        "--hide-labels",
        action="store_true",
        help="Skip drawing text labels (mask colors remain).",
    )
    parser.add_argument(
        "--skip-sam-trashnet",
        action="store_true",
        help="Do not run the SAM+TrashNet fusion helper after YOLO.",
    )
    parser.add_argument(
        "--sam-script",
        type=Path,
        default=Path(__file__).with_name("run_sam_maskrcnn_fusion.py"),
        help="Path to the fusion helper script.",
    )
    return parser.parse_args()


def resolve_model_path(name: str, search_dir: Path) -> Path:
    candidate = Path(name)
    if candidate.exists():
        return candidate
    candidate = search_dir / name
    if not candidate.exists():
        raise FileNotFoundError(
            f"Checkpoint '{name}' not found. Checked {Path(name).resolve()} and {candidate.resolve()}."
        )
    return candidate


def annotate_mask(
    overlay: np.ndarray,
    binary_mask: np.ndarray,
    label: str,
    color: Tuple[int, int, int],
    confidence: float | None,
    draw_label: bool,
) -> None:
    overlay[binary_mask] = (
        0.65 * overlay[binary_mask] + 0.35 * np.array(color, dtype=np.float32)
    )

    if draw_label and binary_mask.any():
        ys, xs = np.nonzero(binary_mask)
        cy, cx = int(ys.mean()), int(xs.mean())
        text = label
        if confidence is not None:
            text += f" {confidence:.2f}"
        cv2.putText(
            overlay,
            text,
            (max(cx - 20, 5), max(cy - 5, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
            cv2.LINE_AA,
        )


def main():
    args = parse_args()

    model_path = resolve_model_path(args.model, args.model_dir)
    output_path = (
        args.output
        if args.output is not None
        else args.image.with_stem(f"{args.image.stem}_{model_path.stem}_overlay")
    )

    image = cv2.imread(str(args.image))
    if image is None:
        raise FileNotFoundError(f"Could not read image at {args.image}")

    model = YOLO(model_path)
    if args.device:
        model.to(args.device)

    results = model.predict(
        source=image,
        imgsz=args.imgsz,
        conf=args.conf,
        verbose=False,
        device=args.device or None,
    )

    if not results:
        print("No predictions were returned; saving original image.")
        cv2.imwrite(str(output_path), image)
        return

    overlay = image.copy()
    result = results[0]

    if result.masks is not None:
        masks = result.masks.data.cpu().numpy()
        classes = result.boxes.cls.int().cpu().numpy()
        confidences = (
            result.boxes.conf.cpu().numpy() if result.boxes.conf is not None else None
        )
        names_map = result.names if hasattr(result, "names") else {
            i: name for i, name in enumerate(CLASS_NAMES)
        }

        h, w = image.shape[:2]
        for idx, mask in enumerate(masks):
            cls_id = int(classes[idx]) if idx < len(classes) else 0
            color = CLASS_COLORS.get(cls_id, (0, 255, 255))
            mask_resized = cv2.resize(mask, (w, h), interpolation=cv2.INTER_LINEAR)
            binary = mask_resized > 0.5
            confidence = (
                confidences[idx]
                if confidences is not None and idx < len(confidences)
                else None
            )

            annotate_mask(
                overlay,
                binary,
                names_map.get(cls_id, f"class_{cls_id}"),
                color,
                confidence,
                draw_label=not args.hide_labels,
            )

    cv2.imwrite(str(output_path), overlay)
    print(f"✓ Saved annotated image to {output_path}")

    if not args.skip_sam_trashnet:
        import subprocess

        cmd = [
            sys.executable,
            str(args.sam_script),
            "--image",
            str(args.image),
        ]
        print("Running SAM+TrashNet fusion:", " ".join(cmd))
        subprocess.run(cmd, check=False)


if __name__ == "__main__":
    main()

