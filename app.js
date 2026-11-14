const $=id=>document.getElementById(id);
const saved=new Set(JSON.parse(localStorage.getItem('sdv-saved')||'[]'));
const categoryNames={music:'Live Music',food:'Food & Dining',festival:'Festival',other:'Experiences'};
let events=[];
let communityEvents;
const cityCalendars = {
  "Antioch": "https://www.antiochca.gov/1027/Local-Community-Events",
  "Auburn": "https://auburn.ca.gov/calendar.aspx?CID=25",
  "Brentwood": "https://www.brentwoodca.gov/government/parks-recreation/special-events-and-programs/special-events-calendar",
  "Citrus Heights": "https://www.citrusheights.net/events",
  "Davis": "https://www.cityofdavis.org/city-hall/city-manager-s-office/community-events",
  "Elk Grove": "https://elkgrove.gov/all-events",
  "Fairfield": "https://www.fairfield.ca.gov/government/city-departments/parks-and-recreation/special-events/",
  "Folsom": "https://www.folsom.ca.us/government/parks-recreation/recreation/special-events",
  "Galt": "https://www.cityofgalt.org/our-city/special-events",
  "Isleton": "https://www.cityofisleton.com/community-events",
  "Lincoln": "https://www.lincolnca.gov/parks-recreation-and-activities/special-events/community-events/",
  "Lodi": "https://www.lodi.gov/1061/Special-Events",
  "Oakley": "https://www.oakleyca.gov/369/Special-Events",
  "Placerville": "https://www.cityofplacerville.org/events",
  "Rancho Cordova": "https://www.cityofranchocordova.org/experience/rancho-cordova-events/-toggle-next30days",
  "Rocklin": "https://www.rocklin.ca.us/annual-events",
  "Roseville": "https://www.roseville.ca.gov/programs_events/index.php",
  "Sacramento": "https://www.cityofsacramento.gov/edd/community-engagement/community-calendar",
  "Suisun City": "https://www.suisun.com/Events-directory",
  "Vacaville": "https://www.cityofvacaville.gov/government/parks-and-recreation/special-events",
  "West Sacramento": "https://www.cityofwestsacramento.org/government/departments/parks-recreation/westsacrhythmontheriver",
  "Winters": "https://www.cityofwinters.org/167/Community-Events",
  "Woodland": "https://www.cityofwoodland.gov/DocumentCenter/View/15103/2026-List-of-Special-Events-May-Update"
};
const wineryRegions = $('region')?.innerHTML;

function setCalendar(community) {
  $('winery-mode').setAttribute('aria-pressed', String(!community));
  $('community-mode').setAttribute('aria-pressed', String(community));
  $('region-label').textContent = community ? 'City' : 'Region';
  $('region').innerHTML = community
    ? '<option value="all">All cities</option>' + Object.keys(cityCalendars).map(city =>
        `<option value="${city.toLowerCase().replaceAll(' ', '-')}">${city}</option>`).join('')
    : wineryRegions;
  $('winery-sources').hidden = community;
  $('community-sources').hidden = !community;
  $('source-status').hidden = community;
  render();

  if (community && !communityEvents) {
    fetch('./data/community_events.json', {cache: 'no-store'})
      .then(response => {
        if (!response.ok) throw new Error('Community calendar unavailable');
        return response.json();
      })
      .then(data => { communityEvents = Array.isArray(data.events) ? data.events : []; })
      .catch(() => { communityEvents = []; })
      .finally(render);
  }
}
$('winery-mode')?.addEventListener('click', () => setCalendar(false));
$('community-mode')?.addEventListener('click', () => setCalendar(true));
if ($('community-sources')) $('community-sources').innerHTML = '<details><summary>Official city calendars</summary>' + Object.entries(cityCalendars).map(([city, url]) =>
  `<a href="${url}" target="_blank" rel="noopener">${city} ↗</a>`).join(' · ') + '</details>';

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
function cardSummary(description) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(description ?? '').replace(/<[^>]*>/g, ' ').replace(/</g, '&lt;');
  const text = decoder.value.replace(/\s+/g, ' ').trim();
  const limit = 150;
  if (text.length <= limit) return text;

  const excerpt = text.slice(0, limit);
  const sentenceEnd = [...excerpt.matchAll(/[.!?](?=\s)/g)].pop();
  if (sentenceEnd && sentenceEnd.index >= 65) {
    return excerpt.slice(0, sentenceEnd.index + 1);
  }

  const wordEnd = excerpt.lastIndexOf(' ');
  return excerpt.slice(0, wordEnd > 0 ? wordEnd : limit - 1).trimEnd() + '…';
}
function calendarURL(e){const stamp=(date,time)=>date.replace(/-/g,'')+'T'+(time||'12:00').replace(':','')+'00';const q=new URLSearchParams({action:'TEMPLATE',text:e.title,dates:stamp(e.date,e.start)+'/'+stamp(e.endDate||e.date,e.end||e.start||'13:00'),ctz:'America/Los_Angeles',details:(e.description||'')+'\nConfirm details with the organizer: '+e.url,location:[e.venue,e.location].filter(Boolean).join(', ')});return 'https://calendar.google.com/calendar/render?'+q;}
const graniteBayDayPlanEvents = new Set([
  'placer-2026-11-20-twin-rocks-patrick-walsh',
  'placer-2026-12-04-twin-rocks-guitar-sax'
]);

function mapDirections(destination) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination);
}

function dayPlan(e) {
  if (!graniteBayDayPlanEvents.has(e.id)) return '';

  const stops = [
    {
      time: '12:30 PM',
      name: 'Lunch at Farmhaus',
      note: 'Start with lunch at this Granite Bay restaurant.',
      url: 'https://www.farmhausgb.com/',
      address: 'Farmhaus, 8230 Auburn Folsom Road, Granite Bay, CA'
    },
    {
      time: '2:00 PM',
      name: 'Folsom Lake at Granite Bay',
      note: 'Take a short lakeside walk or spend some time enjoying the view. Check park conditions before heading out.',
      url: 'https://www.parks.ca.gov/?page_id=10916',
      address: 'Granite Bay Main Beach, Folsom Lake State Recreation Area, Granite Bay, CA'
    },
    {
      time: '4:00 PM',
      name: 'Live music at Twin Rocks Estate Winery',
      note: 'Finish the afternoon with live music at the winery.',
      url: e.url,
      address: 'Twin Rocks Estate Winery, 6635 Cavitt Stallman Road, Granite Bay, CA'
    }
  ];

  return `<details class="day-plan">
    <summary>Make a Day of It</summary>
    <ol>${stops.map(stop => `<li><strong>${stop.time} · <a href="${escapeHTML(stop.url)}" target="_blank" rel="noopener">${stop.name}</a></strong><br>
      ${stop.note} <a href="${escapeHTML(mapDirections(stop.address))}" target="_blank" rel="noopener" aria-label="Directions to ${stop.name}">Directions ↗</a></li>`).join('')}</ol>
    <small>Suggested times, Pacific. Confirm winery showtime and venue hours before you go.</small>
  </details>`;
}
function render(){const community = $('community-mode')?.getAttribute('aria-pressed') === 'true';const region=$('region').value,cat=$('category').value,when=$('when').value,search=$('search').value.trim().toLowerCase(),fav=$('favoritesOnly').checked;const now=new Date();now.setHours(0,0,0,0);const limit=new Date(now);limit.setDate(limit.getDate()+30);const filtered=(community ? communityEvents || [] : events).filter(e=>{const d=dateAt(e.date);return dateAt(e.endDate||e.date)>=now&&(region==='all'||(community ? e.city : e.region)===region)&&(cat==='all'||e.category===cat)&&(when==='all'||(when==='weekend'&&weekend(e.date))||(when==='month'&&d<=limit))&&(!fav||saved.has(e.id))&&(!search||[e.title,e.venue,e.location,e.description].join(' ').toLowerCase().includes(search));}).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));$('count').textContent=filtered.length+' upcoming event'+(filtered.length===1?'':'s');$('cards').innerHTML=filtered.length?filtered.map(e=>{const id=escapeHTML(e.id),title=escapeHTML(e.title),venue=escapeHTML(e.venue),location=escapeHTML(e.location),description=escapeHTML(cardSummary(e.description)),url=escapeHTML(e.url),time=escapeHTML([e.start,e.end].filter(Boolean).join('–'));const photo=cardPhoto(e);return `<article class="card"><div class="photo" style="background-image:url('${photo}')"><span class="pill">${escapeHTML(categoryFor(e))}</span><button class="save" aria-label="${saved.has(e.id)?'Remove from':'Save to'} favorites" data-save="${id}">${saved.has(e.id)?'♥':'♡'}</button></div><div class="card-content"><span class="date">${formatDateRange(e)}</span><h3>${title}</h3><div class="venue">${venue}</div><div class="meta">${time?'◷ '+time+' · ':''}${location}${e.host ? ' · ' + escapeHTML(e.host) : ''}</div><p class="desc">${description}</p><div class="actions"><a href="${escapeHTML(calendarURL(e))}" target="_blank" rel="noopener">+ Google Calendar</a><a href="${url}" target="_blank" rel="noopener">Official event ↗</a><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue,e.location].join(' '))}" target="_blank" rel="noopener">Directions ↗</a></div>${dayPlan(e)}</div></article>`}).join(''):`<div class="empty">${community && !communityEvents ? 'Loading community events…' : 'No upcoming events match these filters. Try a different filter or check the official calendars above.'}</div>`;}
['region','category','when','search','favoritesOnly'].forEach(id=>$(id).addEventListener('input',render));
$('cards').addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(!b)return;const key=b.dataset.save;saved.has(key)?saved.delete(key):saved.add(key);localStorage.setItem('sdv-saved',JSON.stringify([...saved]));render();});
function uniqueEvents(feeds){const seen=new Set();return feeds.flat().filter(e=>{const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');const key=[e.date,norm(e.title),norm(e.venue)].join('|');if(seen.has(key))return false;seen.add(key);return true;});}
Promise.all([
  fetch('./data/events.json',{cache:'no-store'}).then(r => {
    if (!r.ok) throw new Error('Amador events unavailable');
    return r.json();
  }),
  fetch('./data/curated_winery_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []})),
  fetch('./data/bogle_events.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {events: []})
    .catch(() => ({events: []})),
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
]).then(([amador, curatedWineries, bogle, local, oak, visitLodi, placer, explore]) => ({
  updatedAt: amador.updatedAt,
  events: uniqueEvents([amador.events || [], curatedWineries.events || [], bogle.events || [], local.events || [], oak.events || [], visitLodi.events || [], placer.events || [], explore.events || []])
})).then(data=>{events=Array.isArray(data.events)?data.events:[];const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'medium',timeStyle:'short'}):'Not yet updated';$('source-status').textContent=`Verified-source event feed · Last successful collection: ${updated} Pacific · ${events.length} events in feed. Event details can change; confirm with organizer.`;render();}).catch(()=>{$('source-status').textContent='Event feed unavailable. Please check the official calendars.';render();});
