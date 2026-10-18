import {randomUUID} from 'node:crypto';
import {weatherArea,weatherFresh,condition,weatherRisk,WEATHER_CODES} from './public/weather-core.mjs';
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
export class WeatherError extends Error{constructor(code,status=502){super(code);this.code=code;this.status=status;}}
export function parseWeather(data,now=Date.now()){
 const c=data?.current,temperatureC=number(c?.temperature_2m,-100,65),time=number(c?.time,0,1e11),code=number(c?.weather_code,0,99),precipitationMm=number(c?.precipitation,0,500),snowfallCm=number(c?.snowfall,0,500);
 if(temperatureC===null||time===null||!WEATHER_CODES.has(code)||precipitationMm===null||snowfallCm===null||now-time*1000>45*60000||time*1000-now>15*60000)throw new WeatherError('weather_unavailable');
 const h=data.hourly,nextHours=[];let recentPrecipitationMm=0;
 if(Array.isArray(h?.time))for(let i=0;i<h.time.length;i++){
  const at=h.time[i]*1000,p=number(h.precipitation?.[i],0,500),snow=number(h.snowfall?.[i],0,500),probability=number(h.precipitation_probability?.[i],0,100),hourCode=number(h.weather_code?.[i],0,99);
  if(!Number.isFinite(at))continue;
  if(at<=now&&at>now-2*3600000&&p!==null)recentPrecipitationMm+=p;
  if(at>now&&at<=now+2*3600000&&WEATHER_CODES.has(hourCode))nextHours.push({at,code:hourCode,probability,precipitationMm:p,snowfallCm:snow});
 }
 return {source:'Open-Meteo',fetchedAt:now,observedAt:time*1000,temperatureC,feelsLikeC:number(c.apparent_temperature,-100,80),windKmh:number(c.wind_speed_10m,0,400),code,precipitationMm,snowfallCm,recentPrecipitationMm:Math.round(recentPrecipitationMm*10)/10,nextHours};
}
export function describeWeather(w,now=Date.now()){
 if(!weatherFresh(w,now))return 'No current server-verified weather is available. Do not invent local weather, rain, snow, or road conditions. Ask the rider to enable GPS weather if needed.';
 const risk=weatherRisk(w,now);
 return `SERVER-VERIFIED LOCAL WEATHER: Open-Meteo model estimate for an approximate GPS area, NOT a street sensor or official warning. Current data time ${new Date(w.observedAt).toISOString()}; fetched ${new Date(w.fetchedAt).toISOString()}. Conditions: ${condition(w.code)}; air temperature ${w.temperatureC} C; feels like ${w.feelsLikeC??'unknown'} C; wind ${w.windKmh??'unknown'} km/h; current interval precipitation ${w.precipitationMm} mm and snowfall ${w.snowfallCm} cm; preceding two hours estimated precipitation ${w.recentPrecipitationMm} mm. Next two hourly forecast points: ${JSON.stringify(w.nextHours)}. ${risk?`Precaution category: ${risk.kind}. Mention possible slipperiness briefly when relevant; freezing risk is an inference, never confirmed ice.`:'No precipitation risk detected by this limited check; this does NOT prove the road is safe.'} Use this to chat naturally in character. Distinguish current estimates from future possibilities. Never claim to observe the road, prove dry pavement, guarantee safety or invent an address. No street-level navigation or business lookup is available.`;
}
export function createWeatherService({fetchImpl=fetch,now=Date.now,timeoutMs=10000}={}){
 const cells=new Map(),ids=new Map();let minute=-1,day=-1,minuteCount=0,dayCount=0,active=0;
 return {
  resolve(id){const w=typeof id==='string'?ids.get(id):null;return weatherFresh(w,now())?w:null;},
  async lookup(input,{signal}={}){
   const area=weatherArea({lat:input?.latitude,lon:input?.longitude,accuracy:input?.accuracy,time:input?.observedAt},now());if(!area)throw new WeatherError('invalid_location',400);
   for(const [id,value] of ids)if(!weatherFresh(value,now()))ids.delete(id);
   const key=`${area.latitude},${area.longitude}`,cached=cells.get(key);if(cached&&now()-cached.fetchedAt<300000&&weatherFresh(cached,now()))return cached;
   const m=Math.floor(now()/60000),d=Math.floor(now()/86400000);if(m!==minute){minute=m;minuteCount=0;}if(d!==day){day=d;dayCount=0;}
   if(active>=3||minuteCount>=30||dayCount>=1000)throw new WeatherError('weather_rate_limited',429);active++;minuteCount++;dayCount++;
   const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,timeoutMs);
   try{
    const url=new URL('https://api.open-meteo.com/v1/forecast');
    url.search=new URLSearchParams({latitude:String(area.latitude),longitude:String(area.longitude),current:'temperature_2m,apparent_temperature,precipitation,snowfall,weather_code,wind_speed_10m',hourly:'precipitation,precipitation_probability,snowfall,weather_code',past_hours:'2',forecast_hours:'4',timeformat:'unixtime',timezone:'GMT',temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm'});
    const response=await fetchImpl(url,{signal:controller.signal,redirect:'error'});if(!response.ok)throw new WeatherError('weather_unavailable');
    const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>100000)throw new WeatherError('weather_unavailable');chunks.push(chunk);}
    const weather={...parseWeather(JSON.parse(Buffer.concat(chunks).toString('utf8')),now()),id:randomUUID()};
    cells.delete(key);cells.set(key,weather);ids.set(weather.id,weather);
    // Other riders may still hold an earlier, fresh reference from this area.
    while(ids.size>512)ids.delete(ids.keys().next().value);
    while(cells.size>200)cells.delete(cells.keys().next().value);return weather;
   }catch(e){throw e instanceof WeatherError?e:new WeatherError(controller.signal.aborted?'weather_timeout':'weather_unavailable');}
   finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);active--;}
  }
 };
}
export function createWeatherHandler(service){
 return async(req,res)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/api/weather')return false;
  const send=(status,body)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method!=='POST'){res.setHeader('Allow','POST');send(405,{error:'method_not_allowed'});return true;}
  const origin=req.headers.origin;let crossSite=req.headers['sec-fetch-site']==='cross-site';if(origin)try{crossSite||=new URL(origin).host!==req.headers.host;}catch{crossSite=true;}
  if(crossSite){send(403,{error:'origin_not_allowed'});return true;}
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(415,{error:'invalid_content_type'});return true;}
  const controller=new AbortController(),onClose=()=>{if(!res.writableEnded)controller.abort();};res.on('close',onClose);
  try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)throw new WeatherError('invalid_location',413);chunks.push(chunk);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new WeatherError('invalid_location',400);}send(200,await service.lookup(body,{signal:controller.signal}));}
  catch(error){send(error instanceof WeatherError?error.status:500,{error:error instanceof WeatherError?error.code:'weather_unavailable'});}
  finally{res.off('close',onClose);}return true;
 };
}
