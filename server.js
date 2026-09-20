const express = require('express');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;
const SOURCE = 'https://t.me/s/kpszsu';
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

app.use((req,res,next)=>{
  if(!req.path.startsWith('/api/')){
    res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma','no-cache');
    res.set('Expires','0');
    res.set('Surrogate-Control','no-store');
  }
  next();
});
app.use(express.static(__dirname, { etag:false, lastModified:false, maxAge:0 }));

function cleanText(s='') {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function findFirstNumber(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return Number(m[1].replace(/\s/g, ''));
  }
  return null;
}

function parseReport(text, date, link) {
  const t = cleanText(text);
  const launched = findFirstNumber(t, [
    /атакував(?:ла|ли)?\s+(\d{1,4})[-\sа-яіїєґ]*\s+(?:ударн\w*\s+)?БпЛА/i,
    /атакував(?:ла|ли)?\s+(\d{1,4})[-\sа-яіїєґ]*\s+ударними БпЛА/i,
    /противник атакував\s+(\d{1,4})/i
  ]);
  const neutralized = findFirstNumber(t, [
    /збито\/подавлено\s+(\d{1,4})\s+ворож/i,
    /збито\s+та\s+подавлено\s+(\d{1,4})/i,
    /збито\s+(\d{1,4})\s+(?:ворож\w*\s+)?БпЛА/i
  ]);

  if (!launched || neutralized === null || launched < neutralized) return null;
  return {
    date,
    launched,
    neutralized,
    missed: Math.max(0, launched - neutralized),
    rate: launched ? neutralized / launched : 0,
    sourceUrl: link
  };
}

async function loadStats() {
  const response = await fetch(SOURCE, {
    headers: { 'User-Agent': 'Mozilla/5.0 ThreatCalculator/1.2' }
  });
  if (!response.ok) throw new Error('Official source HTTP ' + response.status);
  const html = await response.text();
  const $ = cheerio.load(html);
  const reports = [];
  const now = Date.now();

  $('.tgme_widget_message_wrap').each((_, el) => {
    const root = $(el);
    const timeEl = root.find('time').first();
    const iso = timeEl.attr('datetime');
    const dateMs = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(dateMs) || now - dateMs < MIN_AGE_MS) return;

    const text = root.find('.tgme_widget_message_text').text();
    if (!text || /атака триває|в повітряному просторі.*ворож/i.test(text)) return;

    const post = root.find('.tgme_widget_message').attr('data-post');
    const link = post ? 'https://t.me/' + post : SOURCE;
    const parsed = parseReport(text, new Date(dateMs).toISOString(), link);
    if (parsed) reports.push(parsed);
  });

  reports.sort((a,b) => new Date(b.date) - new Date(a.date));
  const unique = [];
  const seen = new Set();
  for (const r of reports) {
    const key = r.date.slice(0,10) + ':' + r.launched + ':' + r.neutralized;
    if (!seen.has(key)) { seen.add(key); unique.push(r); }
  }

  const selected = unique.slice(0, 30);
  if (!selected.length) throw new Error('No completed official summaries parsed');

  const launched = selected.reduce((s,r)=>s+r.launched,0);
  const neutralized = selected.reduce((s,r)=>s+r.neutralized,0);
  const weightedRate = launched ? neutralized/launched : 0;
  const meanRate = selected.reduce((s,r)=>s+r.rate,0)/selected.length;

  return {
    source: 'Повітряні Сили ЗС України',
    sourceUrl: SOURCE,
    policy: 'Завершені офіційні зведення старші 24 годин; без поточних маршрутів і живих цілей.',
    generatedAt: new Date().toISOString(),
    reportsUsed: selected.length,
    totals: { launched, neutralized, notNeutralized: Math.max(0, launched-neutralized) },
    weightedRate,
    meanRate,
    latestCompleted: selected[0],
    recent: selected.slice(0, 10)
  };
}

let cache = { at: 0, data: null };
app.get('/api/stats', async (req, res) => {
  try {
    if (!cache.data || Date.now() - cache.at > 30*60*1000) {
      cache.data = await loadStats();
      cache.at = Date.now();
    }
    res.set('Cache-Control', 'no-store');
    res.json(cache.data);
  } catch (e) {
    res.status(503).json({ error: 'Не вдалося отримати завершені офіційні зведення', detail: e.message });
  }
});

app.get('/api/geocode', async (req,res)=>{
  try{
    const q=String(req.query.q||'').trim();
    if(!q) return res.status(400).json({error:'Введіть місто або адресу'});
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ua&q='+encodeURIComponent(q);
    const r=await fetch(url,{
      headers:{
        'User-Agent':'ThreatCalculator/1.2 (public web app)',
        'Accept-Language':'uk,en;q=0.8'
      }
    });
    if(!r.ok) throw new Error('Geocoder HTTP '+r.status);
    const raw=await r.json();
    const results=raw.map(x=>({
      lat:Number(x.lat),
      lng:Number(x.lon),
      displayName:x.display_name
    })).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
    res.set('Cache-Control','no-store');
    res.json({results});
  }catch(e){
    res.status(503).json({error:'Не вдалося виконати пошук місця'});
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html'), {headers:{'Cache-Control':'no-store'}}));
app.listen(port, '0.0.0.0', () => console.log('Threat Calculator running on port ' + port));
