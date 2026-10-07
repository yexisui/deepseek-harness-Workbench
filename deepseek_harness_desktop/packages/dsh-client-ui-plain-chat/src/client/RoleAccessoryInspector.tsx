import React, { type ReactNode } from 'react'
import { EnableSwitch } from '../../../../shared/client/EnableSwitch.tsx'
import s from './ManagedCapabilities.module.css'

/** Shared role-local controls; changes follow the editor's draft/publish lifecycle. */
export function RoleAccessoryInspector({name,description,enabled,onEnabled,version,note,source,children}:{
  name:string;description?:string;enabled?:boolean;onEnabled?:(value:boolean)=>void;
  version?:ReactNode;note?:string;source?:string;children?:ReactNode;
}) {
  return <><h3>{name}</h3>{description&&<p>{description}</p>}
    {enabled!==undefined&&onEnabled?<label className={s.check}>在此岗位中启用 <EnableSwitch label={'在此岗位中启用 '+name} checked={enabled} onChange={onEnabled}/></label>:<p>添加到岗位后，可设置是否启用。</p>}
    {version}{note&&<p className={s.muted}>{note}</p>}{source&&<p className={s.muted}>来源：{source}</p>}{children}
  </>
}
