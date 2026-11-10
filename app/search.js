(()=>{
 'use strict';
 const form=document.getElementById('global-search-form'),input=document.getElementById('search'),button=document.getElementById('global-search-submit');
 const queries={library:'',discover:''};let context='library';
 function render(){const library=context==='library',label=library?'Search Library':'Search Stores';input.value=queries[context];input.placeholder=library?'Find a game in your library':'Find a PC game across your stores';input.setAttribute('aria-label',label);form.setAttribute('aria-label',label);button.textContent=label;form.dataset.context=context;}
 window.NexusSearch={get context(){return context;},setContext(next){if(!Object.hasOwn(queries,next))return;queries[context]=input.value;context=next;render();},setQuery(mode,value){if(!Object.hasOwn(queries,mode))return;queries[mode]=String(value);if(context===mode)input.value=queries[mode];}};
 input.addEventListener('input',()=>{queries[context]=input.value;});
 form.addEventListener('submit',event=>{event.preventDefault();queries[context]=input.value;if(context==='library')input.dispatchEvent(new Event('input',{bubbles:true}));else document.dispatchEvent(new CustomEvent('nexus-store-search',{detail:{query:input.value}}));});
 input.addEventListener('search',()=>{if(context==='discover'&&!input.value)form.requestSubmit();});
 document.addEventListener('keydown',event=>{if(event.key==='/'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();input.focus();}});
 render();
})();
