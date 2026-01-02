"""
Modular FastAPI application for ML Blood Smear Detection
"""
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import base64
import logging

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


# Serve static files (frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")
