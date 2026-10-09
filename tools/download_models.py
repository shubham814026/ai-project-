"""
tools/download_models.py - Download official MediaPipe Pose Landmarker models (.task) and record SHA-256 manifest.
Ensures zero-network offline execution for the desktop app.
"""
import os
import hashlib
import json
import urllib.request
import time

MODELS = {
    "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    "pose_landmarker_full.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    "pose_landmarker_heavy.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"
}

def hash_file(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def download_and_verify(target_dir="public/models"):
    os.makedirs(target_dir, exist_ok=True)
    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "Google MediaPipe Official Model Repository",
        "models": {}
    }

    for name, url in MODELS.items():
        dest = os.path.join(target_dir, name)
        if not os.path.exists(dest) or os.path.getsize(dest) == 0:
            print(f"Downloading {name} from {url}...")
            urllib.request.urlretrieve(url, dest)
            print(f"Downloaded {name} ({os.path.getsize(dest):,} bytes)")
        else:
            print(f"Model already present: {name} ({os.path.getsize(dest):,} bytes)")
        
        sha = hash_file(dest)
        manifest["models"][name] = {
            "size_bytes": os.path.getsize(dest),
            "sha256": sha,
            "url": url
        }

    manifest_path = os.path.join(target_dir, "MANIFEST.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote model manifest to {manifest_path}")

if __name__ == "__main__":
    download_and_verify()
