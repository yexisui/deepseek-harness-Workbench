declare module 'dsh-office-toolkit' { export function apply(ctx: {tools:{register:(tool:any)=>()=>void};get:(name?:string)=>unknown;effect:(run:()=>unknown)=>unknown}):void }
