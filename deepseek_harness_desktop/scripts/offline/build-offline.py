"""Build a Windows offline release from a tested CLEAN deployment, never a personal home.
Usage: python build-offline.py --donor CLEAN_ROOT --source REPO --output OUTPUT_DIR
Only allowlisted program trees are copied. This script does not download anything.
"""
import argparse, hashlib, json, os, shutil, zipfile
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--donor',required=True);p.add_argument('--source',required=True);p.add_argument('--output',required=True)
a=p.parse_args();donor=Path(a.donor).resolve();source=Path(a.source).resolve();out=Path(a.output).resolve()
out.mkdir(parents=True,exist_ok=True)
if any(out.iterdir()): raise SystemExit('Output must be empty; refusing to overwrite a release')
offline=out/'offline';offline.mkdir()
release='2026.10.12-r3-win-x64'
files=[]; seen=set()
def digest(f):
    h=hashlib.sha256()
    with open(f,'rb') as stream:
        for b in iter(lambda:stream.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def walk(src,rel):
    if rel == 'dsh-data/profiles/web/node_modules/@wxg-prc-cpg/browser-skill-dsh-plugin':return
    # Materialize dependency links, but reject links outside the clean donor.
    resolved=src.resolve()
    if not (resolved.is_relative_to(donor) or resolved.is_relative_to(source)):raise RuntimeError('External link: '+str(src))
    if src.is_dir():
        for child in sorted(src.iterdir()):
            if child.name in {'.cache','.pnpm','.modules.yaml','.package-lock.json','.pnpm-workspace-state-v1.json'}:continue
            yield from walk(child,rel+'/'+child.name)
    else:yield src,rel
trees=[
    (donor/'runtime-node','runtime-node'),
    (donor/'runtime/node_modules','runtime/node_modules'),
    (donor/'runtime-desktop/node_modules','runtime-desktop/node_modules'),
    (donor/'dsh-data/profiles/web/node_modules','dsh-data/profiles/web/node_modules'),
    (donor/'external-tools/ffmpeg/releases','external-tools/ffmpeg/releases'),
    (donor/'external-tools/ffmpeg/current.json','external-tools/ffmpeg/current.json'),
    (source/'deepseek_harness_desktop/desktop/src','deepseek_harness_desktop/desktop/src'),
    (source/'deepseek_harness_desktop/desktop/package.json','deepseek_harness_desktop/desktop/package.json'),
    (source/'start-desktop.ps1','start-desktop.ps1'),
]
# Legacy portable BrowserSkill is already maintained separately from the npm plugin.
bsk=donor/'runtime/browserskill/0.3.0'
if not bsk.exists():bsk=source/'runtime/browserskill/0.3.0'
if not (bsk/'cli/bsk.exe').exists():raise RuntimeError('Portable BrowserSkill 0.3.0 CLI/extension must be prepared before offline packaging')
resources=source/'deepseek_harness_desktop/desktop/resources'
if resources.exists():trees.append((resources,'deepseek_harness_desktop/desktop/resources'))
for name in ['LICENSE','NOTICE']:
    f=source/'deepseek_harness_desktop'/name
    if f.exists():trees.append((f,'deepseek_harness_desktop/'+name))
for name in ['package.json']:
    trees.append((donor/'runtime'/name,'runtime/'+name))
for name in ['tools.json','README.txt']:
    trees.append((source/'external-tools'/name,'external-tools/'+name))
archive=offline/'payload.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
    for src,rel in trees:
        for f,name in walk(src,rel):
            if name in seen:raise RuntimeError('Duplicate '+name)
            seen.add(name)
            if f.name in {'.credentials.yaml','settings.yaml','.env','ai_key.txt'}:raise RuntimeError('Unexpected private file '+name)
            z.write(f,name)
            files.append({'path':name,'size':f.stat().st_size,'sha256':digest(f)})
            if len(files)%5000==0:print('Packed',len(files),'files',flush=True)
profile=json.loads((donor/'dsh-data/profiles/web/package.json').read_text('utf-8-sig'))
for name in profile['dependencies']:
    installed=donor/'dsh-data/profiles/web/node_modules'/name/'package.json'
    profile['dependencies'][name]=json.loads(installed.read_text('utf-8-sig'))['version']
(offline/'profile-template.json').write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['install.ps1','configure.cjs']:shutil.copy2(Path(__file__).parent/name,offline/name)
addons=offline/'capability-packages';addons.mkdir()
with zipfile.ZipFile(addons/'BrowserSkill-0.3.0-offline.zip','w',zipfile.ZIP_DEFLATED) as pluginzip:
    for base,rel in [(bsk,'runtime/browserskill/0.3.0'),(donor/'dsh-data/profiles/web/node_modules/@wxg-prc-cpg/browser-skill-dsh-plugin','dsh-data/profiles/web/node_modules/@wxg-prc-cpg/browser-skill-dsh-plugin')]:
        for f in base.rglob('*'):
            if f.is_file():pluginzip.write(f,rel+'/'+f.relative_to(base).as_posix())
    pluginzip.writestr('BrowserSkill-install.txt','Extract into the installed workbench root after closing it. Then load runtime/browserskill/0.3.0/extension as an unpacked Chrome/Edge extension. Restart desktop. No npm install is needed. This is an optional browser plugin, not a capability-import ZIP.')
for capability in sorted((source/'capability-packages').iterdir()):
    if capability.is_dir():
        for f in (capability/'dist').glob('*.zip'):shutil.copy2(f,addons/f.name)
manifest={'schema':1,'release':release,'payloadSha256':digest(archive),'unpackedBytes':sum(f['size'] for f in files),'files':files}
(offline/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
for name in ['deploy.ps1','一键部署.cmd','启动桌面端.cmd']:shutil.copy2(source/name,out/name)
readme='''Windows x64 离线安装包

首次或已有安装：拉取最新Git，将安装ZIP原样放入项目根目录offline-delivery，关闭客户端后双击“一键部署.cmd”。
脚本自动准备offline文件并安装/修复；不需要手工解压，也不要覆盖Git里的启动及部署脚本。
不要删除原来的 dsh-data、chat-data、desktop-state。

默认安装会校验所有受管理的程序文件，只修复缺失或内容不同的文件；完整文件直接复用。
修复：一键部署.cmd -Repair
只检查：一键部署.cmd -Mode Check
上述命令在Git项目根目录的终端执行；检查不安装，修复和默认安装均不下载。
新版本替换程序文件时保留个人设置；必要的插件注册配置修改前保存到 offline-state/backups。
本包只修复包含的程序及依赖，不安装系统级 C++ 运行库或修改系统设置。

包内不包含 API Key、聊天记录或原电脑的个人设置。第一次使用请配置模型。
离线安装不代表在线模型/搜索能离线工作；内网应配置可访问的服务。
浏览器插件不自动安装。可选包为offline/capability-packages/BrowserSkill-0.3.0-offline.zip。
需要时关闭工作台，将该ZIP解压到工作台根目录；再在Chrome/Edge扩展管理中启用开发者模式，加载runtime/browserskill/0.3.0/extension。它不是能力导入ZIP。
额外的流程图、音频片段定位能力ZIP位于offline/capability-packages，可在能力管理中本地导入。
安装ZIP内只提供offline目录，不附带根部署或启动入口。请保留offline-delivery中的原始ZIP，以便修复提取文件。开发工具、测试环境、下载缓存、Git 历史均不包含。
'''
(offline/'使用说明.txt').write_text(readme,encoding='utf-8-sig')
print(json.dumps({'release':release,'files':len(files),'payloadBytes':archive.stat().st_size,'unpackedBytes':manifest['unpackedBytes']},ensure_ascii=False),flush=True)
delivery_dir=source/'offline-delivery'
delivery_dir.mkdir(parents=True,exist_ok=True)
delivery=delivery_dir/('DeepSeek-Workbench-Offline-'+release+'.zip')
if delivery.exists():raise SystemExit('Release already exists; increment release before publishing a changed package')
with zipfile.ZipFile(delivery,'w',allowZip64=True) as z:
    # The delivery ZIP is data for the Git deployment entry, never a second launcher set.
    for f in sorted(offline.rglob('*')):
        if f.is_file():z.write(f,'offline/'+f.relative_to(offline).as_posix(),compress_type=zipfile.ZIP_STORED if f.suffix=='.zip' else zipfile.ZIP_DEFLATED)
delivery.with_suffix('.zip.sha256').write_text(digest(delivery)+'  '+delivery.name+'\n',encoding='ascii')
print('Delivery:',delivery,flush=True)
