
import json
import argparse
import gzip
import os

def validate_dataset(dataset_path):
    print(f"Validating {dataset_path}...")
    
    if not os.path.exists(dataset_path):
        print("File not found.")
        return False
        
    errors = 0
    correct_dim = 96
    label_counts = {}
    count = 0
    
    # Helper to validate one entry
    def validate_entry(entry, idx):
        local_errors = 0
        required_keys = ["label", "type", "features", "createdAt", "id"]
        missing = [k for k in required_keys if k not in entry]
        if missing:
            print(f"Entry {idx} missing keys: {missing}")
            return 1
            
        features = entry["features"]
        if not isinstance(features, list) or len(features) == 0:
            print(f"Entry {idx} has empty features.")
            return 1
            
        # Check first and random sample dimensions
        for j, vec in enumerate(features):
            if len(vec) != correct_dim:
                print(f"Entry {idx} Frame {j} invalid dim: {len(vec)}")
                return 1
                
        lbl = entry["label"]
        label_counts[lbl] = label_counts.get(lbl, 0) + 1
        return 0

    # Determine format
    is_gzip = dataset_path.endswith('.gz')
    is_jsonl = dataset_path.endswith('.jsonl') or dataset_path.endswith('.jsonl.gz')
    
    # If not explicitly named jsonl, check simple Read
    # If it's a JSON array, we strictly expect [ ... ]
    # But for large files, we might want to iterate.
    
    try:
        if is_jsonl:
            opener = gzip.open if is_gzip else open
            with opener(dataset_path, 'rt', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line: continue
                    try:
                        entry = json.loads(line)
                        errors += validate_entry(entry, count)
                        count += 1
                        if count % 1000 == 0:
                            print(f"Validated {count}...", end='\r')
                    except json.JSONDecodeError:
                        print(f"Line {count}: Invalid JSON")
                        errors += 1
        else:
            # Standard JSON Array
            with open(dataset_path, 'r') as f:
                data = json.load(f)
                if not isinstance(data, list):
                    print("Root must be a list")
                    return False
                for entry in data:
                    errors += validate_entry(entry, count)
                    count += 1
                    
    except Exception as e:
        print(f"\nFatal error reading file: {e}")
        return False

    print(f"\n\nValidation Complete.")
    print(f"Total Entries: {count}")
    print(f"Errors Found: {errors}")
    
    if errors == 0:
        print("PASS")
        print(f"Unique Labels: {len(label_counts)}")
    else:
        print("FAIL")
        
    return errors == 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_path", help="Path to dataset file (.json, .jsonl, .jsonl.gz)")
    args = parser.parse_args()
    
    validate_dataset(args.dataset_path)
