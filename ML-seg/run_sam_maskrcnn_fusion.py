#!/usr/bin/env python3
"""
Fuse SAM 2.1 automatic masks with the Trash-Net classifier and optional ROI clicks.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
from transformers import AutoImageProcessor, SiglipForImageClassification, pipeline
import torch
import torch.nn.functional as F

TRASHNET_MODEL_ID = "prithivMLmods/Trash-Net"
RESULTS_ROOT = Path(__file__).resolve().parent / "results"
LABEL_TO_STREAM = {
    "cardboard": "recycle",
    "glass": "recycle",
    "metal": "recycle",
    "paper": "recycle",
    "plastic": "recycle",
    "trash": "landfill",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run SAM 2.1 masks through the Trash-Net classifier."
    )
    parser.add_argument("--image", type=Path, required=True,
                        help="Input image path.")
    parser.add_argument(
        "--classifier-id",
        type=str,
        default=TRASHNET_MODEL_ID,
        help="Hugging Face repo ID for Trash-Net.",
    )
    parser.add_argument(
        "--classifier-device",
        type=str,
        default="cuda" if torch.cuda.is_available() else "cpu",
        help="Torch device string for Trash-Net.",
    )
    parser.add_argument(
        "--sam-device",
        type=str,
        default="",
        help="Device passed to the SAM HuggingFace pipeline (e.g. cuda:0).",
    )
    parser.add_argument(
        "--pad-frac",
        type=float,
        default=0.05,
        help="Padding fraction applied to mask bounding boxes when cropping.",
    )
    parser.add_argument(
        "--points-per-batch",
        type=int,
        default=64,
        help="SAM inference param for automatic prompt sampling.",
    )
    parser.add_argument(
        "--sam-score-min",
        type=float,
        default=0.4,
        help="Drop SAM masks whose confidence is below this threshold.",
    )
    parser.add_argument(
        "--min-mask-area-frac",
        type=float,
        default=0.02,
        help="Minimum mask area as a fraction of image pixels.",
    )
    parser.add_argument(
        "--max-mask-area-frac",
        type=float,
        default=0.4,
        help="Maximum mask area as a fraction of image pixels (ignored for ROI matches).",
    )
    parser.add_argument(
        "--edge-margin-frac",
        type=float,
        default=0.02,
        help="If a mask touches the border within this margin and exceeds max area, drop it.",
    )
    parser.add_argument(
        "--classifier-score-min",
        type=float,
        default=0.4,
        help="Discard classifier predictions below this probability.",
    )
    parser.add_argument(
        "--target-point",
        action="append",
        default=None,
        help="Normalized ROI point 'x,y' in [0,1]. Can be passed multiple times.",
    )
    parser.add_argument(
        "--target-radius-frac",
        type=float,
        default=0.25,
        help="Radius of priority circle (fraction of shorter dimension).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory to place outputs (defaults to results/<timestamp>).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit a JSON payload to stdout (logs go to stderr).",
    )
    return parser.parse_args()


def log(message: str, use_json: bool) -> None:
    if use_json:
        print(message, file=sys.stderr)
    else:
        print(message)


def normalize_points(raw_points: Optional[List[str]]) -> List[Tuple[float, float]]:
    parsed: List[Tuple[float, float]] = []
    if not raw_points:
        return parsed
    for token in raw_points:
        try:
            x_str, y_str = token.split(",")
            x_val = max(0.0, min(1.0, float(x_str.strip())))
            y_val = max(0.0, min(1.0, float(y_str.strip())))
            parsed.append((x_val, y_val))
        except Exception as exc:
            raise ValueError(
                f"Could not parse --target-point '{token}'. Expected 'x,y'."
            ) from exc
    return parsed


def classify_crop(
    crop_rgb: np.ndarray,
    crop_mask: np.ndarray,
    processor: AutoImageProcessor,
    model: SiglipForImageClassification,
    device: str,
) -> Optional[Dict[str, float]]:
    if crop_rgb.size == 0:
        return None
    masked = crop_rgb.copy()
    masked[~crop_mask] = 0
    pil_image = Image.fromarray(masked)
    inputs = processor(images=pil_image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    model.eval()
    with torch.no_grad():
        logits = model(**inputs).logits
        probs = F.softmax(logits, dim=-1)[0]

    score, idx = torch.max(probs, dim=0)
    label = model.config.id2label[idx.item()]
    return {"label": label.lower(), "score": float(score.item())}


def main() -> None:
    args = parse_args()

    image_path = args.image.resolve()
    image_bgr = cv2.imread(str(image_path))
    if image_bgr is None:
        raise FileNotFoundError(f"Could not read image {image_path}")

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(image_rgb)

    run_dir = (
        args.output_dir.resolve()
        if args.output_dir
        else RESULTS_ROOT / Path().cwd().stem
    )
    run_dir.mkdir(parents=True, exist_ok=True)
    use_json = args.json
    log(f"Saving outputs under {run_dir}", use_json)

    sam_device = None if args.sam_device == "" else args.sam_device
    sam_pipe = pipeline(
        "mask-generation",
        model="facebook/sam2.1-hiera-tiny",
        device=sam_device,
    )
    outputs = sam_pipe(pil_image, points_per_batch=args.points_per_batch)
    masks = outputs["masks"]
    scores = outputs["scores"]
    if not masks:
        raise RuntimeError("SAM did not return any masks.")

    processor = AutoImageProcessor.from_pretrained(args.classifier_id)
    classifier = SiglipForImageClassification.from_pretrained(args.classifier_id).to(
        args.classifier_device
    )

    overlay = image_bgr.copy()
    metadata: List[Dict] = []
    height, width = image_rgb.shape[:2]
    total_pixels = height * width
    min_pixels = args.min_mask_area_frac * total_pixels
    max_pixels = args.max_mask_area_frac * total_pixels

    target_points = normalize_points(args.target_point)
    target_px = [(tp[0] * width, tp[1] * height) for tp in target_points]
    target_pixels = [
        (
            max(0, min(width - 1, int(round(tp[0] * (width - 1))))),
            max(0, min(height - 1, int(round(tp[1] * (height - 1))))),
        )
        for tp in target_points
    ]
    target_radius = args.target_radius_frac * min(height, width)
    point_radius = max(2, int(round(0.01 * min(width, height))))

    mask_entries: List[Dict] = []
    for mask_idx, (mask_array, score) in enumerate(zip(masks, scores)):
        mask_np = np.asarray(mask_array).astype(bool)
        if not mask_np.any():
            continue

        ys, xs = np.nonzero(mask_np)
        cy, cx = int(ys.mean()), int(xs.mean())

        if target_px:
            distances = [abs(cx - tx) + abs(cy - ty) for tx, ty in target_px]
            min_distance = min(distances)
        else:
            distances = []
            min_distance = None

        covered_points = set()
        if target_pixels:
            for idx_pt, (px_idx, py_idx) in enumerate(target_pixels):
                if mask_np[py_idx, px_idx]:
                    covered_points.add(idx_pt)
                    continue
                x0 = max(0, px_idx - point_radius)
                x1 = min(width, px_idx + point_radius + 1)
                y0 = max(0, py_idx - point_radius)
                y1 = min(height, py_idx + point_radius + 1)
                if mask_np[y0:y1, x0:x1].any():
                    covered_points.add(idx_pt)

        inside_target = bool(covered_points) or (
            min_distance is not None and min_distance <= target_radius
        )

        if not inside_target and score < args.sam_score_min:
            continue

        area = int(mask_np.sum())
        if area < min_pixels:
            continue

        bbox = cv2.boundingRect(mask_np.astype(np.uint8))
        x1, y1, bw, bh = bbox
        x2 = x1 + bw
        y2 = y1 + bh

        if area > max_pixels and not inside_target:
            continue

        margin = args.edge_margin_frac
        touches_edge = (
            x1 <= margin * width
            or x2 >= width - margin * width
            or y1 <= margin * height
            or y2 >= height - margin * height
        )
        if touches_edge and area > max_pixels and not inside_target:
            continue

        mask_entries.append(
            {
                "mask_index": mask_idx,
                "sam_score": float(score),
                "area": area,
                "bbox": [x1, y1, x2, y2],
                "mask": mask_np,
                "crop_slice": (slice(y1, y2 + 1), slice(x1, x2 + 1)),
                "centroid": (cx, cy),
                "inside_target": inside_target,
                "covered_points": sorted(list(covered_points)),
                "distances": distances,
            }
        )

    if not mask_entries:
        log("No masks survived filtering; nothing to do.", use_json)
        return

    selected_entries: List[Dict] = []
    if target_pixels:
        used_masks = set()
        for idx_pt in range(len(target_pixels)):
            covering = [
                e
                for e in mask_entries
                if idx_pt in e["covered_points"] and e["mask_index"] not in used_masks
            ]
            if covering:
                best = min(covering, key=lambda e: e["area"])
                used_masks.add(best["mask_index"])
                selected_entries.append(best)

        if not selected_entries:
            log("No masks matched the selected points.", use_json)
            return
    else:
        selected_entries = sorted(
            mask_entries, key=lambda e: e["sam_score"], reverse=True
        )

    for entry in selected_entries:
        mask_np = entry["mask"]
        y_slice, x_slice = entry["crop_slice"]
        crop_rgb = image_rgb[y_slice, x_slice]
        mask_crop = mask_np[y_slice, x_slice]

        result = classify_crop(
            crop_rgb, mask_crop, processor, classifier, args.classifier_device
        )

        stream_value = "unknown"
        label_text = "unknown"
        score = None
        if result:
            label_text = result["label"]
            score = result["score"]
            stream_value = LABEL_TO_STREAM.get(label_text, "unknown")

        stream_color = {
            "recycle": (67, 160, 71),
            "compost": (102, 187, 106),
            "landfill": (97, 97, 97),
            "unknown": (255, 193, 7),
        }[stream_value]

        overlay[mask_np] = (
            0.6 * overlay[mask_np] + 0.4 *
            np.array(stream_color, dtype=np.float32)
        )

        cx, cy = entry["centroid"]
        label_line = f"{label_text} ({stream_value})"
        if score is not None:
            label_line += f" {score:.2f}"
        cv2.putText(
            overlay,
            label_line,
            (max(cx - 20, 5), max(cy - 5, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            stream_color,
            2,
            cv2.LINE_AA,
        )

        metadata.append(
            {
                "mask_index": entry["mask_index"],
                "sam_score": entry["sam_score"],
                "bbox": entry["bbox"],
                "area": entry["area"],
                "classifier_label": label_text,
                "classifier_score": score,
                "stream": stream_value,
                "centroid": entry["centroid"],
                "covered_points": entry.get("covered_points"),
            }
        )

    overlay_path = run_dir / f"{image_path.stem}_sam_trashnet_overlay.png"
    cv2.imwrite(str(overlay_path), overlay)

    metadata_path = run_dir / f"{image_path.stem}_sam_trashnet_overlay.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump({"image": str(image_path), "masks": metadata}, f, indent=2)

    payload = {
        "image": str(image_path),
        "overlay_path": str(overlay_path),
        "metadata_path": str(metadata_path),
        "masks": metadata,
        "mode": "sam_trashnet",
    }

    if use_json:
        print(json.dumps(payload))
    else:
        log(f"Saved overlay to {overlay_path}", use_json)
        log(f"Saved metadata to {metadata_path}", use_json)


if __name__ == "__main__":
    main()
