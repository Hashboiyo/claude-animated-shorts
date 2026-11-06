import sys
from pathlib import Path
s=Path(sys.argv[1]).read_text()
issues=[l for l in s.splitlines() if 'black_start:' in l or 'freeze_start:' in l]
if issues: raise SystemExit('Visual QA requires review: '+ '\n'.join(issues))
print('PASS: no black spans >=0.1s or frozen spans >=0.4s detected')
