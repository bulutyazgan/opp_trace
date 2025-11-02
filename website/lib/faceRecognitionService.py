#!/usr/bin/env python3
"""
Advanced Face Recognition Service for Opp Trace Dashboard
Integrated from the tested face_recognition_service implementation
Matches a target face image against LinkedIn profile photos using DeepFace with ensemble models
"""

import sys
import json
import base64
import io
import os
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from deepface import DeepFace
from PIL import Image, ImageEnhance
import numpy as np
import hashlib
import tempfile
import requests
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Redirect all library outputs to stderr to keep stdout clean for JSON
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow logs
os.environ['GLOG_minloglevel'] = '2'  # Suppress glog messages

# Set up logging to stderr (stdout is reserved for JSON output)
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Suppress warnings to stderr
import warnings
warnings.filterwarnings('ignore')

# Redirect stdout temporarily to ensure only JSON is printed
class StdoutFilter:
    """Filter to prevent libraries from writing to stdout"""
    def __init__(self):
        self.original_stdout = sys.stdout
        self.buffer = []

    def write(self, text):
        # Only allow our JSON output (starts with '{')
        if text.strip().startswith('{'):
            self.original_stdout.write(text)
        elif text.strip():
            # Redirect everything else to stderr
            sys.stderr.write(text)

    def flush(self):
        self.original_stdout.flush()


class FaceRecognitionService:
    """Advanced face recognition service with ensemble models and quality assessment"""

    # Recommended thresholds for different models (cosine distance)
    THRESHOLDS = {
        'VGG-Face': 0.40,
        'Facenet': 0.40,
        'Facenet512': 0.30,
        'OpenFace': 0.10,
        'DeepFace': 0.23,
        'DeepID': 0.015,
        'ArcFace': 0.68,
        'Dlib': 0.07,
        'SFace': 0.593
    }

    def __init__(
        self,
        model_name: str = "VGG-Face",
        distance_metric: str = "cosine",
        enforce_detection: bool = False,
        detector_backend: str = "retinaface",
        cache_images: bool = True,
        extract_faces: bool = True,
        align_faces: bool = True,
        expand_face_region: float = 1.2,
        use_ensemble: bool = False,
        ensemble_models: List[str] = None,
        enhance_images: bool = True,
        face_quality_threshold: float = 0.0,
        use_parallel: bool = False,
        max_workers: int = 4
    ):
        self.model_name = model_name
        self.distance_metric = distance_metric
        self.enforce_detection = enforce_detection
        self.detector_backend = detector_backend
        self.cache_images = cache_images
        self.extract_faces = extract_faces
        self.align_faces = align_faces
        self.expand_face_region = expand_face_region
        self.use_ensemble = use_ensemble
        self.enhance_images = enhance_images
        self.face_quality_threshold = face_quality_threshold
        self.use_parallel = use_parallel
        self.max_workers = max_workers

        # Ensemble setup
        if ensemble_models:
            self.ensemble_models = ensemble_models
        elif use_ensemble:
            # Default high-accuracy ensemble
            self.ensemble_models = ['Facenet512', 'ArcFace', 'VGG-Face']
        else:
            self.ensemble_models = [model_name]

        self.image_cache = {}
        self.face_cache = {}
        self.embedding_cache = {}

    def verify_image(self, image_path: str) -> bool:
        """Quick verification that image exists and is valid."""
        try:
            if not Path(image_path).exists():
                logger.debug(f"Image file not found: {image_path}")
                return False

            try:
                with Image.open(image_path) as img:
                    if img.mode != 'RGB':
                        rgb_path = Path(image_path).with_suffix('.jpg')
                        img.convert('RGB').save(rgb_path, 'JPEG')
            except Exception as e:
                logger.debug(f"Failed to open image: {e}")
                return False

            return True
        except Exception as e:
            logger.debug(f"Image verification failed: {e}")
            return False

    def enhance_image_quality(self, image_path: str) -> str:
        """
        Enhance image quality for better face recognition.
        Applies brightness, contrast, and sharpness adjustments.
        """
        try:
            img = Image.open(image_path)

            # Enhance contrast
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.2)

            # Enhance sharpness
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(1.3)

            # Enhance brightness slightly
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.1)

            # Save enhanced image
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            img.save(temp_file.name, 'JPEG', quality=95)
            temp_file.close()

            logger.debug("Image enhanced")
            return temp_file.name

        except Exception as e:
            logger.debug(f"Image enhancement failed: {e}")
            return image_path

    def assess_face_quality(self, face_obj: Dict) -> float:
        """
        Assess the quality of a detected face.
        Returns quality score between 0 and 1.
        """
        try:
            facial_area = face_obj.get('facial_area', {})
            confidence = face_obj.get('confidence', 0.5)

            # Check face size (larger is better)
            face_width = facial_area.get('w', 0)
            face_height = facial_area.get('h', 0)
            face_area = face_width * face_height

            # Normalize size score (assuming faces < 10000 pixels are small)
            size_score = min(1.0, face_area / 10000.0)

            # Detection confidence
            conf_score = confidence

            # Check aspect ratio (faces should be roughly square)
            if face_width > 0 and face_height > 0:
                aspect_ratio = face_width / face_height
                # Ideal ratio is around 1.0, penalize extremes
                aspect_score = 1.0 - abs(1.0 - aspect_ratio) * 0.5
                aspect_score = max(0, min(1.0, aspect_score))
            else:
                aspect_score = 0.5

            # Combined quality score
            quality = (size_score * 0.4 + conf_score * 0.4 + aspect_score * 0.2)

            return quality

        except Exception as e:
            logger.debug(f"Quality assessment failed: {e}")
            return 0.5

    def download_and_cache_image(self, url: str) -> Optional[str]:
        """Download image from URL and cache it locally."""
        if not url:
            return None

        if not url.startswith('http'):
            return url if self.verify_image(url) else None

        # Check cache first
        url_hash = hashlib.md5(url.encode()).hexdigest()

        if self.cache_images and url_hash in self.image_cache:
            cached_path = self.image_cache[url_hash]
            if self.verify_image(cached_path):
                return cached_path

        try:
            logger.debug(f"Downloading: {url}")
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
            response = requests.get(url, headers=headers, timeout=15, stream=True, allow_redirects=True)
            response.raise_for_status()

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')

            for chunk in response.iter_content(chunk_size=8192):
                temp_file.write(chunk)

            temp_file.close()
            temp_path = temp_file.name

            # Verify and convert to RGB
            try:
                image = Image.open(temp_path)
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                image.save(temp_path, 'JPEG')
            except Exception as e:
                logger.debug(f"Error processing downloaded image: {e}")
                return None

            if self.verify_image(temp_path):
                if self.cache_images:
                    self.image_cache[url_hash] = temp_path
                return temp_path
            else:
                return None

        except Exception as e:
            logger.debug(f"Failed to download image from {url}: {e}")
            return None

    def extract_best_face(
        self,
        image_path: str,
        target_size: tuple = (224, 224)
    ) -> Optional[Tuple[str, float]]:
        """
        Extract the best quality face from image.
        Returns (path, quality_score) or None.
        """
        cache_key = hashlib.md5(f"{image_path}_extracted".encode()).hexdigest()

        if self.cache_images and cache_key in self.face_cache:
            cached_path, quality = self.face_cache[cache_key]
            if self.verify_image(cached_path):
                logger.debug(f"Using cached extracted face (quality: {quality:.2f})")
                return cached_path, quality

        try:
            # Extract faces using better detector
            face_objs = DeepFace.extract_faces(
                img_path=image_path,
                detector_backend=self.detector_backend,
                enforce_detection=False,
                align=self.align_faces,
                target_size=target_size
            )

            if not face_objs:
                logger.debug("No faces detected in image")
                return None

            # Select best quality face
            best_face = None
            best_quality = 0

            for face_obj in face_objs:
                quality = self.assess_face_quality(face_obj)
                if quality > best_quality:
                    best_quality = quality
                    best_face = face_obj

            if best_face is None or best_quality < self.face_quality_threshold:
                logger.debug(f"No face meets quality threshold ({best_quality:.2f} < {self.face_quality_threshold:.2f})")
                return None

            logger.debug(f"Selected face with quality: {best_quality:.2f}")

            # Get the face image
            face_img = best_face['face']

            if face_img.max() <= 1.0:
                face_img = (face_img * 255).astype(np.uint8)

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            face_pil = Image.fromarray(face_img)
            face_pil.save(temp_file.name, 'JPEG', quality=95)
            temp_file.close()

            # Cache the result
            if self.cache_images:
                self.face_cache[cache_key] = (temp_file.name, best_quality)

            return temp_file.name, best_quality

        except Exception as e:
            logger.debug(f"Face extraction failed: {str(e)[:100]}")
            return None

    def preprocess_image(self, image_path: str) -> Tuple[str, float]:
        """
        Preprocess image with enhancement and face extraction.
        Returns (processed_path, quality_score).
        """
        # Enhance image if enabled
        if self.enhance_images:
            enhanced_path = self.enhance_image_quality(image_path)
        else:
            enhanced_path = image_path

        # Extract face if enabled
        if self.extract_faces:
            result = self.extract_best_face(enhanced_path)
            if result:
                return result
            else:
                logger.debug("Using original image (no face extracted)")
                return enhanced_path, 0.5
        else:
            return enhanced_path, 1.0

    def calculate_confidence(self, distance: float, model_name: str, quality1: float = 1.0, quality2: float = 1.0) -> float:
        """Calculate confidence score from distance and quality."""
        threshold = self.THRESHOLDS.get(model_name, 0.40)

        # Base confidence from distance
        if distance < threshold:
            base_confidence = 1.0 - (distance / threshold) * 0.5
        else:
            base_confidence = max(0, 0.5 - (distance - threshold) / threshold * 0.5)

        # Adjust by image quality (both images should be good quality)
        quality_factor = (quality1 + quality2) / 2.0
        adjusted_confidence = base_confidence * (0.7 + 0.3 * quality_factor)

        return max(0, min(1.0, adjusted_confidence))

    def compare_faces_single_model(
        self,
        img1_path: str,
        img2_path: str,
        model_name: str,
        quality1: float = 1.0,
        quality2: float = 1.0
    ) -> Optional[Dict[str, Any]]:
        """Compare two faces using a single model."""
        try:
            result = DeepFace.verify(
                img1_path=img1_path,
                img2_path=img2_path,
                model_name=model_name,
                distance_metric=self.distance_metric,
                enforce_detection=self.enforce_detection,
                detector_backend=self.detector_backend
            )

            distance = result['distance']
            confidence = self.calculate_confidence(distance, model_name, quality1, quality2)

            return {
                'distance': distance,
                'confidence': confidence,
                'verified': result.get('verified', False),
                'threshold': result.get('threshold', self.THRESHOLDS.get(model_name, 0.40)),
                'model': model_name
            }

        except Exception as e:
            logger.debug(f"Comparison failed with {model_name}: {str(e)[:100]}")
            return None

    def compare_faces_ensemble(
        self,
        img1_path: str,
        img2_path: str,
        quality1: float = 1.0,
        quality2: float = 1.0
    ) -> Optional[Dict[str, Any]]:
        """Compare faces using ensemble of models for better accuracy."""
        results = []

        for model in self.ensemble_models:
            result = self.compare_faces_single_model(img1_path, img2_path, model, quality1, quality2)
            if result:
                results.append(result)

        if not results:
            return None

        # Weighted voting based on model reliability
        weights = {
            'Facenet512': 1.5,
            'ArcFace': 1.5,
            'VGG-Face': 1.0,
            'Facenet': 1.0,
            'OpenFace': 0.8,
            'DeepFace': 1.0
        }

        total_confidence = 0
        total_weight = 0
        distances = []

        for result in results:
            weight = weights.get(result['model'], 1.0)
            total_confidence += result['confidence'] * weight
            total_weight += weight
            distances.append(result['distance'])

        avg_confidence = total_confidence / total_weight if total_weight > 0 else 0
        avg_distance = np.mean(distances)

        # Check if majority of models verified
        verified_count = sum(1 for r in results if r['verified'])
        is_verified = verified_count > len(results) / 2

        return {
            'distance': avg_distance,
            'confidence': avg_confidence,
            'verified': is_verified,
            'threshold': np.mean([r['threshold'] for r in results]),
            'num_models': len(results),
            'individual_results': results
        }

    def compare_faces(
        self,
        img1_path: str,
        img2_path: str
    ) -> Optional[Dict[str, Any]]:
        """Compare two faces with preprocessing and optional ensemble."""
        try:
            # Preprocess both images
            processed_img1, quality1 = self.preprocess_image(img1_path)
            processed_img2, quality2 = self.preprocess_image(img2_path)

            logger.debug(f"Image qualities: {quality1:.2f}, {quality2:.2f}")

            # Use ensemble or single model
            if self.use_ensemble:
                result = self.compare_faces_ensemble(processed_img1, processed_img2, quality1, quality2)
            else:
                result = self.compare_faces_single_model(
                    processed_img1, processed_img2, self.model_name, quality1, quality2
                )

            if result:
                result['quality1'] = quality1
                result['quality2'] = quality2

            return result

        except Exception as e:
            logger.debug(f"Face comparison failed: {str(e)[:100]}")
            return None

    def process_single_profile(
        self,
        profile: Dict[str, Any],
        target_image_path: str,
        image_field: str,
        index: int,
        total: int
    ) -> Optional[Dict[str, Any]]:
        """Process a single profile comparison."""
        # Handle nested linkedinData structure from web API
        linkedin_data = profile.get('linkedinData')
        if not linkedin_data:
            return None

        profile_photo_url = linkedin_data.get('profile_photo')
        if not profile_photo_url:
            return None

        name = profile.get('name', 'Unknown')

        logger.info(f"\n[{index+1}/{total}] Processing: {name}")

        profile_img_path = self.download_and_cache_image(profile_photo_url)

        if not profile_img_path:
            logger.warning(f"  ⚠️  Could not load image")
            return None

        try:
            result = self.compare_faces(target_image_path, profile_img_path)

            if result:
                match_data = {
                    'profile': profile.copy(),
                    'distance': result['distance'],
                    'confidence': result['confidence'],
                    'verified': result['verified'],
                    'threshold': result['threshold'],
                    'quality1': result.get('quality1', 1.0),
                    'quality2': result.get('quality2', 1.0)
                }

                logger.info(f"  ✓ Distance: {result['distance']:.4f}, Confidence: {result['confidence']:.2%}")

                if self.use_ensemble:
                    logger.info(f"  📊 Ensemble: {result.get('num_models', 0)} models")

                return match_data

        except Exception as e:
            logger.warning(f"  ⚠️  Error: {str(e)[:100]}")

        return None

    def find_best_match(
        self,
        target_image_path: str,
        profiles: List[Dict[str, Any]],
        image_field: str = "imageUrl",
        min_confidence: float = 0.0,
        return_top_n: int = 1
    ) -> Optional[Dict[str, Any]]:
        """Find the best matching profile(s) with enhanced accuracy."""

        if not self.verify_image(target_image_path):
            logger.error("❌ Target image verification failed")
            return None

        logger.info(f"✓ Target image verified: {target_image_path}")

        if self.use_ensemble:
            logger.info(f"🔬 Using ensemble mode with {len(self.ensemble_models)} models: {self.ensemble_models}")

        if not profiles:
            logger.error("❌ No profiles provided")
            return None

        matches = []

        # Parallel or sequential processing
        if self.use_parallel:
            logger.info(f"⚡ Using parallel processing with {self.max_workers} workers")
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {
                    executor.submit(
                        self.process_single_profile,
                        profile, target_image_path, image_field, i, len(profiles)
                    ): i for i, profile in enumerate(profiles)
                }

                for future in as_completed(futures):
                    result = future.result()
                    if result:
                        matches.append(result)
        else:
            for i, profile in enumerate(profiles):
                result = self.process_single_profile(
                    profile, target_image_path, image_field, i, len(profiles)
                )
                if result:
                    matches.append(result)

        logger.info(f"\n{'='*60}")
        logger.info(f"Processed: {len(matches)}/{len(profiles)} profiles")

        if not matches:
            logger.warning("❌ No valid comparisons completed")
            return None

        # Sort by confidence
        matches.sort(key=lambda x: x['confidence'], reverse=True)

        # Filter by minimum confidence
        if min_confidence > 0:
            matches = [m for m in matches if m['confidence'] >= min_confidence]
            logger.info(f"Matches above {min_confidence:.0%} confidence: {len(matches)}")

        if not matches:
            logger.warning(f"❌ No matches above {min_confidence:.0%} confidence threshold")
            return None

        # Show top matches
        logger.info(f"\n{'='*60}")
        logger.info(f"TOP {min(return_top_n, len(matches))} MATCH(ES)")
        logger.info(f"{'='*60}")

        for idx, match in enumerate(matches[:return_top_n], 1):
            profile = match['profile']
            linkedin_data = profile.get('linkedinData', {})
            logger.info(f"\n#{idx} - {profile.get('name', 'Unknown')}")
            logger.info(f"    Headline: {linkedin_data.get('headline', 'N/A')}")
            logger.info(f"    Confidence: {match['confidence']:.2%}")
            logger.info(f"    Distance: {match['distance']:.4f}")
            logger.info(f"    Quality: {match['quality1']:.2f} / {match['quality2']:.2f}")

        if return_top_n == 1:
            best = matches[0]
            return {
                "matched_profile": best['profile'],
                "confidence": best['confidence'],
                "face_distance": best['distance'],
                "verified": best['verified']
            }
        else:
            return {
                "matches": [
                    {
                        "matched_profile": m['profile'],
                        "confidence": m['confidence'],
                        "face_distance": m['distance'],
                        "verified": m['verified']
                    }
                    for m in matches[:return_top_n]
                ],
                "total_found": len(matches)
            }


def decode_base64_image(base64_string: str, output_path: str) -> bool:
    """
    Decode base64 image string and save to file

    Args:
        base64_string: Base64 encoded image (with or without data URI prefix)
        output_path: Path to save decoded image

    Returns:
        True if successful, False otherwise
    """
    try:
        # Remove data URI prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]

        # Decode base64 to bytes
        image_data = base64.b64decode(base64_string)

        # Open and convert image to RGB (DeepFace requirement)
        image = Image.open(io.BytesIO(image_data))
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Save as JPEG
        image.save(output_path, 'JPEG')
        return True

    except Exception as e:
        logger.error(f"Error decoding base64 image: {str(e)}")
        return False


def main():
    """
    Main function to run face matching from command line

    Expected usage:
        python faceRecognitionService.py <base64_image> <attendees_json_path>

    Output:
        JSON object with match results to stdout
    """
    # Install stdout filter to prevent library outputs from contaminating JSON
    sys.stdout = StdoutFilter()

    if len(sys.argv) != 3:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python faceRecognitionService.py <base64_image> <attendees_json_path>'
        }))
        sys.exit(1)

    base64_image = sys.argv[1]
    attendees_json_path = sys.argv[2]

    # Create temp directory if it doesn't exist
    temp_dir = Path(__file__).parent.parent / 'temp'
    temp_dir.mkdir(exist_ok=True)

    # Decode base64 image to temporary file
    target_image_path = temp_dir / 'target_face.jpg'

    if not decode_base64_image(base64_image, str(target_image_path)):
        print(json.dumps({
            'success': False,
            'error': 'Failed to decode base64 image'
        }))
        sys.exit(1)

    # Load attendees data
    try:
        with open(attendees_json_path, 'r') as f:
            attendees_data = json.load(f)
            attendees = attendees_data.get('attendees', [])
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Failed to load attendees JSON: {str(e)}'
        }))
        sys.exit(1)

    # Initialize advanced service with optimal configuration
    service = FaceRecognitionService(
        model_name='Facenet512',  # Fallback if ensemble disabled
        distance_metric='cosine',
        enforce_detection=False,
        detector_backend='retinaface',
        cache_images=True,
        extract_faces=True,
        align_faces=True,
        expand_face_region=1.2,
        use_ensemble=True,  # Use ensemble for maximum accuracy
        ensemble_models=['Facenet512', 'ArcFace', 'VGG-Face'],
        enhance_images=True,
        face_quality_threshold=0.3,
        use_parallel=True,  # Parallel processing for speed
        max_workers=4
    )

    # Find best match
    match_result = service.find_best_match(
        target_image_path=str(target_image_path),
        profiles=attendees,
        image_field='imageUrl',
        min_confidence=0.2,  # Lower threshold for more candidates
        return_top_n=1
    )

    # Clean up temporary target image
    try:
        target_image_path.unlink()
    except:
        pass

    # Output result as JSON to stdout (stderr used for logging)
    if match_result:
        print(json.dumps({
            'success': True,
            'match': {
                'profile': match_result['matched_profile'],
                'confidence': match_result['confidence'],
                'distance': match_result['face_distance'],
                'verified': match_result['verified']
            }
        }))
    else:
        print(json.dumps({
            'success': False,
            'error': 'No matching face found'
        }))


if __name__ == '__main__':
    main()
