"""
tools/dataset/verify_assets_integrity.py - Post-inspection integrity check.
Verifies that assets/ has not been modified, renamed, moved, or deleted.
"""
import os
import sys
import json
import hashlib
import time

def hash_file(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def verify_integrity(pre_manifest_path='reports/assets_checksums_pre.json', post_manifest_path='reports/assets_checksums_post.json'):
    print("Computing post-inspection checksums...")
    t0 = time.time()
    
    with open(pre_manifest_path, 'r', encoding='utf-8') as f:
        pre_manifest = json.load(f)

    post_manifest = {}
    mismatches = []
    missing_files = []

    for rel_path, meta in pre_manifest.items():
        full_path = os.path.join('assets', rel_path)
        if not os.path.exists(full_path):
            missing_files.append(rel_path)
            continue
        
        curr_size = os.path.getsize(full_path)
        if curr_size != meta['size']:
            mismatches.append((rel_path, f"Size changed: {meta['size']} -> {curr_size}"))
            continue
            
        curr_sha = hash_file(full_path)
        post_manifest[rel_path] = {'size': curr_size, 'sha256': curr_sha}
        if curr_sha != meta['sha256']:
            mismatches.append((rel_path, "SHA-256 hash mismatch"))

    with open(post_manifest_path, 'w', encoding='utf-8') as f:
        json.dump(post_manifest, f, indent=2)

    print(f"Post-verification completed in {time.time() - t0:.2f}s")
    if not mismatches and not missing_files:
        print(f"[INTEGRITY PASS] All {len(pre_manifest)} assets files are byte-for-byte identical. 0 modifications.")
        return True
    else:
        print(f"[INTEGRITY FAIL] Missing: {len(missing_files)}, Mismatches: {len(mismatches)}")
        return False

if __name__ == '__main__':
    ok = verify_integrity()
    sys.exit(0 if ok else 1)
