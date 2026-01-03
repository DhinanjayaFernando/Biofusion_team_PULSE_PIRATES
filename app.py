"""
Modular FastAPI application for ML Blood Smear Detection
"""
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import base64
import logging
import uuid
from typing import List, Dict, Any

from config import MODEL_PATHS, MODEL_CONFIGS, CONFIDENCE_THRESHOLD, API_TITLE
from models.model_loader import ModelManager
from models.image_processor import ImageProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title=API_TITLE)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global managers
model_manager: ModelManager = None
image_processor: ImageProcessor = None

# In-memory session storage for aggregation
# Format: {session_id: {"images": [counts_dict], "processed_images": int, "mode": "platelet"}}
aggregation_sessions: Dict[str, Dict[str, Any]] = {}


def initialize_models():
    """Initialize model manager and load all models"""
    global model_manager, image_processor
    
    # Prepare model configurations
    model_configs = {}
    for model_key in MODEL_PATHS.keys():
        model_configs[model_key] = {
            "path": MODEL_PATHS[model_key],
            "name": MODEL_CONFIGS[model_key]["name"]
        }
    
    # Initialize model manager
    model_manager = ModelManager(model_configs)
    
    # Load all models
    logger.info("Loading models...")
    load_results = model_manager.load_all()
    
    # Log results
    for model_key, success in load_results.items():
        if success:
            logger.info(f"✓ {model_key} model loaded successfully")
        else:
            logger.warning(f"✗ {model_key} model failed to load or not found")
    
    # Initialize image processor
    image_processor = ImageProcessor(confidence_threshold=CONFIDENCE_THRESHOLD)
    logger.info("Image processor initialized")


@app.on_event("startup")
async def startup_event():
    """Initialize models when server starts"""
    initialize_models()


@app.get("/")
async def root():
    """Serve the frontend"""
    return FileResponse("static/index.html")


@app.get("/health")
async def health():
    """Health check endpoint"""
    if model_manager is None:
        return {"status": "initializing", "models_loaded": {}}
    
    return {
        "status": "running",
        "models_loaded": model_manager.get_model_info()
    }


@app.get("/api/models")
async def get_available_models():
    """Get list of available detection modes with configuration"""
    if model_manager is None:
        return {"available_modes": [], "models": {}}
    
    available_modes = model_manager.get_available_models()
    
    # Build response with model details
    models_info = {}
    for model_key in MODEL_CONFIGS.keys():
        is_available = model_manager.is_available(model_key)
        config = MODEL_CONFIGS[model_key]
        models_info[model_key] = {
            "available": is_available,
            "name": config["name"],
            "description": config["description"],
            "classes": config["classes"]
        }
    
    return {
        "available_modes": available_modes,
        "models": models_info
    }


@app.post("/detect")
async def detect(
    image: UploadFile = File(...),
    mode: str = Form(...)
):
    """
    Detect cells in uploaded image
    
    Args:
        image: Image file (JPEG, PNG, etc.)
        mode: Detection mode - 'malaria' or 'platelet'
    
    Returns:
        JSON with annotated image (base64) and detection counts
    """
    # Validate mode
    if mode not in MODEL_CONFIGS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid mode '{mode}'. Available modes: {list(MODEL_CONFIGS.keys())}"
        )
    
    # Check if model is available
    if not model_manager.is_available(mode):
        model_name = MODEL_CONFIGS[mode]["name"]
        raise HTTPException(
            status_code=503, 
            detail=f"{model_name} model is not available. Please ensure the model file exists."
        )
    
    # Get model and configuration
    model = model_manager.get_model(mode)
    config = MODEL_CONFIGS[mode]
    class_mapping = config["classes"]
    count_mode = config["count_mode"]
    
    # Read image bytes
    image_bytes = await image.read()
    
    if not image_bytes:
        raise HTTPException(status_code=400, detail="No image data provided")
    
    try:
        # Process image using modular processor
        annotated_img_bytes, counts = image_processor.process_detection(
            image_bytes=image_bytes,
            model=model,
            class_mapping=class_mapping,
            count_mode=count_mode
        )
        
        if annotated_img_bytes is None:
            raise HTTPException(status_code=400, detail="Failed to decode or process image. Please ensure the image file is valid and in a supported format (JPEG, PNG, BMP, etc.)")
        
        # Convert annotated image to base64
        annotated_img_base64 = base64.b64encode(annotated_img_bytes.read()).decode('utf-8')
        
        return JSONResponse(content={
            "success": True,
            "annotated_image": f"data:image/png;base64,{annotated_img_base64}",
            "counts": counts,
            "mode": mode,
            "model_name": config["name"]
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/api/aggregation/start")
async def start_aggregation(mode: str = Form(...)):
    """
    Start a new aggregation session for multi-image batch processing
    
    Args:
        mode: Detection mode - 'platelet' for platelet aggregation
    
    Returns:
        JSON with session ID for tracking the aggregation batch
    """
    if mode != "platelet":
        raise HTTPException(
            status_code=400,
            detail="Aggregation currently only supported for 'platelet' mode"
        )
    
    # Create new session
    session_id = str(uuid.uuid4())
    aggregation_sessions[session_id] = {
        "images": [],
        "mode": mode,
        "created_at": None
    }
    
    logger.info(f"Started aggregation session {session_id} for {mode}")
    
    return {
        "session_id": session_id,
        "mode": mode,
        "message": "Aggregation session created. Upload images to this session."
    }


@app.post("/api/aggregation/upload")
async def upload_to_aggregation(
    session_id: str = Form(...),
    image: UploadFile = File(...)
):
    """
    Upload an image to an active aggregation session
    
    Args:
        session_id: Session ID from start_aggregation
        image: Image file to process
    
    Returns:
        JSON with detection result for this image
    """
    # Validate session exists
    if session_id not in aggregation_sessions:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found. Start a new aggregation session first."
        )
    
    session = aggregation_sessions[session_id]
    mode = session.get("mode", "platelet")
    
    # Validate mode
    if mode not in MODEL_CONFIGS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{mode}'. Available modes: {list(MODEL_CONFIGS.keys())}"
        )
    
    # Check if model is available
    if not model_manager.is_available(mode):
        model_name = MODEL_CONFIGS[mode]["name"]
        raise HTTPException(
            status_code=503,
            detail=f"{model_name} model is not available. Please ensure the model file exists."
        )
    
    # Get model and configuration
    model = model_manager.get_model(mode)
    config = MODEL_CONFIGS[mode]
    class_mapping = config["classes"]
    count_mode = config["count_mode"]
    
    # Read image bytes
    image_bytes = await image.read()
    
    try:
        # Process image using modular processor
        annotated_img_bytes, counts = image_processor.process_detection(
            image_bytes=image_bytes,
            model=model,
            class_mapping=class_mapping,
            count_mode=count_mode
        )
        
        if annotated_img_bytes is None:
            raise HTTPException(status_code=500, detail="Failed to process image")
        
        # Store counts in session
        session["images"].append(counts)
        image_count = len(session["images"])
        
        # Convert annotated image to base64
        annotated_img_base64 = base64.b64encode(annotated_img_bytes.read()).decode('utf-8')
        
        logger.info(f"Session {session_id}: Processed image {image_count}, counts: {counts}")
        
        return {
            "success": True,
            "image_number": image_count,
            "counts": counts,
            "annotated_image": f"data:image/png;base64,{annotated_img_base64}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing image in aggregation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/api/aggregation/finalize")
async def finalize_aggregation(session_id: str = Form(...)):
    """
    Finalize aggregation session and compute clinical platelet count
    
    Args:
        session_id: Session ID from start_aggregation
    
    Returns:
        JSON with aggregated results:
        - total_detections: Sum of all platelet detections
        - images_count: Number of images processed
        - avg_platelets_per_image: Average platelets (Σ detections / N)
        - platelets_per_ul: Clinical conversion (Avg × 15,000)
    """
    # Validate session exists
    if session_id not in aggregation_sessions:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found"
        )
    
    session = aggregation_sessions[session_id]
    
    # Validate images were uploaded
    if not session["images"] or len(session["images"]) == 0:
        raise HTTPException(
            status_code=400,
            detail="No images in session. Upload at least one image before finalizing."
        )
    
    try:
        # Perform aggregation
        aggregation_result = image_processor.aggregate_platelet_counts(
            individual_counts=session["images"]
        )
        
        logger.info(f"Session {session_id} finalized: {aggregation_result}")
        
        # Clean up session (optional - keep for 5 min then auto-delete)
        # For now, just mark as complete
        session["completed"] = True
        session["result"] = aggregation_result
        
        return {
            "success": True,
            "session_id": session_id,
            "aggregation": aggregation_result,
            "clinical_interpretation": get_clinical_interpretation(aggregation_result["platelets_per_ul"])
        }
    except Exception as e:
        logger.error(f"Error finalizing aggregation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error finalizing aggregation: {str(e)}")


def get_clinical_interpretation(platelets_per_ul: float) -> Dict[str, str]:
    """
    Get clinical interpretation of platelet count for dengue diagnosis
    
    Based on WHO dengue classification and clinical guidelines:
    - Normal: 150,000 - 450,000 platelets/µL
    - Mild: 50,000 - 150,000 platelets/µL (monitor closely)
    - Moderate: 20,000 - 50,000 platelets/µL (warning signs)
    - Severe: < 20,000 platelets/µL (high risk for severe bleeding/shock)
    
    Args:
        platelets_per_ul: Platelet count in platelets/µL
    
    Returns:
        Dictionary with status, risk level, range, and interpretation
    """
    if platelets_per_ul >= 150000:
        return {
            "status": "Normal",
            "risk_level": "No Risk",
            "range": "150,000 - 450,000 platelets/µL",
            "interpretation": "Platelet count within normal range. No dengue-related risk.",
            "severity": "normal"
        }
    elif platelets_per_ul >= 50000:
        return {
            "status": "Mild Thrombocytopenia",
            "risk_level": "Low Risk",
            "range": "50,000 - 149,999 platelets/µL",
            "interpretation": "Low platelet count. Monitor closely for dengue symptoms and progression.",
            "severity": "mild"
        }
    elif platelets_per_ul >= 20000:
        return {
            "status": "Moderate Thrombocytopenia",
            "risk_level": "Medium Risk",
            "range": "20,000 - 49,999 platelets/µL",
            "interpretation": "Warning signs present. Significant thrombocytopenia consistent with severe dengue. Close monitoring required.",
            "severity": "moderate"
        }
    else:
        return {
            "status": "Severe Thrombocytopenia",
            "risk_level": "High Risk",
            "range": "< 20,000 platelets/µL",
            "interpretation": "CRITICAL: High risk for severe bleeding and hemorrhagic shock. Immediate medical intervention required.",
            "severity": "severe"
        }


# Serve static files (frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")
