"""Restore the unchanged MP4 from this package. Uses only Python's standard library."""
from pathlib import Path
import hashlib,json,sys
base=Path(__file__).resolve().parent
m=json.loads((base/'parts-manifest.json').read_text())
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
for part in m['parts']:
 p=base/part['name']
 if not p.is_file() or p.stat().st_size!=part['bytes'] or digest(p)!=part['sha256']:
  sys.exit('Missing or invalid part: '+part['name'])
dest=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else base/m['filename']
if dest.exists():
 if dest.stat().st_size==m['bytes'] and digest(dest)==m['sha256']:
  print('The verified MP4 already exists:',dest);sys.exit(0)
 sys.exit('Refusing to overwrite an existing file: '+str(dest))
h=hashlib.sha256()
with dest.open('xb') as dst:
 for part in m['parts']:
  with (base/part['name']).open('rb') as f:
   for b in iter(lambda:f.read(1024*1024),b''):dst.write(b);h.update(b)
if dest.stat().st_size!=m['bytes'] or h.hexdigest()!=m['sha256']:sys.exit('Restoration checksum failed.')
print('Restored and SHA-256 verified:',dest)
print('Bytes:',dest.stat().st_size)
