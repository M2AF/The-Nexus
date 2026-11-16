(()=>{
 'use strict';const $=id=>document.getElementById(id),api=window.nexus;
 if(!api?.updateState)return;
 const topButton=$('update-button'),topLabel=$('update-button-label'),status=$('update-status'),progress=$('update-progress'),install=$('update-install'),check=$('update-check');
 let current=null,busy=false;
 function render(state){
  current=state;const s=state.status,version=state.version?'v'+state.version:'';
  // Toolbar: only visible when there is something for the user to do or watch.
  topButton.hidden=!['available','downloading','ready','restarting'].includes(s);
  topButton.disabled=s==='downloading'||s==='restarting'||busy;
  topButton.classList.toggle('is-downloading',s==='downloading');
  topLabel.textContent=s==='ready'?'Restart to update':s==='downloading'?'Downloading '+version+' · '+state.progress+'%':s==='restarting'?'Restarting…':state.installable?'Update to '+version:'Get '+version;
  topButton.title=state.message||'';topButton.style.setProperty('--update-progress',(s==='downloading'?state.progress:0)+'%');
  // Settings row.
  const checked=state.checkedAt?' Last checked '+new Date(state.checkedAt).toLocaleString()+'.':'';
  status.textContent='You are running The Nexus '+state.currentVersion+'. '+(state.message||'Updates are checked automatically.')+(s==='current'||s==='error'?checked:'');
  status.classList.toggle('has-warning',s==='error');
  progress.hidden=s!=='downloading';progress.firstElementChild.style.width=state.progress+'%';
  install.hidden=!(s==='ready'||(s==='available'&&!state.installable));install.textContent=s==='ready'?'Restart to update':'Open release page';
  install.disabled=busy;check.disabled=busy||['checking','downloading','restarting'].includes(s);
 }
 async function run(action){
  busy=true;if(current)render(current);
  try{const state=await api[action]();if(state?.error)throw Error(state.error);if(state?.status)current=state;}
  catch(error){current={...(current||{}),status:'error',message:error.message};}
  finally{busy=false;if(current)render(current);}
 }
 topButton.onclick=()=>run('updateInstall');install.onclick=()=>run('updateInstall');check.onclick=()=>run('updateCheck');
 api.onUpdateChange(render);api.updateState().then(state=>{if(state&&!state.error)render(state);}).catch(()=>{});
})();
