'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {exportSettings, applySettings, mergeCapabilities, allowed} = require('./settings-sync.cjs');
const yamlPath = process.env.SETTINGS_TEST_YAML;
function copy(from, to) {
  fs.mkdirSync(to,{recursive:true});
  for (const entry of fs.readdirSync(from,{withFileTypes:true})) {
    if(entry.isDirectory()) copy(path.join(from,entry.name),path.join(to,entry.name));
    else fs.copyFileSync(path.join(from,entry.name),path.join(to,entry.name));
  }
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-sync-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith('settings-sync-'));
    fs.rmSync(root, {recursive:true, force:true});
  });
  copy(fs.realpathSync(yamlPath), path.join(root,'runtime/node_modules/yaml'));
  return root;
}
function write(root, name, value) {
  const file = path.join(root, name); fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
}
test('exports settings without credentials, conversations, histories, installers or machine paths', t => {
  const root = fixture(t);
  write(root, 'dsh-data/settings.yaml', 'pet:\n  size: 160\nprovider:\n  apiKey: sk-test-secret-value-that-must-never-export\n  apiKeyEnv: DEEPSEEK_API_KEY\n');
  write(root, 'dsh-data/.credentials.yaml', 'secret: sk-test-secret-value-that-must-never-export\n');
  write(root, 'dsh-data/capabilities/state.json', {schema:1, roles:[], capabilities:[], stoppedSessions:['private-session']});
  write(root, 'dsh-data/skill-management/state.json', {skills:[{id:'one', root:path.join(root,'dsh-data/skills'),usageHistory:[{private:true}]}]});
  write(root, 'dsh-data/sessions/private.json', {message:'private conversation'});
  write(root, 'dsh-data/skins/test/.cache/token.json', {secret:'ignored'});
  write(root, 'dsh-data/skins/test/skin.json', {id:'test'});
  write(root, 'offline/payload.zip', 'installer');
  assert.equal(exportSettings(root).exported,4);
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'shared-settings/manifest.json')));
  const all = manifest.files.map(e => fs.readFileSync(path.join(root,'shared-settings/files',e.path),'utf8')).join('\n');
  assert(!all.includes('sk-test-secret')); assert(!all.includes('private-session'));
  assert(!all.includes('usageHistory')); assert(!all.includes(root)); assert(all.includes('DEEPSEEK_API_KEY'));
  assert(all.includes('{{WORKBENCH_ROOT}}'));
});
test('import merges local secrets, preserves sessions and is idempotent after local edits', t => {
  const source = fixture(t), target = fixture(t);
  write(source,'dsh-data/settings.yaml','pet:\n  size: 160\nprovider:\n  apiKeyEnv: EXAMPLE_API_KEY\n');
  write(source,'dsh-data/profiles/web/cordis.patch.yml', [{id:'browser', config:{bskHome:path.join(source,'dsh-data/browser-runtime')}}]);
  exportSettings(source);
  copy(path.join(source,'shared-settings'), path.join(target,'shared-settings'));
  write(target,'dsh-data/settings.yaml','pet:\n  size: 90\nprovider:\n  apiKey: local-credential-preserve\n');
  write(target,'dsh-data/.credentials.yaml','secret: local-secret-preserve\n');
  write(target,'dsh-data/sessions/private.json','private-conversation');
  assert.equal(applySettings(target).applied,2);
  const yaml = require(path.join(target,'runtime/node_modules/yaml'));
  const config = yaml.parse(fs.readFileSync(path.join(target,'dsh-data/settings.yaml'),'utf8'));
  assert.equal(config.provider.apiKey,'local-credential-preserve'); assert.equal(config.pet.size,160);
  const patch = yaml.parse(fs.readFileSync(path.join(target,'dsh-data/profiles/web/cordis.patch.yml'),'utf8'));
  assert.equal(patch[0].config.bskHome,path.join(target,'dsh-data/browser-runtime'));
  write(target,'dsh-data/settings.yaml','pet: {size: 222}\n');
  assert.equal(applySettings(target).applied,0);
  assert.equal(fs.readFileSync(path.join(target,'dsh-data/settings.yaml'),'utf8'),'pet: {size: 222}\n');
  assert.equal(fs.readFileSync(path.join(target,'dsh-data/.credentials.yaml'),'utf8'),'secret: local-secret-preserve\n');
  assert.equal(fs.readFileSync(path.join(target,'dsh-data/sessions/private.json'),'utf8'),'private-conversation');
});
test('import remaps conflicting role/capability versions and retains existing task references', () => {
  const cap = text => ({id:'cap', draft:{instructions:text}, versions:[{version:1,instructions:text}]});
  const role = text => ({id:'role',draft:{duties:text,capabilities:[{capabilityId:'cap',version:1}]},versions:[{version:1,preset:'workbench-role-role-v1',duties:text,capabilities:[{capabilityId:'cap',version:1}]}]});
  const local = {schema:1,revision:1,capabilities:[cap('old')],roles:[role('old')],stoppedSessions:['local-session']};
  const incoming = {schema:1,revision:1,capabilities:[cap('new')],roles:[role('new')]};
  const {state, presets} = mergeCapabilities(local,incoming);
  assert.equal(state.capabilities[0].versions[0].instructions,'old');
  assert.equal(state.roles[0].versions[0].duties,'old');
  assert.equal(state.roles[0].versions.at(-1).capabilities[0].version,2);
  assert.equal(presets.get('workbench-role-role-v1'),'workbench-role-role-v2');
  assert.deepEqual(state.stoppedSessions,['local-session']);
});
test('checksum mismatch and path traversal fail before any settings mutation', t => {
  const root = fixture(t); write(root,'dsh-data/settings.yaml','pet: {size: 160}\n'); exportSettings(root);
  write(root,'shared-settings/files/settings.yaml','pet: {size: 555}\n');
  assert.throws(() => applySettings(root), /checksum mismatch/);
  assert.equal(fs.readFileSync(path.join(root,'dsh-data/settings.yaml'),'utf8'),'pet: {size: 160}\n');
  assert(!allowed('../.credentials.yaml')); assert(!allowed('sessions/private.json')); assert(!allowed('skins/../../keys.json'));
  assert(allowed('capabilities/file-search/settings.json'));
  assert(!allowed('capabilities/file-search/11111111-1111-1111-1111-111111111111.json'));
  assert(!allowed('capabilities/file-search/engine/Everything.db'));
});
test('secret embedded in freeform text stops export without publishing a manifest', t => {
  const root = fixture(t), secret='sk-test-secret-value-that-must-never-export';
  write(root,'dsh-data/.credentials.yaml','secret: '+secret);
  write(root,'dsh-data/skills/one/SKILL.md','some text '+secret);
  assert.throws(() => exportSettings(root),/Possible credential/);
  assert(!fs.existsSync(path.join(root,'shared-settings/manifest.json')));
});
