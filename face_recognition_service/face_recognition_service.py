from deepface import DeepFace
from pathlib import Path
from PIL import Image
import json
from typing import Optional, Dict, List, Any

class FaceRecognitionService:
    
    def __init__(self, model_name: str = "VGG-Face", distance_metric: str = "cosine"):
        self.model_name = model_name
        self.distance_metric = distance_metric
    
    def verify_image(self, image_path: str) -> bool:
        try:
            # Check if file exists
            if not Path(image_path).exists():
                print(f"Image file not found: {image_path}")
                return False
            
            try:
                with Image.open(image_path) as img:
                    if img.mode != 'RGB':
                        rgb_path = Path(image_path).with_suffix('.jpg')
                        img.convert('RGB').save(rgb_path, 'JPEG')       
                        return True
            except Exception as e:
                print(f"Failed to open image: {e}")
                return False
            
            return True
        except Exception as e:
            print(f"Image verification failed: {e}")
            return False
    
    def load_linkedin_profiles(self, json_file_path: str) -> List[Dict[str, Any]]:
        """Load LinkedIn profile data from JSON file."""
        try:
            with open(json_file_path, 'r') as f:
                profiles = json.load(f)
            
            # Standardize the profile format
            standardized_profiles = []
            for profile in profiles:
                standardized = {
                    "name": profile.get("fullName", "Unknown"),
                    "profileUrl": f"https://linkedin.com/in/{profile.get('public_identifier', '')}",
                    "imageUrl": profile.get("profile_photo", ""),
                    "linkedin_id": profile.get("linkedin_internal_id", ""),
                    "headline": profile.get("headline", ""),
                    "location": profile.get("location", ""),
                    "connections": profile.get("connections", ""),
                    "about": profile.get("about", ""),
                    "experience": profile.get("experience", []),
                    "education": profile.get("education", []),
                    "raw_profile": profile
                }
                standardized_profiles.append(standardized)
            
            return standardized_profiles
        except Exception as e:
            print(f"Error loading LinkedIn profiles from {json_file_path}: {e}")
            return []
    
    def find_best_match(
        self,
        target_image_path: str,
        profiles_json_path: str,
        image_field: str = "imageUrl"
    ) -> Optional[Dict[str, Any]]:
        
        # Verify target image
        if not self.verify_image(target_image_path):
            return None
        
        # Load LinkedIn profiles
        profiles = self.load_linkedin_profiles(profiles_json_path)
        if not profiles:
            print("No profiles loaded")
            return None
        
        best_match = None
        best_distance = float('inf')
        processed_count = 0
        
        for i, profile in enumerate(profiles):
            if image_field not in profile or not profile[image_field]:
                continue
            
            image_url = profile[image_field]
            print(f"Processing {i+1}/{len(profiles)}: {profile.get('name', 'Unknown')}")
            
            try:
                # Use DeepFace to verify faces
                result = DeepFace.verify(
                    img1_path=target_image_path,
                    img2_path=image_url,
                    model_name=self.model_name,
                    distance_metric=self.distance_metric,
                    enforce_detection=False  # Don't enforce detection to allow more matches
                )
                
                distance = result['distance']
                
                print(f"  Distance: {distance:.4f}")
                
                # Always update if this is the closest match so far
                if distance < best_distance:
                    best_distance = distance
                    best_match = profile.copy()
                
                processed_count += 1
                    
            except Exception as e:
                print(f"  ⚠️  Error processing profile: {str(e)[:100]}")
                continue
        
        if best_match:
            # Calculate confidence (inverse of distance)
            confidence = 1 - min(best_distance, 1.0)
            
            print(f"\n✓ Best match found!")
            print(f"  Name: {best_match.get('name', 'Unknown')}")
            print(f"  Headline: {best_match.get('headline', 'N/A')}")
            print(f"  Confidence: {confidence:.2%}")
            
            
            return {
                "matched_profile": best_match,
                "confidence": confidence,
                "face_distance": best_distance
            }
        else:
            print(f"\n✗ No profiles could be processed (processed {processed_count}/{len(profiles)})")
            return None
    
    def find_all_matches(
        self,
        target_image_path: str,
        profiles_json_path: str,
        image_field: str = "imageUrl",
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """Find all matching LinkedIn profiles ranked by similarity."""
        if not self.verify_image(target_image_path):
            return []
        
        profiles = self.load_linkedin_profiles(profiles_json_path)
        if not profiles:
            return []
        
        matches = []
        
        for profile in profiles:
            if image_field not in profile or not profile[image_field]:
                continue
            
            try:
                result = DeepFace.verify(
                    img1_path=target_image_path,
                    img2_path=profile[image_field],
                    model_name=self.model_name,
                    distance_metric=self.distance_metric,
                    enforce_detection=True
                )
                
                distance = result['distance']
                confidence = 1 - min(distance, 1.0)
                
                matches.append({
                    "matched_profile": profile.copy(),
                    "confidence": confidence,
                    "face_distance": distance
                })
                
            except Exception as e:
                continue
        
        # Sort by confidence (highest first)
        matches.sort(key=lambda x: x["confidence"], reverse=True)
        
        return matches[:max_results]


# Example usage
if __name__ == "__main__":
    service = FaceRecognitionService(model_name="VGG-Face", distance_metric="cosine")

    results = service.find_all_matches(
        target_image_path="./face_recognition_service/test_img2.jpg",
        profiles_json_path="./sample_output.json",
        image_field="imageUrl"
    )

    if results:
        for result in results:
            profile = result['matched_profile']
            print(f"\nMatch found: {profile['name']}")
            print(f"Headline: {profile.get('headline', 'N/A')}")
            print(f"Confidence: {result['confidence']:.2%}")
    else:
        print("\nNo match found")
