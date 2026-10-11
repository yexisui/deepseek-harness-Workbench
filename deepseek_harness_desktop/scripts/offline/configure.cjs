'use strict';
// Merge only the installed bundle registrations. Never import personal settings.
const fs = require('node:fs'), path = require('node:path');
const [root, templatePath, mode] = process.argv.slice(2);
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const file = path.join(root, 'dsh-data/profiles/web/package.json');
const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
const current = before ? JSON.parse(before) : {name:'dsh-profile-web',private:true};
current.dependencies ??= {};
Object.assign(current.dependencies, template.dependencies);
current.dsh ??= {}; current.dsh.profile ??= {};
current.dsh.profile.bundles = [...new Set([...(current.dsh.profile.bundles ?? []), ...template.dsh.profile.bundles])];
current.dsh.profile.patchReload ??= 'live';
const changed = !before || JSON.stringify(JSON.parse(before)) !== JSON.stringify(current);
if (mode === 'Check' && changed) throw Error('Offline bundle registration is missing or outdated. Run deployment to repair.');
if (changed && mode !== 'Check') {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  if (before) {
    const backup = path.join(root,'offline-state/backups',new Date().toISOString().replace(/[:.]/g,'-'));
    fs.mkdirSync(backup,{recursive:true}); fs.writeFileSync(path.join(backup,'profile-package.json'),before);
  }
  const temp = file + '.offline-tmp';
  fs.writeFileSync(temp,JSON.stringify(current,null,2)+'\n'); fs.renameSync(temp,file);
}
console.log(changed ? 'Profile bundle registration updated; personal settings retained.' : 'Profile unchanged.');
for (const name of ['cordis.yml','cordis.patch.yml']) {
  const target=path.join(path.dirname(file),name);
  if (!fs.existsSync(target)) {
    if (mode === 'Check') throw Error('Missing profile entry: '+name);
    fs.writeFileSync(target,'[]\n');
  }
}
