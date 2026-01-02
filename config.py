"""
Configuration file for ML Blood Smear Detection App
"""
import os
from typing import Dict, Optional

# Model paths
# Supports both local paths and Docker paths
# For Docker: use "/app/models_dir/malaria_best.pt"
# For local: use "malaria_best.pt" (relative to project root)
MODEL_DIR = os.environ.get("MODEL_DIR")
# If MODEL_DIR env var is set, use it. Otherwise prefer Docker model directory
# when running inside container or when it exists in filesystem; fall back to
# project root for local runs.
if MODEL_DIR:
    base_model_dir = MODEL_DIR
elif os.path.exists("/app/models_dir"):
    base_model_dir = "/app/models_dir"
else:
    base_model_dir = "."

MODEL_PATHS = {
    "malaria": os.path.join(base_model_dir, "malaria_best.pt"),
    "platelet": os.path.join(base_model_dir, "platelet_best.pt")
}

# Model configurations
# Based on actual training notebooks:
# - Malaria.ipynb: Single class model (trophozoite only)
# - Platelet.ipynb: Three class model (WBC, RBC, Platelet)
MODEL_CONFIGS = {
    "malaria": {
        "name": "Malaria Detection (Trophozoite)",
        "description": "Detects malaria trophozoite parasites in blood smear",
        "classes": {
            0: "Trophozoite"  # Only trophozoite class as per Malaria.ipynb
        },
        "count_mode": "total"  # Count total trophozoites detected
    },
    "platelet": {
        "name": "Dengue Detection (Platelet Analysis)",
        "description": "Detects platelets in blood smear for dengue risk assessment",
        "classes": {
            0: "WBC",  # White Blood Cell (class 0)
            1: "RBC",  # Red Blood Cell (class 1)
            2: "Platelet"  # Platelet (class 2)
        },
        "count_mode": "per_class"  # Count each class separately (WBC, RBC, Platelet)
    }
}

# Detection settings
CONFIDENCE_THRESHOLD = 0.3
MAX_IMAGE_SIZE = 2048  # Maximum image dimension for processing

# API settings
API_TITLE = "ML Blood Smear Detection API"
API_VERSION = "1.0.0"

# Frontend settings
FRONTEND_TITLE = "ML Blood Smear Detection"
FRONTEND_SUBTITLE = "YOLOv8-based Malaria & Blood Cell Detection"

