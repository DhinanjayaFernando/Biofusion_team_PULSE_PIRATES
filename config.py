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
    "malaria_multi": os.path.join(base_model_dir, "malaria_multi_best.pt"),  # Multi-class malaria model
    "malaria_advanced": os.path.join(base_model_dir, "Malaria_last_best.pt"),  # Advanced multi-class malaria model (larger architecture)
    "dengue": os.path.join(base_model_dir, "platelet_best.pt")  # Attention-based model for dengue analysis
}

# Model configurations
# Based on actual training notebooks:
# - Malaria.ipynb: Single class model (trophozoite only)
# - malaria_multi.ipynb: Multi-class model (7 classes including parasite stages)
# - Platelet.ipynb: Three class attention model (WBC, RBC, Platelet) for dengue diagnosis
MODEL_CONFIGS = {
    "malaria": {
        "name": "Malaria Detection (Trophozoite)",
        "description": "Detects malaria trophozoite parasites in blood smear",
        "classes": {
            0: "Trophozoite"  # Only trophozoite class as per Malaria.ipynb
        },
        "count_mode": "total"  # Count total trophozoites detected
    },
    "malaria_multi": {
        "name": "Malaria Multi-Class Detection",
        "description": "Detects blood cells and all malaria parasite stages (RBC, trophozoite, ring, schizont, gametocyte)",
        "classes": {
            0: "Red Blood Cell",
            1: "Trophozoite",
            2: "Difficult",
            3: "Ring",
            4: "Schizont",
            5: "Gametocyte",
            6: "Leukocyte"
        },
        "count_mode": "per_class"  # Count each class separately
    },
    "malaria_advanced": {
        "name": "Malaria Advanced Detection",
        "description": "Advanced YOLOv8 model for malaria detection with improved accuracy (RBC, trophozoite, ring, schizont, gametocyte, leukocyte)",
        "classes": {
            0: "Red Blood Cell",
            1: "Trophozoite",
            2: "Difficult",
            3: "Ring",
            4: "Schizont",
            5: "Gametocyte",
            6: "Leukocyte"
        },
        "count_mode": "per_class"  # Count each class separately
    },
    "dengue": {
        "name": "Dengue Analysis",
        "description": "Detects blood cells with attention mechanism for dengue risk assessment",
        "classes": {
            0: "WBC",  # White Blood Cell (class 0)
            1: "RBC",  # Red Blood Cell (class 1)
            2: "Platelet"  # Platelet (class 2)
        },
        "count_mode": "per_class"  # Count each class separately (WBC, RBC, Platelet)
    }
}

# Visible models in UI (keep others intact for future use)
# To enable more models, add them to this list: "malaria", "malaria_multi"
VISIBLE_MODELS = ["malaria", "malaria_multi", "malaria_advanced", "dengue"]

# Magnification settings for platelet count calculation
# Conversion factor depends on microscope field of view at different magnifications
# Clinical standard: 100x oil immersion (1000x total) with factor of 15,000
MAGNIFICATION_OPTIONS = {
    "100x_oil": {
        "name": "100x Oil Immersion (Standard)",
        "description": "1000x total magnification - Clinical standard",
        "conversion_factor": 15000,
        "is_default": True
    },
    "100x_oil_fn22": {
        "name": "100x Oil (FN=22 eyepiece)",
        "description": "1000x with wider field number eyepiece",
        "conversion_factor": 20000,
        "is_default": False
    },
    "40x": {
        "name": "40x Objective",
        "description": "400x total magnification",
        "conversion_factor": 3750,
        "is_default": False
    }
}

DEFAULT_MAGNIFICATION = "100x_oil"

# Malaria detection settings
# Classes that indicate malaria infection (parasites only, not blood cells)
MALARIA_PARASITE_CLASSES = ["Trophozoite", "Ring", "Schizont", "Gametocyte"]

# Malaria severity thresholds based on parasite count per image
# Based on WHO/CDC guidelines adapted for image-based detection
MALARIA_SEVERITY_THRESHOLDS = {
    "negative": 0,      # No parasites detected
    "low": 10,          # 1-10 parasites - Low parasitemia
    "moderate": 50,     # 11-50 parasites - Moderate parasitemia
    "high": float('inf') # >50 parasites - High parasitemia (severe)
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

