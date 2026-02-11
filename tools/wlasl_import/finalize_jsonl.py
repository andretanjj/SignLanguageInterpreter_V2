
import json
import argparse
import gzip
import os
import sys

def convert_jsonl_to_json(input_path, output_path):
    print(f"Converting {input_path} -> {output_path}...")
    
    is_gzip = input_path.endswith('.gz')
    opener = gzip.open if is_gzip else open
    
    try:
        with opener(input_path, 'rt', encoding='utf-8') as fin, \
             open(output_path, 'w', encoding='utf-8') as fout:
            
            fout.write("[\n")
            
            first = True
            count = 0
            
            for line in fin:
                line = line.strip()
                if not line: continue
                
                # Verify it matches basic JSON structure
                # We could json.loads() to be safe, or just pass throughput for speed.
                # Let's validate for safety.
                try:
                    entry = json.loads(line)
                    json_str = json.dumps(entry)
                except:
                    print(f"Skipping invalid line: {line[:50]}...")
                    continue
                
                if not first:
                    fout.write(",\n")
                
                fout.write(json_str)
                first = False
                count += 1
                
                if count % 1000 == 0:
                    print(f"Processed {count}...", end='\r')
            
            fout.write("\n]")
            
        print(f"\nDone! Converted {count} entries.")
        
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert JSONL (stream) to JSON (array).")
    parser.add_argument("input_path", help="Input JSONL file (.jsonl, .jsonl.gz)")
    parser.add_argument("output_path", help="Output JSON file")
    
    args = parser.parse_args()
    
    convert_jsonl_to_json(args.input_path, args.output_path)
