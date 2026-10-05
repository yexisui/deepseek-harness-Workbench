export interface OfflinePreview {
 id:string;name:string;version:string;hash:string;fileCount:number;totalBytes:number
 entries:Array<{id:string;name:string}>;shared:Array<{name:string;version:string}>;bundled:string[]
 scriptsSkipped:string[];platform:string;currentVersion?:string;currentHash?:string
 disposition:'new'|'identical'|'upgrade'|'replace';requiresRestart:true
}
