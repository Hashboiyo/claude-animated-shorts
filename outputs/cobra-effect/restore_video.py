"""Restore the unchanged MP4 using Python's standard library."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
m=json.loads((root/'parts-manifest.json').read_text());out=root/m['filename']
if out.exists():raise SystemExit(f'Refusing to overwrite {out}')
for p in m['parts']:
 f=root/p['name']
 if not f.exists() or f.stat().st_size!=p['size'] or hashlib.sha256(f.read_bytes()).hexdigest()!=p['sha256']:raise SystemExit(f'Missing or corrupt part: {f.name}')
h=hashlib.sha256()
with out.open('xb') as dst:
 for p in m['parts']:
  with (root/p['name']).open('rb') as src:
   while data:=src.read(1024*1024):dst.write(data);h.update(data)
if out.stat().st_size!=m['size'] or h.hexdigest()!=m['sha256']:raise SystemExit('Final verification failed')
print(f'Verified MP4: {out}\nBytes: {out.stat().st_size}\nSHA-256: {h.hexdigest()}')
