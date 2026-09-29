declare module 'semver' {
 export function valid(version:unknown):string|null
 export function satisfies(version:string,range:string,options?:{includePrerelease?:boolean}):boolean
}
