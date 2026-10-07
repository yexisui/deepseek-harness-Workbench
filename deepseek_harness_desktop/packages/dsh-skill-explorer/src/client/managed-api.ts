export const prefix='/api/dsh-skill-explorer/manage/'
export async function managedRequest(action:string,body?:unknown){const response=await fetch(prefix+action,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error??'操作失败');return data}
