// 在常在线主机由 systemd timer 调用；凭据来自 root 管理的 EnvironmentFile。
const token=process.env.LOVEVERSE_SCHEDULER_TOKEN;
if(!token || !/^[a-f0-9]{64,128}$/.test(token)) throw Error('未配置有效任务凭据');
const url=new URL(process.env.LOVEVERSE_SCHEDULER_URL || 'http://127.0.0.1:3000/api/internal/reminders');
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password||url.pathname!=='/api/internal/reminders') throw Error('任务仅连接本机回环服务');
try {
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!r.ok) throw Error('任务执行失败，状态 '+r.status);
  console.log('纪念日任务处理完成');
} catch { console.error('纪念日任务失败，请检查本地服务和任务配置'); process.exitCode=1; }
