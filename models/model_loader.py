"""
Modular model loader for YOLOv8 models
"""
import os
from typing import Optional, Dict, Any
import logging

# Import CBAM module to register it with ultralytics before loading models
# This is required for loading models trained with CBAM attention
from models.cbam import CBAM, register_cbam

from ultralytics import YOLO

logger = logging.getLogger(__name__)


class ModelLoader:
    """Handles loading and management of YOLOv8 models"""
    
    def __init__(self, model_path: str, model_name: str):
        """
        Initialize model loader
        
        Args:
            model_path: Path to the .pt model file
            model_name: Name identifier for the model
        """
        self.model_path = model_path
        self.model_name = model_name
        self.model: Optional[YOLO] = None
        self.is_loaded = False
        
    def load(self) -> bool:
        """
        Load the YOLOv8 model
        
        Returns:
            True if loaded successfully, False otherwise
        """
        if not os.path.exists(self.model_path):
            logger.warning(f"{self.model_name} model not found at {self.model_path}")
            return False
            
        try:
            logger.info(f"Loading {self.model_name} model from {self.model_path}...")
            self.model = YOLO(self.model_path)
            self.is_loaded = True
            logger.info(f"{self.model_name} model loaded successfully!")
            return True
        except Exception as e:
            logger.error(f"Failed to load {self.model_name} model: {str(e)}")
            self.is_loaded = False
            return False
    
    def get_model(self) -> Optional[YOLO]:
        """Get the loaded model"""
        return self.model if self.is_loaded else None
    
    def is_available(self) -> bool:
        """Check if model is loaded and available"""
        return self.is_loaded and self.model is not None


class ModelManager:
    """Manages multiple model loaders"""
    
    def __init__(self, model_configs: Dict[str, Dict[str, Any]]):
        """
        Initialize model manager
        
        Args:
            model_configs: Dictionary mapping model keys to their configurations
                          Format: {"model_key": {"path": "...", "name": "..."}}
        """
        self.models: Dict[str, ModelLoader] = {}
        self.model_configs = model_configs
        
        # Initialize model loaders
        for model_key, config in model_configs.items():
            model_path = config.get("path", "")
            model_name = config.get("name", model_key)
            self.models[model_key] = ModelLoader(model_path, model_name)
    
    def load_all(self) -> Dict[str, bool]:
        """
        Load all models
        
        Returns:
            Dictionary mapping model keys to load success status
        """
        results = {}
        for model_key, loader in self.models.items():
            results[model_key] = loader.load()
        return results
    
    def get_model(self, model_key: str) -> Optional[YOLO]:
        """
        Get a specific model by key
        
        Args:
            model_key: Key identifying the model
            
        Returns:
            YOLO model instance or None if not available
        """
        if model_key in self.models:
            return self.models[model_key].get_model()
        return None
    
    def is_available(self, model_key: str) -> bool:
        """
        Check if a model is available
        
        Args:
            model_key: Key identifying the model
            
        Returns:
            True if model is loaded and available
        """
        if model_key in self.models:
            return self.models[model_key].is_available()
        return False
    
    def get_available_models(self) -> list:
        """
        Get list of available model keys
        
        Returns:
            List of model keys that are loaded and available
        """
        return [key for key, loader in self.models.items() if loader.is_available()]
    
    def get_model_info(self) -> Dict[str, bool]:
        """
        Get status of all models
        
        Returns:
            Dictionary mapping model keys to availability status
        """
        return {key: loader.is_available() for key, loader in self.models.items()}

