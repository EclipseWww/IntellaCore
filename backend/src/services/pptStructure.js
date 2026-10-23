const path = require('path').posix;
const crypto = require('crypto');
const { SaxesParser } = require('saxes');
function tree(xml) {
  if (!xml) return null;
  const root={children:[]}, stack=[root], parser=new SaxesParser({xmlns:true});
  parser.on('opentag',tag=>{const n={name:tag.local,attrs:{},children:[],text:''};Object.values(tag.attributes).forEach(a=>{if(a.prefix!=='xmlns' && a.name!=='xmlns')n.attrs[a.local]=a.value;});stack.at(-1).children.push(n);stack.push(n);});
  parser.on('text',s=>{stack.at(-1).text+=s;});parser.on('closetag',()=>stack.pop());parser.write(xml).close();return root.children[0];
}
const all=(node,name)=>node ? [...(node.name===name?[node]:[]),...node.children.flatMap(n=>all(n,name))] : [];
const first=(node,name)=>all(node,name)[0];
const read=(entries,p)=>tree(entries.get(p)?.getText());
function rels(entries,p) {
  const dir=path.dirname(p),file=path.join(dir,'_rels',path.basename(p)+'.rels');
  return Object.fromEntries(all(read(entries,file),'Relationship').map(n=>[n.attrs.Id,{...n.attrs,path:n.attrs.TargetMode==='External'?n.attrs.Target:n.attrs.Target.startsWith('/')?n.attrs.Target.slice(1):path.normalize(path.join(dir,n.attrs.Target))}]));
}
function hash(entries,p) {return entries.has(p)?crypto.createHash('sha256').update(entries.get(p).getBuffer()).digest('hex'):null;}
function orderedSlides(entries) {
  const relationships=rels(entries,'ppt/presentation.xml');
  return all(read(entries,'ppt/presentation.xml'),'sldId').map(n=>relationships[n.attrs.id]?.path).filter(Boolean);
}
function showSettings(entries) {
  const t=read(entries,'ppt/presProps.xml'),s=first(t,'showPr'),range=first(s,'sldRg');
  const presentation=read(entries,'ppt/presentation.xml'),relationships=rels(entries,'ppt/presentation.xml'),slidePaths=orderedSlides(entries);
  const shows=all(first(presentation,'custShowLst'),'custShow').map(show=>({id:show.attrs.id,slides:all(show,'sld').map(slide=>{
    const index=slidePaths.indexOf(relationships[slide.attrs.id]?.path);
    return index<0?null:index+1;
  })}));
  // IDs and names are editor-generated; grade the actual ordered slide sequences.
  const selected=first(s,'custShow');
  const showType=first(s,'kiosk')?'kiosk':first(s,'browse')?'browse':'presenter';
  return {showType,explicitShowType:!!s,customShows:shows.map(show=>show.slides).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),selectedCustomShow:selected?(shows.find(show=>show.id===selected.attrs.id)?.slides || {missing:true}):null,loop:s?.attrs.loop==='1' || s?.attrs.loop==='true',kiosk:!!first(s,'kiosk'),presenter:!first(s,'kiosk') && !first(s,'browse'),useManualAdvance:['0','false'].includes(s?.attrs.useTimings),range:range?{start:Number(range.attrs.st),end:Number(range.attrs.end)}:null};
}
function slideStructure(entries,p,slidePaths) {
  const t=read(entries,p),relationships=rels(entries,p),spTree=first(t,'spTree');
  const objects=[],objectsById={};
  function walk(node,parent=null) {
    for(const n of node?.children || []) {
      if(!['sp','pic','graphicFrame','grpSp'].includes(n.name))continue;
      const identity=first(n,'cNvPr'),id=identity?.attrs.id;
      const text=all(n,'t').map(n=>n.text).join('');
      const blip=first(n,'blip'),img=relationships[blip?.attrs.embed || blip?.attrs.link];
      const transform=first(n,'xfrm'),off=first(transform,'off'),ext=first(transform,'ext');
      const obj={id,name:identity?.attrs.name,kind:n.name,text,mediaHash:img?hash(entries,img.path):null,group:parent,zOrder:objects.length,presetShape:first(n,'prstGeom')?.attrs.prst || null,position:{x:off?Number(off.attrs.x):null,y:off?Number(off.attrs.y):null,cx:ext?Number(ext.attrs.cx):null,cy:ext?Number(ext.attrs.cy):null}};
      objects.push(obj);if(id)objectsById[id]=obj;
      if(n.name==='grpSp')walk(n,id);
    }
  }
  walk(spTree);
  const nodes=[];
  const visit=(node,ancestors=[])=>{if(!node)return;nodes.push({node,ancestors});for(const child of node.children || [])visit(child,[...ancestors,node]);};
  visit(first(t,'timing'));
  const media=[];
  for(const shape of all(spTree,'pic').concat(all(spTree,'sp'))) {
    const id=first(shape,'cNvPr')?.attrs.id;
    const fileNodes=[...all(shape,'audioFile'),...all(shape,'videoFile')];
    const references=[...all(shape,'media'),...fileNodes].map(n=>relationships[n.attrs.embed || n.attrs.link]).filter(Boolean);
    if(!references.length)continue;
    // Office commonly writes a videoFile link and a p14:media embed for one object.
    const file=references.find(r=>entries.has(r.path)) || references[0];
    const type=fileNodes.some(n=>n.name==='videoFile') || /video/i.test(file.Type) || /\.(avi|mp4|wmv|mov)$/i.test(file.path)?'video':'audio';
    const mediaNode=nodes.find(({node})=>node.name==='cMediaNode' && first(node,'spTgt')?.attrs.spid===id)?.node;
    const mediaTiming=first(mediaNode,'cTn');
    const slideCount=Number(mediaNode?.attrs.numSld ?? 1);
    const command=nodes.find(({node})=>node.name==='cmd' && /play/i.test(node.attrs.cmd || '') && first(node,'spTgt')?.attrs.spid===id);
    const trigger=command?.ancestors.slice().reverse().find(n=>n.name==='cTn' && n.attrs.nodeType);
    const autoplay=trigger?['withEffect','afterEffect'].includes(trigger.attrs.nodeType):all(first(mediaTiming,'stCondLst'),'cond').some(n=>n.attrs.delay==='0' || n.attrs.evt==='onBegin');
    const mediaHash=hash(entries,file.path);
    const ordinal=media.filter(m=>m.type===type && (mediaHash?m.mediaHash===mediaHash:m.mediaName===path.basename(file.path))).length;
    const object=objectsById[id];if(object){object.mediaObject=true;object.mediaHash=mediaHash;}
    media.push({objectId:id,objectName:object?.name,relationshipId:file.Id,target:file.path,mediaName:path.basename(file.path),mediaHash,type,ordinal,slideCount,playAcrossSlides:slideCount>1,playMode:autoplay?'auto':'click',autoplay,loop:mediaTiming?.attrs.repeatCount==='indefinite' || mediaNode?.attrs.loop==='1',hideWhileNotPlaying:mediaNode?.attrs.showWhenStopped==='0' || mediaNode?.attrs.hideAtShowing==='1',rewind:mediaTiming?.attrs.rewind==='1' || mediaNode?.attrs.rewindWhenDone==='1'});
  }
  const descriptor=id=>{const o=objectsById[id];return o?{kind:o.kind,text:o.text,mediaHash:o.mediaHash,name:o.name}:null;};
  const links=[];
  for(const n of spTree?.children || []) {
    const id=first(n,'cNvPr')?.attrs.id;
    for(const link of all(n,'hlinkClick')) {
      const r=relationships[link.attrs.id],action=link.attrs.action || null;
      links.push({object:descriptor(id),action,target:r?.Type?.endsWith('/slide')?`slide:${slidePaths.indexOf(r.path)+1}`:r?.path || null});
    }
  }
  const transition=first(t,'transition');
  const effect=transition?.children.find(n=>!['sndAc','extLst'].includes(n.name));
  const sound=first(transition,'snd'),soundRel=relationships[sound?.attrs.embed];
  const trans=transition?{type:effect?.name || 'none',direction:effect?.attrs.dir || effect?.attrs.orient || null,thruBlk:effect?.attrs.thruBlk || null,speed:transition.attrs.spd || null,duration:transition.attrs.dur || null,sound:!!sound,soundName:sound?.attrs.name || (soundRel?path.basename(soundRel.path):null),soundHash:soundRel?hash(entries,soundRel.path):null}:null;
  const animations=[];
  // Keep each preset effect with its own target, subtype and start condition.
  for(const n of all(first(t,'timing'),'cTn').filter(n=>n.attrs.presetID!==undefined || n.attrs.presetClass!==undefined)) {
    const target=first(n,'spTgt')?.attrs.spid;
    const anim=first(n,'animEffect');
    const type=n.attrs.nodeType;
    const snd=first(n,'sndTgt'),sndRel=relationships[snd?.attrs.embed];
    const behavior=first(n,'cBhvr'),behaviorTiming=first(behavior,'cTn');
    const rotation=first(n,'animRot');
    animations.push({presetClass:n.attrs.presetClass || null,presetId:n.attrs.presetID || null,subtype:n.attrs.presetSubtype || null,filter:anim?.attrs.filter || null,transition:anim?.attrs.transition || null,object:descriptor(target),start:type==='withEffect'?'withPrevious':type==='afterEffect'?'afterPrevious':type==='clickEffect'?'onClick':type || null,duration:behaviorTiming?.attrs.dur || n.attrs.dur || null,rotation:rotation?.attrs.by || null,sound:!!snd,soundName:snd?.attrs.name || null,soundHash:sndRel?hash(entries,sndRel.path):null});
  }
  const layoutRel=Object.values(relationships).find(r=>r.Type?.endsWith('/slideLayout'));
  const layout=layoutRel?read(entries,layoutRel.path):null;
  const masterPath=layoutRel?Object.values(rels(entries,layoutRel.path)).find(r=>r.Type?.endsWith('/slideMaster'))?.path || null:null;
  const color=node=>{const c=(node?.children || []).find(n=>['srgbClr','schemeClr','sysClr','prstClr'].includes(n.name));return c?{type:c.name,value:c.attrs.val || c.attrs.lastClr,modifiers:c.children.map(n=>({type:n.name,value:n.attrs.val}))}:null;};
  const bg=first(t,'bg'),bgPr=first(bg,'bgPr'),pattern=first(bgPr,'pattFill'),solid=first(bgPr,'solidFill'),bgBlip=first(bgPr,'blip'),bgImage=relationships[bgBlip?.attrs.embed || bgBlip?.attrs.link];
  const backgroundDetails=bgPr?{fillType:pattern?'pattern':bgBlip?'image':solid?'solid':first(bgPr,'gradFill')?'gradient':'other',pattern:pattern?.attrs.prst || null,foreground:pattern?color(first(pattern,'fgClr')):solid?color(solid):null,background:pattern?color(first(pattern,'bgClr')):null,imageHash:bgImage?hash(entries,bgImage.path):null,opacity:bgBlip?Number(first(bgBlip,'alphaModFix')?.attrs.amt || 100000)/100000:null}:null;
  const tables=[];
  for(const tbl of all(t,'tbl')) {
    const rows=all(tbl,'tr').map(row=>row.children.filter(n=>n.name==='tc').map(cell=>{
      const runs=all(cell,'r').map(run=>{
        const pr=first(run,'rPr');
        return {text:all(run,'t').map(n=>n.text).join(''),fontFamily:first(pr,'ea')?.attrs.typeface || first(pr,'latin')?.attrs.typeface || null,fontSize:pr?.attrs.sz?Number(pr.attrs.sz)/100:null,bold:pr?.attrs.b==='1',italic:pr?.attrs.i==='1',color:color(first(pr,'solidFill'))};
      });
      return {text:all(cell,'t').map(n=>n.text).join(''),runs,alignments:all(cell,'pPr').map(n=>n.attrs.algn || 'l')};
    }));
    tables.push(rows);
  }
  return {objects,media,hyperlinks:links,transition:trans,animations,backgroundDetails,tables,masterPath,hideMasterShapes:['0','false'].includes(t?.attrs.showMasterSp),layout:layout?{type:layout.attrs.type || null,name:first(layout,'cSld')?.attrs.name || null}:null};
}
module.exports={orderedSlides,showSettings,slideStructure};
