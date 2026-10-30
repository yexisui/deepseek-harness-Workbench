'use strict';
// The host's DocumentWorkflows adapter executes this registered package action.
module.exports={execute:async()=>{throw new Error('请更新工作台以启用文档处理适配器；外部依赖由 external-tools 安装。')}};
