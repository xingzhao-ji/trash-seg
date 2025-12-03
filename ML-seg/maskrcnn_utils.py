"""
Reusable helpers for loading the Mask R-CNN TACO checkpoint and running inference.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Dict

import torch
from torchvision.models.detection import maskrcnn_resnet50_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor
from torchvision.transforms import functional as F

DEFAULT_NUM_CLASSES = 61  # 60 TACO classes + background


def build_model(num_classes: int = DEFAULT_NUM_CLASSES) -> torch.nn.Module:
    """Create a Mask R-CNN model with the requested number of classes."""
    model = maskrcnn_resnet50_fpn(weights=None)

    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)

    in_features_mask = model.roi_heads.mask_predictor.conv5_mask.in_channels
    hidden_layer = 256
    model.roi_heads.mask_predictor = MaskRCNNPredictor(
        in_features_mask, hidden_layer, num_classes
    )
    return model


def load_model(
    checkpoint: Path,
    device: str,
    num_classes: int = DEFAULT_NUM_CLASSES,
    log: Callable[[str], None] | None = None,
) -> torch.nn.Module:
    """Load the Mask R-CNN checkpoint onto the requested device."""
    if log:
        log(f"Loading Mask R-CNN weights from {checkpoint}")

    model = build_model(num_classes)
    state_dict = torch.load(checkpoint, map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model


@torch.inference_mode()
def run_inference(
    model: torch.nn.Module,
    image_bgr,
    device: str,
    conf_threshold: float = 0.5,
) -> Dict[str, torch.Tensor]:
    """Run inference on a BGR numpy array and return filtered detections."""
    image_rgb = image_bgr[:, :, ::-1].copy()
    tensor = F.to_tensor(image_rgb).to(device)

    predictions = model([tensor])[0]
    keep = predictions["scores"] > conf_threshold

    return {
        "boxes": predictions["boxes"][keep].cpu().numpy(),
        "labels": predictions["labels"][keep].cpu().numpy(),
        "scores": predictions["scores"][keep].cpu().numpy(),
        "masks": predictions["masks"][keep].cpu().numpy(),
    }

