"""Bundle only the finished, verified artwork and game atlases."""
from pathlib import Path
import json, zipfile

root=Path(__file__).resolve().parents[1]
source=root/'art-src/world-v8'
report=json.loads((source/'packing-report.json').read_text(encoding='utf-8'))
validation=json.loads((source/'validation.json').read_text(encoding='utf-8'))
assert report['ready']==122 and not report['failed'] and not report['missing']
assert validation['authoredCharacterPoses']==1632 and validation['entrances']==20
target=source/'world-monsters-112-pack.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for folder in (source,root/'art-src/monsters-v9',root/'public/assets/world-v8',root/'public/assets/monsters-v9'):
        for path in sorted(folder.rglob('*')):
            if not path.is_file() or path.suffix=='.zip' or 'packed' in path.relative_to(folder).parts:
                continue
            archive.write(path,path.relative_to(root).as_posix())
print(f'{target}: {target.stat().st_size/1024/1024:.1f} MiB')
runtime=source/'world-monsters-112-runtime.zip'
with zipfile.ZipFile(runtime,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for folder in (root/'public/assets/world-v8',root/'public/assets/monsters-v9'):
        for path in sorted(folder.rglob('*')):
            if path.is_file():archive.write(path,path.relative_to(root).as_posix())
print(f'{runtime}: {runtime.stat().st_size/1024/1024:.1f} MiB')
