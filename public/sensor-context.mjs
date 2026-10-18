import {SEOUL_PLACES,metersBetween} from './seoul-places.mjs';

export function locationContext(point,speed,now=Date.now()){
 if(!point||![point.lat,point.lon,point.accuracy,point.time].every(Number.isFinite)||Math.abs(point.lat)>90||Math.abs(point.lon)>180||point.accuracy<0||point.accuracy>60||now-point.time>30000||point.time-now>5000)return null;
 const nearest=SEOUL_PLACES.map(place=>({place,distance:metersBetween(point,place)})).sort((a,b)=>a.distance-b.distance)[0];
 const location={observedAt:point.time,accuracyMeters:Math.round(point.accuracy)};
 if(Number.isFinite(speed)&&speed>=0&&speed<=90)location.speedKmh=Math.round(speed*10)/10;
 if(nearest&&nearest.distance<=2000){location.placeId=nearest.place.id;location.distanceMeters=Math.round(nearest.distance);}
 return location;
}

// Exact coordinates never leave the device; weather lookup separately shares a coarse grid. only validated catalog IDs and coarse
// accuracy, distance and speed are used in the companion's context.
export function validateLocationContext(value,now=Date.now()){
 if(!value||typeof value!=='object'||!Number.isFinite(value.observedAt)||now-value.observedAt>30000||value.observedAt-now>5000||!Number.isFinite(value.accuracyMeters)||value.accuracyMeters<0||value.accuracyMeters>60)return null;
 const result={observedAt:value.observedAt,accuracyMeters:Math.round(value.accuracyMeters)};
 if(value.speedKmh!==undefined){if(!Number.isFinite(value.speedKmh)||value.speedKmh<0||value.speedKmh>90)return null;result.speedKmh=Math.round(value.speedKmh*10)/10;}
 if(value.placeId!==undefined){if(!SEOUL_PLACES.some(p=>p.id===value.placeId)||!Number.isFinite(value.distanceMeters)||value.distanceMeters<0||value.distanceMeters>2000)return null;result.placeId=value.placeId;result.distanceMeters=Math.round(value.distanceMeters);}
 return result;
}

export function describeLocation(location){
 if(!location)return 'No recent GPS context is available. Do not claim to know the rider location or speed.';
 const place=SEOUL_PLACES.find(p=>p.id===location.placeId);
 return `The client reports a recent GPS fix, accuracy approximately ${location.accuracyMeters} meters. ${location.speedKmh===undefined?'Speed is unknown.':`Reported speed: ${location.speedKmh} km/h.`} ${place?`Nearest known catalog place: ${place.name.en}, approximate straight-line distance ${location.distanceMeters} meters. This does not prove arrival or that the rider is inside. Catalog facts: ${place.fact}`:'No catalog place is identified nearby. The street address and city are unknown; do not invent them.'} Raw GPS coordinates are not provided. Weather is supplied separately when available. No route or shop search is available.`;
}
