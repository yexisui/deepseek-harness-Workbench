export const SKILL_ARCHIVE_ACCEPT='.zip,.rar,.7z,.tar,.gz,.tgz,.bz2,.tbz2,.xz,.txz,.z'
export const isSkillArchive=(name:string)=>/\.(zip|rar|7z|tar|gz|tgz|bz2|tbz2|xz|txz|z)$/i.test(name)
