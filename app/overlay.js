(()=>{
 'use strict';
 const $=id=>document.getElementById(id),dialog=$('platform-dialog'),heading=dialog.querySelector('.platform-heading'),eyebrow=heading.querySelector('.eyebrow'),close=$('platform-close');let overlay=false,lastGame=null;
 const full=document.createElement('button');full.id='overlay-full-app';full.className='button secondary';full.textContent='Full Nexus';full.hidden=true;full.onclick=()=>window.nexus.windowAction('show-main');heading.insertBefore(full,$('platform-refresh'));
 const context=document.createElement('p');context.id='overlay-game-context';context.setAttribute('role','status');context.hidden=true;heading.after(context);
 const category=document.createElement('button');category.type='button';category.dataset.friendsFilter='game';category.id='overlay-same-game';category.setAttribute('role','tab');category.setAttribute('aria-selected','false');category.textContent='Same game';category.hidden=true;dialog.querySelector('.platform-tabs').append(category);
 // Added after the friends script initializes, so wire this tab explicitly.
 category.onclick=()=>window.NexusPlatforms.filter('game');
 function apply(state){const wasOverlay=overlay;overlay=!!state.overlay;document.body.classList.toggle('game-overlay',overlay);full.hidden=!overlay;context.hidden=!overlay;category.hidden=!overlay;eyebrow.textContent=overlay?'NEXUS OVERLAY · ALT+C TO RETURN':'YOUR PEOPLE';close.setAttribute('aria-label',overlay?'Return to game':'Close platform friends');
  if(overlay){for(const modal of document.querySelectorAll('dialog[open]'))if(modal!==dialog&&!wasOverlay)modal.close();if(!dialog.open)window.NexusPlatforms.open();context.textContent=state.overlayGame?'Playing '+state.overlayGame.name:'Friends & chats · No running library game detected yet';category.disabled=!state.overlayGame;window.NexusPlatforms.game(state.overlayGame||null);if(state.overlayGame&&lastGame!==state.overlayGame.key&&!dialog.classList.contains('has-conversation'))window.NexusPlatforms.filter('game');lastGame=state.overlayGame?.key||null;}
  else if(wasOverlay){lastGame=null;if(dialog.open)dialog.close();window.NexusPlatforms.game(null);}
 }
 dialog.addEventListener('close',()=>{if(overlay&&!dialog.open)window.nexus.windowAction('dismiss-overlay');});
 window.nexus.onWindowChange(apply);window.nexus.windowState().then(apply);
 const background=$('run-in-background'),enabled=$('overlay-enabled'),status=$('desktop-status');
 function settings(state){$('overlay-open').disabled=!state.overlayEnabled;background.checked=!!state.background;background.disabled=!state.trayAvailable;enabled.checked=!!state.overlayEnabled;status.textContent=!state.trayAvailable?'System tray is unavailable. Closing the main window will quit Nexus.':state.overlayEnabled?(state.shortcutRegistered?(state.nativeMode?'Alt+C opens the independent in-game overlay. ':'Alt+C opens the floating desktop overlay. ')+(state.background?'Closing the window keeps Nexus in the tray.':'Closing the main window quits Nexus.'):'Alt+C is unavailable or used by another app. Open the overlay from the tray menu.'):'Overlay shortcut is off. Use Quit The Nexus in the tray menu to exit.';}
 async function load(){try{const state=await window.nexus.desktopSettings();if(state.error)throw Error(state.error);settings(state);}catch(error){status.textContent=error.message;}}
 for(const [input,key]of [[background,'background'],[enabled,'overlayEnabled']])input.onchange=async()=>{try{const state=await window.nexus.desktopSettings({[key]:input.checked});if(state.error)throw Error(state.error);settings(state);}catch(error){input.checked=!input.checked;status.textContent=error.message;}};
 $('overlay-open').onclick=()=>window.nexus.windowAction('overlay');$('settings').addEventListener('click',load);load();
})();
