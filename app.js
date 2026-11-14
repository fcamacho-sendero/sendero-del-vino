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
const venuePhotos = new Map(Object.entries({
  "twin rocks estate winery": 12811543,
  "rancho roble vineyards": 27054605,
  "dono dal cielo vineyard": 19065636,
  "wise villa winery": 20769138,
  "placer wine trail": 33790875,
  "oak farm vineyards": 12976925,
  "ever after wine": 4639044,
  "mcconnell estates": 9890531,
  "domenico winery vineyard": 28384559,
  "amador wine country": 31928705,
  "villegas family vineyard": 5838162,
  "vino noceto": 8877392,
  "rombauer vineyards": 28302113,
  "fraser family vineyards": 37227749,
  "scott harvey wines": 28748884,
  "participating wineries venues": 34235611,
  "christopher cellars": 7512257
}));
const defaultVenuePhoto = 6557958;

function cardPhoto(venue) {
  const name = String(venue || '').toLowerCase()
    .replace(/&(?:amp|#0*38|#x0*26);/g, '&')
    .replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^wise villa winery and restaurant$/, 'wise villa winery');
  const id = venuePhotos.get(name) || defaultVenuePhoto;
  return {
    image: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?w=800`,
    source: `https://www.pexels.com/photo/${id}/`
  };
}
function calendarURL(e){const stamp=(date,time)=>date.replace(/-/g,'')+'T'+(time||'12:00').replace(':','')+'00';const q=new URLSearchParams({action:'TEMPLATE',text:e.title,dates:stamp(e.date,e.start)+'/'+stamp(e.endDate||e.date,e.end||e.start||'13:00'),ctz:'America/Los_Angeles',details:(e.description||'')+'\nConfirm details with the organizer: '+e.url,location:[e.venue,e.location].filter(Boolean).join(', ')});return 'https://calendar.google.com/calendar/render?'+q;}
function render(){const region=$('region').value,cat=$('category').value,when=$('when').value,search=$('search').value.trim().toLowerCase(),fav=$('favoritesOnly').checked;const now=new Date();now.setHours(0,0,0,0);const limit=new Date(now);limit.setDate(limit.getDate()+30);const filtered=events.filter(e=>{const d=dateAt(e.date);return dateAt(e.endDate||e.date)>=now&&(region==='all'||e.region===region)&&(cat==='all'||e.category===cat)&&(when==='all'||(when==='weekend'&&weekend(e.date))||(when==='month'&&d<=limit))&&(!fav||saved.has(e.id))&&(!search||[e.title,e.venue,e.location,e.description].join(' ').toLowerCase().includes(search));}).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));$('count').textContent=filtered.length+' upcoming event'+(filtered.length===1?'':'s');$('cards').innerHTML=filtered.length?filtered.map(e=>{const id=escapeHTML(e.id),title=escapeHTML(e.title),venue=escapeHTML(e.venue),location=escapeHTML(e.location),description=escapeHTML(e.description),url=escapeHTML(e.url),time=escapeHTML([e.start,e.end].filter(Boolean).join('–'));const photo=cardPhoto(e.venue);return `<article class="card"><div class="photo" style="background-image:url('${photo.image}')"><span class="pill">${escapeHTML(categoryFor(e))}</span><button class="save" aria-label="${saved.has(e.id)?'Remove from':'Save to'} favorites" data-save="${id}">${saved.has(e.id)?'♥':'♡'}</button><a class="photo-credit" href="${photo.source}" target="_blank" rel="noopener" aria-label="Illustrative photo source on Pexels">Illustrative photo</a></div><div class="card-content"><span class="date">${formatDateRange(e)}</span><h3>${title}</h3><div class="venue">${venue}</div><div class="meta">${time?'◷ '+time+' · ':''}${location}</div><p class="desc">${description}</p><div class="actions"><a href="${escapeHTML(calendarURL(e))}" target="_blank" rel="noopener">+ Google Calendar</a><a href="${url}" target="_blank" rel="noopener">Official event ↗</a><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue,e.location].join(' '))}" target="_blank" rel="noopener">Directions ↗</a></div></div></article>`}).join(''):'<div class="empty">No verified upcoming events match these filters yet. Try another region or visit the official event calendars linked above.</div>';}
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
  fetch('./data/placer_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []})),
  fetch('./data/explore_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []}))
]).then(([amador, local, oak, visitLodi, placer, explore]) => ({
  updatedAt: amador.updatedAt,
  events: uniqueEvents([amador.events || [], local.events || [], oak.events || [], visitLodi.events || [], placer.events || [], explore.events || []])
})).then(data=>{events=Array.isArray(data.events)?data.events:[];const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'medium',timeStyle:'short'}):'Not yet updated';$('source-status').textContent=`Verified-source event feed · Last successful collection: ${updated} Pacific · ${events.length} events in feed. Event details can change; confirm with organizer.`;render();}).catch(()=>{$('source-status').textContent='Event feed unavailable. Please check the official calendars.';render();});
