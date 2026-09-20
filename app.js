const $ = id => document.getElementById(id);
const fmtPct = v => (v*100).toFixed(1) + '%';
const fmtDate = iso => new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium'}).format(new Date(iso));

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
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
