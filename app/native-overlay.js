(()=>{
 'use strict';
 if(window.nexus.nativeSurface){
  document.body.classList.add('native-surface');
  const pointer=document.createElement('span');pointer.id='native-pointer';pointer.setAttribute('aria-hidden','true');document.getElementById('platform-dialog').append(pointer);
  document.addEventListener('mousemove',event=>{pointer.style.left=event.clientX+'px';pointer.style.top=event.clientY+'px';});
  document.getElementById('overlay-full-app').textContent='Open desktop Nexus';
 }
 window.nexus.onOverlayError?.(message=>{if(typeof toast==='function')toast(message,true);});
})();
