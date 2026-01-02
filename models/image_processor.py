"""
Image processing module for detection and annotation
"""
import cv2
import numpy as np
from PIL import Image
import io
from typing import Dict, Tuple, Optional, Any
from ultralytics import YOLO
import logging

logger = logging.getLogger(__name__)


class ImageProcessor:
    """Handles image processing, inference, and annotation"""
    
    def __init__(self, confidence_threshold: float = 0.3):
        """
        Initialize image processor
        
        Args:
            confidence_threshold: Minimum confidence for detections
        """
        self.confidence_threshold = confidence_threshold
    
    def decode_image(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """
        Decode image bytes to numpy array
        
        Args:
            image_bytes: Raw image bytes
            
        Returns:
            Decoded image as numpy array or None if failed
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.error(f"Failed to decode image: {str(e)}")
            return None
    
    def run_inference(self, model: YOLO, image: np.ndarray) -> Optional[Any]:
        """
        Run YOLOv8 inference on image
        
        Args:
            model: YOLOv8 model instance
            image: Input image as numpy array
            
        Returns:
            YOLO results object or None if failed
        """
        try:
            results = model(image, conf=self.confidence_threshold, verbose=False)
            return results
        except Exception as e:
            logger.error(f"Inference failed: {str(e)}")
            return None
    
    def count_detections(self, results: Any, class_mapping: Dict[int, str], count_mode: str = "per_class") -> Dict[str, int]:
        """
        Count detections by class
        
        Args:
            results: YOLO results object
            class_mapping: Dictionary mapping class IDs to names
            count_mode: "per_class" to count each class, "total" for total count
            
        Returns:
            Dictionary with detection counts
        """
        if results is None or len(results) == 0:
            return {}
        
        detections = results[0].boxes
        counts = {}
        
        if count_mode == "per_class":
            # Count each class separately
            for class_id, class_name in class_mapping.items():
                class_detections = detections[detections.cls == class_id]
                counts[class_name] = len(class_detections)
        elif count_mode == "total":
            # Count total detections
            total = len(detections)
            # If specific class mapping exists, use that class name
            if len(class_mapping) == 1:
                # Single class model (e.g., malaria - only trophozoite)
                class_name = list(class_mapping.values())[0]
                counts[class_name] = total
            else:
                # Multi-class model - count all detections as total
                counts["Total"] = total
        else:
            # Default: count all classes
            for class_id, class_name in class_mapping.items():
                class_detections = detections[detections.cls == class_id]
                counts[class_name] = len(class_detections)
        
        return counts
    
    def annotate_image(self, results: Any) -> Optional[np.ndarray]:
        """
        Draw bounding boxes on image
        
        Args:
            results: YOLO results object
            
        Returns:
            Annotated image as numpy array or None if failed
        """
        try:
            annotated_img = results[0].plot()
            # Convert BGR to RGB for display
            annotated_img = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
            return annotated_img
        except Exception as e:
            logger.error(f"Annotation failed: {str(e)}")
            return None
    
    def image_to_bytes(self, image: np.ndarray, format: str = 'PNG') -> io.BytesIO:
        """
        Convert numpy image array to bytes
        
        Args:
            image: Image as numpy array
            format: Image format (PNG, JPEG, etc.)
            
        Returns:
            BytesIO object with image data
        """
        pil_img = Image.fromarray(image)
        img_bytes = io.BytesIO()
        pil_img.save(img_bytes, format=format)
        img_bytes.seek(0)
        return img_bytes
    
    def process_detection(
        self, 
        image_bytes: bytes, 
        model: YOLO, 
        class_mapping: Dict[int, str],
        count_mode: str = "per_class"
    ) -> Tuple[Optional[io.BytesIO], Dict[str, int]]:
        """
        Complete detection pipeline: decode -> infer -> count -> annotate
        
        Args:
            image_bytes: Raw image bytes
            model: YOLOv8 model instance
            class_mapping: Dictionary mapping class IDs to names
            count_mode: How to count detections ("per_class" or "total")
            
        Returns:
            Tuple of (annotated_image_bytes, detection_counts)
        """
        # Decode image
        image = self.decode_image(image_bytes)
        if image is None:
            return None, {}
        
        # Run inference
        results = self.run_inference(model, image)
        if results is None:
            return None, {}
        
        # Count detections
        counts = self.count_detections(results, class_mapping, count_mode)
        
        # Annotate image
        annotated_img = self.annotate_image(results)
        if annotated_img is None:
            return None, counts
        
        # Convert to bytes
        annotated_bytes = self.image_to_bytes(annotated_img)
        
        return annotated_bytes, counts
    
    def aggregate_platelet_counts(self, individual_counts: list, images_processed: int = None) -> Dict[str, Any]:
        """
        Aggregate platelet detection counts across multiple images per patient/sample
        using clinical protocol: average detections and convert to platelets/µL
        
        Args:
            individual_counts: List of detection count dictionaries from multiple images
                               Each dict should have 'Platelet' key with count
            images_processed: Number of images processed (if different from list length)
            
        Returns:
            Dictionary with aggregated results:
            {
                'total_detections': int (sum of all platelet detections),
                'images_count': int (number of images processed),
                'avg_platelets_per_image': float (Σ detections / N),
                'platelets_per_ul': float (Avg × 15,000)
            }
        """
        if not individual_counts or len(individual_counts) == 0:
            logger.warning("No detection counts provided for aggregation")
            return {
                'total_detections': 0,
                'images_count': 0,
                'avg_platelets_per_image': 0,
                'platelets_per_ul': 0
            }
        
        # Get number of images
        n_images = images_processed if images_processed is not None else len(individual_counts)
        
        # Sum all platelet detections
        total_detections = 0
        for count_dict in individual_counts:
            platelet_count = count_dict.get('Platelet', 0)
            total_detections += platelet_count
        
        # Calculate average platelets per image
        avg_platelets_per_image = total_detections / n_images if n_images > 0 else 0
        
        # Convert to platelets/µL using clinical conversion factor
        platelets_per_ul = avg_platelets_per_image * 15000
        
        logger.info(f"Platelet Aggregation - Images: {n_images}, Total detections: {total_detections}, "
                   f"Avg/image: {avg_platelets_per_image:.2f}, Platelets/µL: {platelets_per_ul:,.0f}")
        
        return {
            'total_detections': total_detections,
            'images_count': n_images,
            'avg_platelets_per_image': round(avg_platelets_per_image, 2),
            'platelets_per_ul': round(platelets_per_ul, 0)
        }

