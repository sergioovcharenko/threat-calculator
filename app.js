const $ = id => document.getElementById(id);
const fmtPct = v => (v*100).toFixed(1) + '%';
const fmtDate = iso => new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium'}).format(new Date(iso));

let pointMarker = null;
const savedPoint = JSON.parse(localStorage.getItem('threat-control-point') || 'null');

const map = L.map('map', { zoomControl:true }).setView([49.0,31.2],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19,
  attribution:'&copy; OpenStreetMap'
}).addTo(map);

function setControlPoint(lat,lng,name='Обрана точка',zoom=12){
  if(pointMarker) map.removeLayer(pointMarker);
  pointMarker = L.marker([lat,lng]).addTo(map).bindPopup('Контрольна точка').openPopup();
  map.setView([lat,lng],zoom);
  const point={lat,lng,name};
  localStorage.setItem('threat-control-point',JSON.stringify(point));
  $('pointName').textContent=name;
  $('pointCoords').textContent=lat.toFixed(5)+', '+lng.toFixed(5);
  $('locationStatus').textContent='Точка задана';
  $('locationStatus').classList.add('active');
}

if(savedPoint?.lat && savedPoint?.lng){
  setControlPoint(savedPoint.lat,savedPoint.lng,savedPoint.name || 'Збережена точка',10);
}

map.on('click',e=>{
  setControlPoint(e.latlng.lat,e.latlng.lng,'Точка на карті',map.getZoom());
});

async function searchPlace(){
  const q=$('placeSearch').value.trim();
  if(!q) return;
  $('searchBtn').disabled=true;
  $('searchBtn').textContent='Пошук…';
  $('searchResults').hidden=true;
  try{
    const r=await fetch('/api/geocode?q='+encodeURIComponent(q),{cache:'no-store'});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error || 'Помилка пошуку');
    if(!d.results?.length){
      $('searchResults').innerHTML='<div class="search-result">Нічого не знайдено</div>';
      $('searchResults').hidden=false;
      return;
    }
    $('searchResults').innerHTML=d.results.map((x,i)=>`<button class="search-result" data-i="${i}">${x.displayName}</button>`).join('');
    $('searchResults').hidden=false;
    $('searchResults').querySelectorAll('button').forEach(btn=>{
      btn.onclick=()=>{
        const x=d.results[Number(btn.dataset.i)];
        setControlPoint(x.lat,x.lng,x.displayName,12);
        $('searchResults').hidden=true;
      };
    });
  }catch(e){
    $('searchResults').innerHTML='<div class="search-result">'+e.message+'</div>';
    $('searchResults').hidden=false;
  }finally{
    $('searchBtn').disabled=false;
    $('searchBtn').textContent='Знайти';
  }
}

$('searchBtn').onclick=searchPlace;
$('placeSearch').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlace()});

$('geoBtn').onclick=()=>{
  if(!navigator.geolocation){
    $('locationStatus').textContent='Геолокація недоступна';
    return;
  }
  $('geoBtn').disabled=true;
  $('geoBtn').textContent='Визначення…';
  navigator.geolocation.getCurrentPosition(
    pos=>{
      setControlPoint(pos.coords.latitude,pos.coords.longitude,'Моя геолокація',13);
      $('geoBtn').disabled=false;
      $('geoBtn').textContent='Моя геолокація';
    },
    ()=>{
      $('locationStatus').textContent='Немає доступу до геолокації';
      $('geoBtn').disabled=false;
      $('geoBtn').textContent='Моя геолокація';
    },
    {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
  );
};

async function load() {
  $('refreshBtn').disabled = true;
  $('refreshBtn').textContent = 'Оновлення…';
  try {
    const r = await fetch('/api/stats', {cache:'no-store'});
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || d.error || 'Помилка джерела');

    const latest = d.latestCompleted;
    $('latestCount').textContent = latest.launched;
    $('latestNeutralized').textContent = latest.neutralized;
    $('latestRate').textContent = fmtPct(latest.rate);
    $('latestRemaining').textContent = latest.missed;
    $('avgRate').textContent = fmtPct(d.weightedRate);
    $('reportsUsed').textContent = d.reportsUsed + ' завершених зведень';

    const expectedNeutralized = Math.round(latest.launched * d.weightedRate);
    const expectedRemaining = Math.max(0, latest.launched - expectedNeutralized);
    $('projectCount').textContent = latest.launched;
    $('projectNeutralized').textContent = '≈ ' + expectedNeutralized;
    $('projectRemaining').textContent = '≈ ' + expectedRemaining;

    $('sourceName').textContent = d.source;
    $('policy').textContent = d.policy;
    $('updatedAt').textContent = 'Оновлено: ' + new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d.generatedAt));

    $('rows').innerHTML = d.recent.map(x => `
      <tr>
        <td>${fmtDate(x.date)}</td>
        <td>${x.launched}</td>
        <td>${x.neutralized}</td>
        <td>${fmtPct(x.rate)}</td>
        <td><a href="${x.sourceUrl}" target="_blank" rel="noopener">офіційний допис</a></td>
      </tr>`).join('');
  } catch (e) {
    $('rows').innerHTML = '<tr><td colspan="5">Не вдалося автоматично отримати дані: '+e.message+'</td></tr>';
  } finally {
    $('refreshBtn').disabled = false;
    $('refreshBtn').textContent = 'Оновити';
  }
}

$('refreshBtn').addEventListener('click', load);
load();

let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e;
  const b=$('installBtn'); b.hidden=false;
  b.onclick=()=>deferredPrompt.prompt();
});
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
}
if('caches' in window){
  caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
}
