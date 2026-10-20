export function mapName(language='ko'){return ['coalesce',['get','name:'+language],['get',language==='en'?'name:latin':'name:nonlatin'],['get','name']];}
export function koreaMapStyle(language='ko',accent='#187962'){
 const vector=(id,type,sourceLayer,paint,rest={})=>({id,type,source:'openmaptiles','source-layer':sourceLayer,paint,...rest});
 const widths=['interpolate',['linear'],['zoom'],6,.4,12,1.6,16,8,19,26];
 const font=['Noto Sans Regular'],label=(size=12)=>({'text-field':mapName(language),'text-font':font,'text-size':size,'text-max-width':8});
 return {version:8,name:'VELO SOUL · Seoul paper garden',glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{openmaptiles:{type:'vector',url:'https://tiles.openfreemap.org/planet'},journey:{type:'geojson',data:{type:'FeatureCollection',features:[]}}},layers:[
  {id:'paper',type:'background',paint:{'background-color':'#f5f2e9'}},
  vector('landscape','fill','landcover',{'fill-color':['match',['get','class'],['wood','grass'],'#dee9d3','sand','#efeadb','#e8ebde'],'fill-opacity':.65}),
  vector('parks','fill','park',{'fill-color':'#d2e3c5','fill-opacity':.7}),
  vector('garden-land','fill','landuse',{'fill-color':['match',['get','class'],['park','grass','recreation_ground','cemetery'],'#dce8cd',['hospital','school'],'#eee6db','#eeeae1'],'fill-opacity':.65}),
  vector('han-river','fill','water',{'fill-color':'#b7d8d8'}),
  vector('small-streams','line','waterway',{'line-color':'#b7d8d8','line-width':['interpolate',['linear'],['zoom'],8,.6,15,2.5,19,9]}),
  vector('buildings','fill','building',{'fill-color':'#e4e0d4','fill-outline-color':'#d9d5c7'},{minzoom:14}),
  vector('road-edge','line','transportation',{'line-color':'#ddd6c7','line-width':['interpolate',['linear'],['zoom'],6,1,12,2.8,16,10,19,29]},{filter:['match',['get','class'],['motorway','trunk','primary','secondary','tertiary','minor','service'],true,false],layout:{'line-cap':'round','line-join':'round'}}),
  vector('roads','line','transportation',{'line-color':['match',['get','class'],['motorway','trunk'],'#ead4a7',['primary','secondary'],'#fbf5df','#fffdf7'],'line-width':widths},{filter:['match',['get','class'],['motorway','trunk','primary','secondary','tertiary','minor','service'],true,false],layout:{'line-cap':'round','line-join':'round'}}),
  vector('paths','line','transportation',{'line-color':'#9eb58b','line-width':['interpolate',['linear'],['zoom'],12,.6,16,1.6,19,4],'line-dasharray':[2,2]},{minzoom:12,filter:['match',['get','class'],['path','track'],true,false]}),
  vector('rail','line','transportation',{'line-color':'#c8c0b2','line-width':1,'line-dasharray':[3,3]},{minzoom:12,filter:['==',['get','class'],'rail']}),
  vector('districts','line','boundary',{'line-color':'#d2cebf','line-width':1,'line-dasharray':[2,3]},{filter:['<=',['get','admin_level'],6]}),
  {id:'our-path-halo',type:'line',source:'journey',paint:{'line-color':'#fff','line-width':8},layout:{'line-cap':'round','line-join':'round'}},
  {id:'our-path',type:'line',source:'journey',paint:{'line-color':accent,'line-width':4},layout:{'line-cap':'round','line-join':'round'}},
  vector('water-names','symbol','water_name',{'text-color':'#56878c','text-halo-color':'#d4e7e5','text-halo-width':1},{layout:{...label(12),'text-letter-spacing':.12}}),
  vector('park-names','symbol','park',{'text-color':'#657f55','text-halo-color':'#edf3e4','text-halo-width':1.5},{minzoom:12,layout:label(11)}),
  vector('street-names','symbol','transportation_name',{'text-color':'#727562','text-halo-color':'#fffdf6','text-halo-width':2},{minzoom:13,layout:{...label(12),'symbol-placement':'line','text-letter-spacing':.02}}),
  vector('town-names','symbol','place',{'text-color':'#6d7463','text-halo-color':'#faf8ef','text-halo-width':2},{filter:['match',['get','class'],['country','state','province','city','town','suburb','quarter','neighbourhood'],true,false],layout:{...label(['interpolate',['linear'],['zoom'],5,11,11,14,16,16]),'text-letter-spacing':.04}}),
  vector('landmarks','circle','poi',{'circle-radius':3,'circle-color':'#b48c5e','circle-stroke-color':'#fffaf0','circle-stroke-width':1.5},{minzoom:13,filter:['match',['get','class'],['attraction','museum','monument','castle','art_gallery','park'],true,false]}),
  vector('landmark-names','symbol','poi',{'text-color':'#80613f','text-halo-color':'#fffaf0','text-halo-width':2},{minzoom:13,filter:['match',['get','class'],['attraction','museum','monument','castle','art_gallery','park'],true,false],layout:{...label(11),'text-anchor':'top','text-offset':[0,.6]}}),
  vector('cafes','symbol','poi',{'text-color':'#ad8a6d','text-halo-color':'#fffaf0','text-halo-width':1.5},{minzoom:16,filter:['match',['get','class'],['cafe','bakery','restaurant'],true,false],layout:{...label(10),'text-padding':5}})
 ]};
}
export function routeFeature(points=[]){const coordinates=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180).map(p=>[p.lon,p.lat]);return {type:'FeatureCollection',features:coordinates.length>1?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates}}]:[]};}
