const map=L.map('map').setView([49.0,31.0],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);

let home=null,homeMarker=null,pendingTarget=false,targets=[];
const rows=document.getElementById('rows'), nearestEl=document.getElementById('nearest'), minEtaEl=document.getElementById('minEta'), totalEl=document.getElementById('totalTargets');
const speed=document.getElementById('speed'), speedMode=document.getElementById('speedMode');

const saved=localStorage.getItem('threat-home');
if(saved){home=JSON.parse(saved);homeMarker=L.marker(home).addTo(map).bindPopup('Контрольна точка');map.setView(home,8)}

function km(a,b){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lng-a.lng)*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function etaText(hours){const mins=Math.round(hours*60); if(mins<60)return mins+' хв'; return Math.floor(mins/60)+' год '+(mins%60)+' хв'}
function threatClass(mins){return mins<15?'danger':mins<30?'warn':'ok'}

map.on('click',e=>{
  if(pendingTarget){
    if(!home){alert('Спочатку встанови контрольну точку');pendingTarget=false;return}
    const t={id:Date.now(),lat:e.latlng.lat,lng:e.latlng.lng,type:document.getElementById('targetType').value,count:+document.getElementById('count').value||1,speed:+speed.value||450,intercept:+document.getElementById('intercept').value||0,speedDefault:speedMode.dataset.default==='1'};
    t.marker=L.marker([t.lat,t.lng]).addTo(map).bindPopup(t.type);
    targets.push(t);pendingTarget=false;render();return;
  }
  home={lat:e.latlng.lat,lng:e.latlng.lng};localStorage.setItem('threat-home',JSON.stringify(home));
  if(homeMarker)map.removeLayer(homeMarker);
  homeMarker=L.marker(home).addTo(map).bindPopup('Контрольна точка').openPopup();
  render();
});

document.getElementById('addTarget').onclick=()=>{pendingTarget=true};
document.getElementById('clearTargets').onclick=()=>{targets.forEach(t=>map.removeLayer(t.marker));targets=[];render()};
document.getElementById('useDefault').onclick=()=>{speed.value=450;speedMode.textContent='Підставлено за замовчуванням';speedMode.dataset.default='1'};
speed.addEventListener('input',()=>{speedMode.textContent='Введено вручну';speedMode.dataset.default='0'});
speedMode.dataset.default='1';

function render(){
  rows.innerHTML='';let nearest=Infinity,minEta=Infinity,total=0;

  const sortedTargets=[...targets].map(t=>{
    const d=home?km(home,{lat:t.lat,lng:t.lng}):0;
    const h=d/t.speed;
    return {t,d,h};
  }).sort((a,b)=>a.d-b.d || a.h-b.h);

  sortedTargets.forEach((item,index)=>{
    const {t,d,h}=item;
    const remain=t.count*(1-t.intercept/100), mins=h*60;
    nearest=Math.min(nearest,d);minEta=Math.min(minEta,h);total+=t.count;
    const tr=document.createElement('tr');
    const order=index===0?'⚠️ 1 — найближча':(index+1)+'';
    tr.innerHTML=`<td><strong>${order}</strong><br>${t.type}</td><td>${t.count}</td><td>${d.toFixed(1)} км</td><td>${t.speed} км/год ${t.speedDefault?'<small>(деф.)</small>':''}</td><td class="${threatClass(mins)}">${etaText(h)}</td><td>${t.intercept}%</td><td>≈ ${remain.toFixed(1)}</td><td><button data-id="${t.id}">×</button></td>`;
    rows.appendChild(tr);
  });

  rows.querySelectorAll('button').forEach(b=>b.onclick=()=>{const id=+b.dataset.id;const t=targets.find(x=>x.id===id);if(t)map.removeLayer(t.marker);targets=targets.filter(x=>x.id!==id);render()});
  nearestEl.textContent=targets.length?nearest.toFixed(1)+' км':'—';
  minEtaEl.textContent=targets.length?etaText(minEta):'—';
  totalEl.textContent=total;
  const p=(+document.getElementById('intercept').value||0)/100;
  document.getElementById('quickStats').innerHTML=[10,50,100].map(n=>`<span class="chip">${n} → очікувано залишається ≈ ${(n*(1-p)).toFixed(1)}</span>`).join('');
}
render();

let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=document.getElementById('installBtn');b.hidden=false;b.onclick=()=>deferredPrompt.prompt()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');