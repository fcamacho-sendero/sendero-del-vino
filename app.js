const $=id=>document.getElementById(id);
const saved=new Set(JSON.parse(localStorage.getItem('sdv-saved')||'[]'));
const categoryNames={music:'Live Music',food:'Food & Dining',festival:'Festival',other:'Experiences'};
let events=[];
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dateAt(iso){return new Date(iso+'T12:00:00');}
function formatDate(iso){return dateAt(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});}
function formatDateRange(e){return e.endDate&&e.endDate>e.date?formatDate(e.date)+' – '+formatDate(e.endDate):formatDate(e.date);}
function weekend(iso){const d=dateAt(iso),now=new Date();now.setHours(0,0,0,0);const saturday=new Date(now);saturday.setDate(now.getDate()+(6-now.getDay()+7)%7);const sunday=new Date(saturday);sunday.setDate(saturday.getDate()+1);return d>=saturday&&d<=sunday;}
function categoryFor(e){return categoryNames[e.category]||categoryNames.other;}
const cardPhotos={
  holiday:'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=900&q=80',
  music:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
  food:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
  festival:'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80',
  other:'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=900&q=80'
};
function cardPhoto(e){
  const title=String(e.title||'').toLowerCase();
  const details=String(e.description||'').toLowerCase();
  if (/christmas|holiday stroll|xmas|navidad|noel|santa|tree lighting/.test(title) || /christmas stroll|holiday lights|christmas lights/.test(details)) return cardPhotos.holiday;
  return cardPhotos[e.category]||cardPhotos.other;
}
function calendarURL(e){const stamp=(date,time)=>date.replace(/-/g,'')+'T'+(time||'12:00').replace(':','')+'00';const q=new URLSearchParams({action:'TEMPLATE',text:e.title,dates:stamp(e.date,e.start)+'/'+stamp(e.endDate||e.date,e.end||e.start||'13:00'),ctz:'America/Los_Angeles',details:(e.description||'')+'\nConfirm details with the organizer: '+e.url,location:[e.venue,e.location].filter(Boolean).join(', ')});return 'https://calendar.google.com/calendar/render?'+q;}
function render(){const region=$('region').value,cat=$('category').value,when=$('when').value,search=$('search').value.trim().toLowerCase(),fav=$('favoritesOnly').checked;const now=new Date();now.setHours(0,0,0,0);const limit=new Date(now);limit.setDate(limit.getDate()+30);const filtered=events.filter(e=>{const d=dateAt(e.date);return dateAt(e.endDate||e.date)>=now&&(region==='all'||e.region===region)&&(cat==='all'||e.category===cat)&&(when==='all'||(when==='weekend'&&weekend(e.date))||(when==='month'&&d<=limit))&&(!fav||saved.has(e.id))&&(!search||[e.title,e.venue,e.location,e.description].join(' ').toLowerCase().includes(search));}).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));$('count').textContent=filtered.length+' upcoming event'+(filtered.length===1?'':'s');$('cards').innerHTML=filtered.length?filtered.map(e=>{const id=escapeHTML(e.id),title=escapeHTML(e.title),venue=escapeHTML(e.venue),location=escapeHTML(e.location),description=escapeHTML(e.description),url=escapeHTML(e.url),time=escapeHTML([e.start,e.end].filter(Boolean).join('–'));const photo=cardPhoto(e);return `<article class="card"><div class="photo" style="background-image:url('${photo}')"><span class="pill">${escapeHTML(categoryFor(e))}</span><button class="save" aria-label="${saved.has(e.id)?'Remove from':'Save to'} favorites" data-save="${id}">${saved.has(e.id)?'♥':'♡'}</button></div><div class="card-content"><span class="date">${formatDateRange(e)}</span><h3>${title}</h3><div class="venue">${venue}</div><div class="meta">${time?'◷ '+time+' · ':''}${location}</div><p class="desc">${description}</p><div class="actions"><a href="${escapeHTML(calendarURL(e))}" target="_blank" rel="noopener">+ Google Calendar</a><a href="${url}" target="_blank" rel="noopener">Official event ↗</a><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue,e.location].join(' '))}" target="_blank" rel="noopener">Directions ↗</a></div></div></article>`}).join(''):'<div class="empty">No verified upcoming events match these filters yet. Try another region or visit the official event calendars linked above.</div>';}
['region','category','when','search','favoritesOnly'].forEach(id=>$(id).addEventListener('input',render));
$('cards').addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(!b)return;const key=b.dataset.save;saved.has(key)?saved.delete(key):saved.add(key);localStorage.setItem('sdv-saved',JSON.stringify([...saved]));render();});
function uniqueEvents(feeds){const seen=new Set();return feeds.flat().filter(e=>{const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');const key=[e.date,norm(e.title),norm(e.venue)].join('|');if(seen.has(key))return false;seen.add(key);return true;});}
Promise.all([
  fetch('./data/events.json',{cache:'no-store'}).then(r => {
    if (!r.ok) throw new Error('Amador events unavailable');
    return r.json();
  }),
  fetch('./data/local_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []})),
  fetch('./data/oak_farm_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []})),
  fetch('./data/visit_lodi_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []})),
  fetch('./data/explore_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []}))
]).then(([amador, local, oak, visitLodi, explore]) => ({
  updatedAt: amador.updatedAt,
  events: uniqueEvents([amador.events || [], local.events || [], oak.events || [], visitLodi.events || [], explore.events || []])
})).then(data=>{events=Array.isArray(data.events)?data.events:[];const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'medium',timeStyle:'short'}):'Not yet updated';$('source-status').textContent=`Verified-source event feed · Last successful collection: ${updated} Pacific · ${events.length} events in feed. Event details can change; confirm with organizer.`;render();}).catch(()=>{$('source-status').textContent='Event feed unavailable. Please check the official calendars.';render();});
