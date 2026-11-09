(()=>{
 'use strict';const fullscreen=document.getElementById('window-fullscreen'),startup=document.getElementById('open-at-startup'),status=document.getElementById('startup-status');
 function renderWindow(state){fullscreen.setAttribute('aria-pressed',String(state.fullscreen));fullscreen.setAttribute('aria-label',state.fullscreen?'Exit fullscreen':'Enter fullscreen');fullscreen.title=(state.fullscreen?'Exit fullscreen':'Fullscreen')+' (F11)';document.body.classList.toggle('is-fullscreen',state.fullscreen);}
 fullscreen.onclick=()=>window.nexus.windowAction('fullscreen');
 document.addEventListener('keydown',event=>{if(event.key==='F11'){event.preventDefault();if(!event.repeat)window.nexus.windowAction('fullscreen');}},true);
 document.getElementById('window-title').ondblclick=()=>window.nexus.windowAction('maximize');
 window.nexus.onWindowChange(renderWindow);window.nexus.windowState().then(renderWindow);
 function renderStartup(result){startup.checked=!!result.enabled;startup.disabled=!result.available;status.textContent=result.available?'Open The Nexus when you sign in to Windows. Keep the portable executable in this folder.':'Available in the packaged Windows launcher.';}
 async function refreshStartup(){try{const result=await window.nexus.startup();if(result.error)throw Error(result.error);renderStartup(result);}catch(error){startup.disabled=true;status.textContent=error.message;}}
 startup.onchange=async()=>{const enabled=startup.checked;startup.disabled=true;try{const result=await window.nexus.startup(enabled);if(result.error)throw Error(result.error);renderStartup(result);}catch(error){startup.checked=!enabled;startup.disabled=false;status.textContent=error.message;}};
 document.getElementById('settings').addEventListener('click',refreshStartup);refreshStartup();
})();
