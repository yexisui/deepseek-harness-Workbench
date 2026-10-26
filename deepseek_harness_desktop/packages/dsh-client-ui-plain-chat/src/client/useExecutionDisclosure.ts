import {useEffect,useState,type SyntheticEvent} from 'react'

type Phase='running'|'finished'|'manual'
type Disclosure={key:string;phase:Phase;open:boolean}

/** Reset only on run/phase changes; polling never overrides a user's toggle. */
export function useExecutionDisclosure(key:string,active:boolean,automatic=true){
 const phase:Phase=automatic?(active?'running':'finished'):'manual'
 function initial():Disclosure{
  let open=phase==='running'
  try{
   if(phase==='manual')open=sessionStorage.getItem(key)==='true'
   else{const saved=JSON.parse(sessionStorage.getItem(key+'-phase')||'null');if(saved?.phase===phase&&typeof saved.open==='boolean')open=saved.open}
  }catch{}
  return {key,phase,open}
 }
 const [state,setState]=useState<Disclosure>(initial)
 const current=state.key===key&&state.phase===phase?state:{key,phase,open:phase==='manual'?initial().open:phase==='running'}
 useEffect(()=>{setState(old=>old.key===key&&old.phase===phase?old:{key,phase,open:phase==='manual'?initial().open:phase==='running'})},[key,phase])
 useEffect(()=>{try{sessionStorage.setItem(phase==='manual'?key:key+'-phase',phase==='manual'?String(current.open):JSON.stringify({phase,open:current.open}))}catch{}},[key,phase,current.open])
 function onToggle(event:SyntheticEvent<HTMLDetailsElement>){const open=event.currentTarget.open;setState(old=>old.key===key&&old.phase===phase&&old.open===open?old:{key,phase,open})}
 return {open:current.open,onToggle}
}
