"""
compute_checksums.py - Strict read-only SHA-256 checksum manifest generator for assets/
"""
import os
import sys
import hashlib
import json
import time

def hash_file(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def generate_checksum_manifest(target_dir='assets', output_file='reports/assets_checksums_pre.json'):
    print(f"Starting checksum manifest generation for {target_dir}...")
    start_time = time.time()
    manifest = {}
    
    # Check top-level JSON files first
    for root, _, files in os.walk(target_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, target_dir).replace('\\', '/')
            size = os.path.getsize(full_path)
            # Hash every file
            sha256 = hash_file(full_path)
            manifest[rel_path] = {
                'size': size,
                'sha256': sha256
            }
            if len(manifest) % 1000 == 0:
                print(f"Hashed {len(manifest)} files...")

    elapsed = time.time() - start_time
    print(f"Completed {len(manifest)} files in {elapsed:.2f}s")
    
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as out:
        json.dump(manifest, out, indent=2)
    print(f"Manifest written to {output_file}")
    return manifest

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'reports/assets_checksums_pre.json'
    generate_checksum_manifest('assets', out)
