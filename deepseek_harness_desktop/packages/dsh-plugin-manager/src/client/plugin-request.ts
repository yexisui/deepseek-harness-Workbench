export class PluginRequestError extends Error {
 constructor(message:string,readonly remedy:'restart'|'reconnect'|'retry'='retry'){super(message)}
}
export async function pluginResponse(response:Response):Promise<any>{
 if(response.status===404)throw new PluginRequestError('插件服务接口尚未加载，请保存工作后完全退出并重新打开工作台。','restart')
 if(response.status===401)throw new PluginRequestError('工作台连接已失效，请从工作台入口重新连接。','reconnect')
 if(response.status===403)throw new PluginRequestError('当前连接无权执行此操作，请从本机工作台入口访问。','reconnect')
 let data:any
 try{data=await response.json()}catch{throw new PluginRequestError('插件服务返回了无法识别的响应，请重试；若持续出现，请重新启动工作台。')}
 if(!response.ok)throw new PluginRequestError(typeof data?.error==='string'?data.error:typeof data?.message==='string'?data.message:'插件操作失败，请重试。')
 if(!data||typeof data!=='object'||Array.isArray(data))throw new PluginRequestError('插件服务响应格式不正确，请重试。')
 return data
}
