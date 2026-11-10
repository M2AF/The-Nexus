(() => {
  const selector='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';
  const cursor=document.createElement('div');cursor.id='controller-cursor';cursor.hidden=true;cursor.setAttribute('aria-hidden','true');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 54');
  const glove=document.createElementNS(svg.namespaceURI,'path');
  glove.setAttribute('d','M14 25V8a4 4 0 0 1 8 0v13l3-2a4 4 0 0 1 5 1l1 2 2-1a4 4 0 0 1 5 2l1 3h2a4 4 0 0 1 4 4l-2 12-6 7H20l-6-7-8-11a4 4 0 0 1 6-5l5 5');
  glove.setAttribute('fill','#fff');glove.setAttribute('stroke','#172746');glove.setAttribute('stroke-width','2.5');glove.setAttribute('stroke-linecap','round');glove.setAttribute('stroke-linejoin','round');svg.append(glove);
  const badge=document.createElement('b');badge.textContent='P1';cursor.append(svg,badge);document.body.append(cursor);
  let x=innerWidth/2,y=innerHeight/2,mode='cursor',target=null,connected=false,active=false,lastTime=performance.now(),lastButtons=[],held={},index=-1;
  const help=document.getElementById('controller-help');
  function scope(){return [...document.querySelectorAll('dialog[open]')].at(-1)||document.body;}
  function candidates(){return [...scope().querySelectorAll(selector)].filter(el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && el.tabIndex>=0);}
  function highlight(el){if(target!==el){target?.classList.remove('controller-target');target=el;target?.classList.add('controller-target');document.dispatchEvent(new CustomEvent('nexus-controller-target',{detail:{target}}));}}
  function begin(nextMode){active=true;mode=nextMode;document.body.dataset.controllerMode=mode;help.hidden=!connected;cursor.hidden=!connected;}
  function reset(){highlight(null);cursor.hidden=true;active=false;delete document.body.dataset.controllerMode;}
  function aim(){const host=scope();if(cursor.parentElement!==host)host.append(cursor);cursor.style.transform=`translate(${x-18}px,${y-4}px)`;}
  function atCursor(){const el=document.elementFromPoint(x,y)?.closest(selector);return el && scope().contains(el) && !el.disabled?el:null;}
  function focus(el){if(!el)return;highlight(el);el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const rect=el.getBoundingClientRect();x=Math.max(10,Math.min(innerWidth-10,rect.left+Math.min(20,rect.width/2)));y=Math.max(8,Math.min(innerHeight-12,rect.top+rect.height/2));aim();}
  function move(dx,dy){
    begin('focus');const list=candidates();if(!list.length)return;
    const from=list.includes(document.activeElement)?document.activeElement:list.includes(target)?target:null;
    if(from?.matches('input[type=range]')&&dx){from.value=String(Number(from.value)+dx*Number(from.step||1));from.dispatchEvent(new Event('input',{bubbles:true}));from.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if(!from){focus(list.filter(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})[0]||list[0]);return;}
    const rect=from.getBoundingClientRect(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
    let best=null,score=Infinity;
    for(const el of list){if(el===from)continue;const r=el.getBoundingClientRect(),vx=r.x+r.width/2-cx,vy=r.y+r.height/2-cy,forward=vx*dx+vy*dy,cross=Math.abs(vx*dy-vy*dx);if(forward<2)continue;
      const overlap=dx?Math.min(rect.bottom,r.bottom)-Math.max(rect.top,r.top)>0:Math.min(rect.right,r.right)-Math.max(rect.left,r.left)>0;
      const value=forward+cross*(overlap?1.2:3.5)+(overlap?0:80);if(value<score){score=value;best=el;}}
    focus(best||from);
  }
  function back(){const dialog=scope();if(dialog.tagName==='DIALOG'){dialog.close();reset();return;}document.querySelector('.brand')?.click();document.getElementById('search')?.blur();reset();}
  let keyboardTarget=null,keyboardSelection=[0,0],uppercase=false;
  const keyboard=document.createElement('dialog');keyboard.id='controller-keyboard';
  const heading=document.createElement('h2');heading.textContent='Type with your controller';
  const preview=document.createElement('div');preview.className='keyboard-preview';preview.setAttribute('aria-live','polite');
  const keys=document.createElement('div');keys.className='keyboard-keys';
  function updatePreview(){preview.textContent=keyboardTarget?.type==='password'?'•'.repeat(keyboardTarget.value.length):keyboardTarget?.value || ' ';}
  function edit(value){if(!keyboardTarget?.isConnected){keyboard.close();return;}
    const field=keyboardTarget,text=field.value;let [start,end]=keyboardSelection;
    if(value==='Clear'){start=0;end=text.length;value='';}
    else if(value==='Delete'){if(start===end&&start>0){const segments=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text.slice(0,start))];start=segments.at(-1)?.index||0;}value='';}
    else value=value==='Space'?' ':value==='New line'?'\n':value;
    if(field.maxLength>=0&&text.length-(end-start)+value.length>field.maxLength)return;
    field.value=text.slice(0,start)+value+text.slice(end);keyboardSelection=[start+value.length,start+value.length];
    try{field.setSelectionRange(...keyboardSelection);}catch{/* Some input types have no caret API. */}
    field.dispatchEvent(new Event('input',{bubbles:true}));updatePreview();}
  const letterButtons=[];
  const shift=document.createElement('button');shift.type='button';shift.textContent='Shift';shift.className='keyboard-wide';shift.setAttribute('aria-pressed','false');
  shift.onclick=()=>{uppercase=!uppercase;shift.setAttribute('aria-pressed',String(uppercase));for(const button of letterButtons)button.textContent=uppercase?button.dataset.key:button.dataset.key.toLowerCase();};
  for(const [rowIndex,letters]of ['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM',".,'?!-_@:/"].entries()){
    const row=document.createElement('div');row.className='keyboard-row';row.dataset.row=String(rowIndex);
    if(rowIndex===3)row.append(shift);
    for(const letter of letters){const button=document.createElement('button');button.type='button';button.dataset.key=letter;button.textContent=/[A-Z]/.test(letter)?letter.toLowerCase():letter;button.onclick=()=>edit(button.textContent);if(/[A-Z]/.test(letter))letterButtons.push(button);row.append(button);}
    if(rowIndex===3){const button=document.createElement('button');button.type='button';button.textContent='Delete';button.className='keyboard-wide';button.onclick=()=>edit('Delete');row.append(button);}keys.append(row);
  }
  const actions=document.createElement('div');actions.className='keyboard-actions';
  for(const label of ['Space','New line','Clear','Done']){const button=document.createElement('button');button.type='button';button.textContent=label;button.className='button '+(label==='Done'?'primary':'secondary');button.onclick=()=>label==='Done'?keyboard.close():edit(label);actions.append(button);}
  keyboard.append(heading,preview,keys,actions);document.body.append(keyboard);
  keyboard.addEventListener('close',()=>{const field=keyboardTarget;keyboardTarget=null;if(field?.isConnected)field.focus({preventScroll:true});reset();});
  const choices=document.createElement('dialog');choices.id='controller-choices';document.body.append(choices);
  function openChoices(select){choices.replaceChildren();const title=document.createElement('h2');title.textContent=select.getAttribute('aria-label')||'Choose an option';choices.append(title);
    for(const option of select.options){const button=document.createElement('button');button.className='button secondary';button.textContent=option.textContent;button.disabled=option.disabled;button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));choices.close();select.focus({preventScroll:true});};choices.append(button);}choices.showModal();begin('focus');focus(choices.querySelector('button:not(:disabled)'));}
  function activate(){
    const el=mode==='focus'&&document.activeElement!==document.body?document.activeElement:atCursor();if(!el||el.disabled)return;
    if(el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea')){keyboardTarget=el;keyboardSelection=[el.selectionStart??el.value.length,el.selectionEnd??el.value.length];actions.querySelectorAll('button').forEach(button=>{if(button.textContent==='New line')button.hidden=el.tagName!=='TEXTAREA';});updatePreview();keyboard.showModal();begin('focus');focus(keyboard.querySelector('[data-key="Q"]'));return;}
    if(el.tagName==='SELECT'){openChoices(el);return;}
    if(el.matches('input[type=range]')){el.focus({preventScroll:true});if(mode!=='focus'){const rect=el.getBoundingClientRect(),min=Number(el.min||0),max=Number(el.max||100);el.value=String(min+(max-min)*Math.max(0,Math.min(1,(x-rect.left)/rect.width)));el.dispatchEvent(new Event('input',{bubbles:true}));}return;}
    const previousScope=scope();el.focus({preventScroll:true});el.click();if(scope()!==previousScope){begin('focus');focus(document.activeElement);}cursor.classList.add('pressed');setTimeout(()=>cursor.classList.remove('pressed'),130);
  }
  function scroll(value){if(!value)return;let el=mode==='focus'?document.activeElement:document.elementFromPoint(x,y);const modal=scope();
    while(el&&el!==document.body){if(el.scrollHeight>el.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(el).overflowY)){el.scrollBy(0,value);return;}el=el.parentElement;}
    if(modal.tagName==='DIALOG')modal.scrollBy(0,value);else window.scrollBy(0,value);
  }
  function edge(button,now){if(!button)return false;if(!lastButtons[button]){held[button]=now;return true;}if(now-(held[button]||now)>360){held[button]=now-220;return true;}return false;}
  function dead(value){const magnitude=Math.abs(value||0);return magnitude<=.18?0:Math.sign(value)*Math.pow((Math.min(magnitude,1)-.18)/.82,1.5);}
  function frame(now){
    const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;
    let pad;try{pad=[...navigator.getGamepads()].find(p=>p?.connected&&p.mapping==='standard');}catch{/* Gamepad API unavailable. */}
    if(!pad){if(connected){connected=false;help.hidden=true;reset();delete document.body.dataset.controllerConnected;}lastButtons=[];index=-1;requestAnimationFrame(frame);return;}
    connected=true;document.body.dataset.controllerConnected='true';
    const buttons=pad.buttons.map(button=>button.pressed || button.value>.5);
    if(index!==pad.index){index=pad.index;lastButtons=buttons;requestAnimationFrame(frame);return;}
    if(!document.hasFocus()){lastButtons=buttons;reset();requestAnimationFrame(frame);return;}
    const dx=dead(pad.axes[0]),dy=dead(pad.axes[1]);
    if(dx||dy){begin('cursor');x=Math.max(4,Math.min(innerWidth-5,x+dx*950*dt));y=Math.max(4,Math.min(innerHeight-5,y+dy*950*dt));highlight(atCursor());if((y>innerHeight-36&&dy>0)||(y<36&&dy<0))scroll(dy*600*dt);}
    for(const [button,h,v] of [[12,0,-1],[13,0,1],[14,-1,0],[15,1,0]])if(buttons[button]&&edge(button,now))move(h,v);
    if(buttons[0]&&!lastButtons[0]){begin(mode);activate();}
    if(buttons[1]&&!lastButtons[1])back();
    if(buttons[9]&&!lastButtons[9]&&scope()===document.body){begin('focus');document.getElementById('settings')?.click();}
    if(scope()===document.body){const discoverOpen=document.getElementById('discover-page')&&!document.getElementById('discover-page').hidden;const tabs=discoverOpen?[...document.querySelectorAll('[data-discover-group]')].map((tab,i)=>{tab.id='discover-tab-'+i;return tab.id;}):['installed-tab','owned-tab','web-tab'];for(const [index,step] of [[4,-1],[5,1]])if(buttons[index]&&!lastButtons[index]){const current=tabs.findIndex(id=>document.getElementById(id)?.getAttribute('aria-selected')==='true');const tab=document.getElementById(tabs[(Math.max(0,current)+step+tabs.length)%tabs.length]);begin('focus');tab?.click();focus(tab);}}
    const wheel=dead(pad.axes[3])+(buttons[7]?1:0)-(buttons[6]?1:0);if(wheel){begin(mode);scroll(wheel*850*dt);}
    if(active)aim();lastButtons=buttons;requestAnimationFrame(frame);
  }
  document.addEventListener('pointermove',event=>{if(event.isTrusted && (event.movementX || event.movementY || event.pointerType==='touch'))reset();});
  document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.target.matches('input,textarea,select'))return;const direction={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[event.key];if(direction){event.preventDefault();move(...direction);}else if(event.key==='Escape')reset();});
  document.addEventListener('nexus:render',()=>{if(target&&!target.isConnected)highlight(null);});
  window.addEventListener('blur',reset);requestAnimationFrame(frame);
})();
