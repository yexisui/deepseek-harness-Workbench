"""Integration verification against the actual offline payload, in an isolated directory."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();logs=root.parent/'verification';logs.mkdir(exist_ok=True)
env=os.environ.copy();env.pop('PSModulePath',None)
env.update({'HTTP_PROXY':'http://127.0.0.1:1','HTTPS_PROXY':'http://127.0.0.1:1','ALL_PROXY':'http://127.0.0.1:1','NO_PROXY':'localhost,127.0.0.1'})
def run(name,*args,ok=True):
    with (logs/(name+'.log')).open('w',encoding='utf-8') as f:
        result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'deploy.ps1'),*args],env=env,cwd=root,stdout=f,stderr=subprocess.STDOUT)
    if (result.returncode==0)!=ok:raise RuntimeError(name+' unexpected exit '+str(result.returncode)+'; see '+str(logs))
    print(name,'PASS',flush=True)
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
run('first-install')
first=json.loads((root/'offline-state/last-install.json').read_text('utf-8-sig'))
assert first['repaired']>0
sentinel=root/'dsh-data/offline-verification-sentinel.txt';sentinel.write_text('preserve-business-data',encoding='utf-8')
profile=root/'dsh-data/profiles/web/package.json'
data=json.loads(profile.read_text('utf-8'));data['offlineVerification']={'preserve':True};profile.write_text(json.dumps(data),encoding='utf-8')
original=digest(profile)
run('repeat-install')
repeat=json.loads((root/'offline-state/last-install.json').read_text('utf-8-sig'))
assert repeat['repaired']==0 and digest(profile)==original
run('check-clean','-Mode','Check')
victims=[root/'runtime-node/node.exe',root/'dsh-data/profiles/web/node_modules/@linxin666/dsh-client-ui-plain-chat/lib/client.js']
hashes=[digest(f) for f in victims]
victims[0].unlink();victims[1].write_text('intentionally corrupted test file',encoding='utf-8')
run('check-damaged','-Mode','Check',ok=False)
assert not victims[0].exists() and victims[1].read_text()=='intentionally corrupted test file'
run('repair','-Repair')
repair=json.loads((root/'offline-state/last-install.json').read_text('utf-8-sig'))
assert repair['repaired']==2 and [digest(f) for f in victims]==hashes
assert digest(profile)==original and sentinel.read_text()=='preserve-business-data'
# Payload corruption must be rejected before modifying installed files.
manifest=root/'offline/manifest.json';saved=manifest.read_bytes();m=json.loads(saved);m['payloadSha256']='0'*64
try:
    manifest.write_text(json.dumps(m),encoding='utf-8');run('reject-corrupt-package',ok=False)
finally:manifest.write_bytes(saved)
assert digest(profile)==original
data.pop('offlineVerification');profile.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8');sentinel.unlink()
result={'first':first,'repeat':repeat,'repair':repair,'checkIsReadOnly':True,'businessDataPreserved':True,'corruptPackageRejected':True,'proxy':'unreachable loopback proxy; installer has no download commands'}
(logs/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result),flush=True)
