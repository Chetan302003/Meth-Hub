
import re
import os

def parse_cpp(content):
    fields = []
    # Simplified parser for AuraTelemetry struct
    struct_match = re.search(r'struct AuraTelemetry \{(.*?)\};', content, re.DOTALL)
    if not struct_match: return []
    lines = struct_match.group(1).split('\n')
    for line in lines:
        line = line.strip()
        if not line or line.startswith('//') or line.startswith('uint8_t _pad'): continue
        # Handle arrays like uint8_t trailer_attached[MAX_TRAILERS];
        m = re.match(r'(\w+)\s+(\w+)(?:\[(.*?)\])?;', line)
        if m:
            type, name, size = m.groups()
            fields.append({'name': name, 'type': type, 'size': size})
    return fields

def parse_rust(content):
    fields = []
    struct_match = re.search(r'struct AuraTelemetryRaw \{(.*?)\}', content, re.DOTALL)
    if not struct_match: return []
    lines = struct_match.group(1).split('\n')
    for line in lines:
        line = line.strip()
        if not line or line.startswith('//') or line.startswith('_pad'): continue
        # Handle fields like version: u32,
        m = re.match(r'(\w+):\s+([^,]+),', line)
        if m:
            name, type = m.groups()
            fields.append({'name': name, 'type': type})
    return fields

cpp_path = r'C:\aura_hub_plugin\aura_hub_telemetry\aura_hub_telemetry.cpp'
rust_path = r'd:\auravtchub\src-tauri\src\telemetry.rs'

with open(cpp_path, 'r') as f:
    cpp_fields = parse_cpp(f.read())

with open(rust_path, 'r') as f:
    rust_fields = parse_rust(f.read())

print(f"CPP Fields: {len(cpp_fields)}")
print(f"Rust Fields: {len(rust_fields)}")

max_len = max(len(cpp_fields), len(rust_fields))
for i in range(max_len):
    c = cpp_fields[i] if i < len(cpp_fields) else {'name': 'MISSING', 'type': 'N/A'}
    r = rust_fields[i] if i < len(rust_fields) else {'name': 'MISSING', 'type': 'N/A'}
    if c['name'] != r['name']:
        print(f"MISMATCH at index {i}: CPP={c['name']} RUST={r['name']}")
        # break # Don't break, let's see how far it goes
    # else:
    #     print(f"Match: {c['name']}")
print("Done.")
