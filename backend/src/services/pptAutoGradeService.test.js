const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs').promises;
const os=require('os');
const path=require('path');
const JSZip=require('jszip');
const {analyzePptx,generatePptGradeRules,gradePptSubmission}=require('./pptAutoGradeService');
const ns='xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const text=(content,id=2,size=1800,link='')=>`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="文字${id}">${link}</p:cNvPr></p:nvSpPr><p:txBody><a:p><a:r><a:rPr sz="${size}"><a:ea typeface="黑体"/></a:rPr><a:t>${content}</a:t></a:r></a:p></p:txBody></p:sp>`;
const timing=(id,subtype=1,start='clickEffect')=>`<p:timing><p:tnLst><p:par><p:cTn id="1" presetID="2" presetClass="entr" presetSubtype="${subtype}" nodeType="${start}"><p:childTnLst><p:animEffect filter="blinds(horizontal)" transition="in"><p:cBhvr><p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
async function fixture(file,{slides=[{}],order,show='',customShows='',mediaFiles={}}={}) {
  const zip=new JSZip(),indices=order || slides.map((_,i)=>i+1);
  zip.file('ppt/media/image1.png',Buffer.from('fixed image content for matching'));
  for(const [name,content] of Object.entries(mediaFiles))zip.file('ppt/media/'+name,content);
  zip.file('ppt/presentation.xml',`<p:presentation ${ns}><p:sldIdLst>${indices.map(i=>`<p:sldId id="${255+i}" r:id="rId${i}"/>`).join('')}</p:sldIdLst>${customShows}</p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels',`<Relationships>${slides.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`).join('')}</Relationships>`);
  zip.file('ppt/presProps.xml',`<p:presentationPr ${ns}>${show}</p:presentationPr>`);
  slides.forEach((s,i)=>{
    zip.file(`ppt/slides/slide${i+1}.xml`,`<p:sld ${ns}><p:cSld>${s.background || ''}<p:spTree>${s.body || text('标题'+(i+1))}</p:spTree></p:cSld>${s.transition || ''}${s.timing || ''}</p:sld>`);
    zip.file(`ppt/slides/_rels/slide${i+1}.xml.rels`,`<Relationships><Relationship Id="layout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${i+1}.xml"/>${s.rels || ''}</Relationships>`);
    zip.file(`ppt/slideLayouts/slideLayout${i+1}.xml`,`<p:sldLayout ${ns} type="${s.layout || 'blank'}"><p:cSld name="${s.layout || '空白'}"/></p:sldLayout>`);
  });
  await fs.writeFile(file,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
}
async function files(run){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ppt-grade-'));try{await run(...['original','reference','student'].map(n=>path.join(dir,n+'.pptx')));}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('自定义放映创建与选用分别判分，忽略名称和ID但严格检查播放顺序',()=>files(async(original,reference,student)=>{
  const custom=(id,sequence)=>`<p:custShowLst><p:custShow name="放映${id}" id="${id}"><p:sldLst>${sequence.map(i=>`<p:sld r:id="rId${i}"/>`).join('')}</p:sldLst></p:custShow></p:custShowLst>`;
  const slides=[{},{},{},{}];
  await fixture(original,{slides});
  await fixture(reference,{slides,customShows:custom(0,[1,3,4]),show:'<p:showPr><p:custShow id="0"/></p:showPr>'});
  const rules=(await generatePptGradeRules({originalPath:original,referencePath:reference})).filter(r=>['customShows','selectedCustomShow'].includes(r.expected?.property));
  assert.equal(rules.length,2);
  await fixture(student,{slides,customShows:custom(42,[1,3,4]),show:'<p:showPr><p:custShow id="42"/></p:showPr>'});
  assert.equal((await gradePptSubmission({studentPath:student,rules})).score,10);
  await fixture(student,{slides,customShows:custom(42,[1,4,3]),show:'<p:showPr><p:custShow id="42"/></p:showPr>'});
  assert.equal((await gradePptSubmission({studentPath:student,rules})).score,0);
  await fixture(student,{slides,customShows:custom(42,[1,3,4]),show:'<p:showPr><p:sldRg st="2" end="4"/></p:showPr>'});
  const results=(await gradePptSubmission({studentPath:student,rules})).results;
  assert.equal(results[0].passed,true);assert.equal(results[1].passed,false);
  assert.equal((await gradePptSubmission({studentPath:original,rules})).score,0);
}));
test('放映类型仅变化时生成得分点，并区分演讲者、窗口和展台',()=>files(async(original,reference,student)=>{
  const show='<p:showPr><p:present/></p:showPr>';
  await fixture(original,{show});await fixture(reference,{show});
  const unchanged=(await generatePptGradeRules({originalPath:original,referencePath:reference})).filter(r=>r.expected?.property==='showType');
  assert.equal(unchanged.length,0);
  await fixture(reference,{show:'<p:showPr><p:kiosk/></p:showPr>'});
  const rules=(await generatePptGradeRules({originalPath:original,referencePath:reference})).filter(r=>r.expected?.property==='showType');
  assert.equal(rules.length,1);assert.equal(rules[0].expected.value,'kiosk');
  assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
  for(const mode of ['browse','present']) {
    await fixture(student,{show:`<p:showPr><p:${mode}/></p:showPr>`});
    assert.equal((await gradePptSubmission({studentPath:student,rules})).score,0);
  }
}));
test('按实际页序、版式、放映范围与具体切换声音检查',()=>files(async(original,reference,student)=>{
  await fixture(original,{slides:[{},{}]});
  const options={order:[2,1],slides:[{}, {layout:'twoObj',transition:'<p:transition><p:split orient="horz" dir="out"/><p:sndAc><p:stSnd><p:snd name="风铃"/></p:stSnd></p:sndAc></p:transition>'}],show:'<p:showPr loop="1"><p:present/><p:sldRg st="1" end="2"/></p:showPr>'};
  await fixture(reference,options);
  const a=await analyzePptx(reference);assert.equal(a.slides[0].textShapes[0].text,'标题2');assert.equal(a.slides[0].transition.type,'split');assert.equal(a.slides[0].transition.direction,'out');assert.deepEqual(a.showSettings.range,{start:1,end:2});assert.equal(a.slides[0].media.length,0);
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
  assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
  await fixture(student,{...options,slides:[{}, {...options.slides[1],transition:options.slides[1].transition.replace('风铃','微风')}],show:'<p:showPr loop="1"><p:present/><p:sldRg st="1" end="1"/></p:showPr>'});
  const graded=await gradePptSubmission({studentPath:student,rules});assert.equal(graded.results.find(r=>r.type==='transitionSound').passed,false);assert.equal(graded.results.find(r=>r.title==='放映设置：放映范围').passed,false);
}));

test('中间插入一页不把后移的原有页当删除与重建',()=>files(async(original,reference,student)=>{
  await fixture(original,{slides:[{body:text('旧第一页')},{body:text('旧第二页')}]});
  await fixture(reference,{slides:[{body:text('旧第一页')},{body:text('新插入页')},{body:text('旧第二页')}]});
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
  assert.ok(rules.some(r=>r.type==='slideCount'));
  assert.ok(!rules.some(r=>r.type==='objectDeleted'));
  assert.ok(!rules.some(r=>r.slideNumber===3));
  const grouped=[{type:'criteriaGroup',title:'完整操作',score:2,scoringMode:'all',children:rules.filter(r=>r.type==='slideCount'||r.type==='textContent')}];
  assert.equal((await gradePptSubmission({studentPath:reference,rules:grouped})).score,10);
  assert.equal((await gradePptSubmission({studentPath:original,rules:grouped})).score,0);
  await fixture(student,{slides:[{body:text('旧第一页')},{body:text('不正确的新内容')},{body:text('旧第二页')}]});
  assert.equal((await gradePptSubmission({studentPath:student,rules:grouped})).score,0);
}));

test('背景图案颜色、表格样式、叠放顺序、取消组合和尺寸',()=>files(async(original,reference,student)=>{
  const positioned=(name,id,width)=>text(name,id).replace('<p:txBody>',`<p:spPr><a:xfrm><a:off x="100" y="200"/><a:ext cx="${width}" cy="4320000"/></a:xfrm></p:spPr><p:txBody>`);
  const table=bold=>`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="10" name="表格"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:pPr algn="ctr"/><a:r><a:rPr b="${bold}"><a:ea typeface="黑体"/><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:rPr><a:t>表格内容</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  const group=`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="组合"/></p:nvGrpSpPr>${positioned('对象A',2,3600000)}</p:grpSp>`;
  await fixture(original,{slides:[{body:group+positioned('对象B',3,3600000)+table(0)}]});
  const background='<p:bg><p:bgPr><a:pattFill prst="pct25"><a:fgClr><a:schemeClr val="bg1"/></a:fgClr><a:bgClr><a:srgbClr val="00B0F0"/></a:bgClr></a:pattFill></p:bgPr></p:bg>';
  const options={slides:[{background,body:positioned('对象B',3,3600000)+positioned('对象A',2,7200000)+table(1)}]};
  await fixture(reference,options);
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
  for(const type of ['backgroundProperty','objectProperty','objectOrder','tableProperty'])assert.ok(rules.some(r=>r.type===type));
  assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
  await fixture(student,{slides:[{body:group+positioned('对象B',3,3600000)+table(0)}]});
  const graded=await gradePptSubmission({studentPath:student,rules});
  assert.equal(graded.results.find(r=>r.type==='objectOrder').passed,false);
  assert.equal(graded.results.find(r=>r.type==='tableProperty').passed,false);
  assert.equal(graded.results.find(r=>r.type==='objectProperty' && r.title.endsWith('组合状态')).passed,false);
}));
test('相同动画数量下识别方向、开始方式、对象和删除动画',()=>files(async(original,reference,student)=>{
  const body=text('标题',2)+text('其他',3);
  await fixture(original,{slides:[{body,timing:timing(2)}]});
  await fixture(reference,{slides:[{body,timing:timing(2,2,'withEffect')}]});
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});assert.ok(rules.some(r=>r.type==='animationObject'));
  assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
  await fixture(student,{slides:[{body,timing:timing(3,2,'withEffect')}]});
  assert.ok((await gradePptSubmission({studentPath:student,rules})).results.filter(r=>r.type==='animationObject').every(r=>!r.passed));
  await fixture(reference,{slides:[{body}]});
  const removal=await generatePptGradeRules({originalPath:original,referencePath:reference});
  assert.ok(removal.some(r=>r.type==='animationObject' && !r.expected.animations.length));
  assert.equal((await gradePptSubmission({studentPath:original,rules:removal})).score,0);
}));
test('同一对象进入与退出动画独立判分，缺少进入不影响退出',()=>files(async(original,reference,student)=>{
 const body=text('舞出生命的第一章');
 const effect=(cls,sound)=>timing(2).match(/<p:par>[\s\S]*<\/p:par>/)[0].replace('presetClass="entr"',`presetClass="${cls}"`).replace('</p:childTnLst>',`<p:audio><p:cMediaNode><p:tgtEl><p:sndTgt name="${sound}"/></p:tgtEl></p:cMediaNode></p:audio></p:childTnLst>`);
 const entrance=effect('entr','风声'),exit=effect('exit','硬币');
 const wrap=effects=>`<p:timing><p:tnLst>${effects}</p:tnLst></p:timing>`;
 await fixture(original,{slides:[{body}]});await fixture(reference,{slides:[{body,timing:wrap(entrance+exit)}]});
 const rules=(await generatePptGradeRules({originalPath:original,referencePath:reference})).filter(r=>r.type==='animationObject');
 for(const property of ['effect','direction','start','sound'])assert.equal(rules.filter(r=>r.expected.property===property).length,2);
 assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
 await fixture(student,{slides:[{body,timing:wrap(exit)}]});
 const results=(await gradePptSubmission({studentPath:student,rules})).results;
 assert.ok(results.filter(r=>r.title.includes('进入')).every(r=>!r.passed));
 assert.ok(results.filter(r=>r.title.includes('退出')).every(r=>r.passed));
 await fixture(student,{slides:[{body,timing:wrap(entrance.replace('风声','错误声音')+exit)}]});
 const changed=(await gradePptSubmission({studentPath:student,rules})).results;
 assert.equal(changed.filter(r=>!r.passed).length,1);
 assert.ok(changed.find(r=>!r.passed).title.includes('进入动画1：声音'));
}));
test('超链接同数量换目标、无切换与删除对象均独立判定',()=>files(async(original,reference,student)=>{
  const relationship=url=>`<Relationship Id="link" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${url}" TargetMode="External"/>`;
  const body=text('科普文',2,1800,'<a:hlinkClick r:id="link"/>');
  await fixture(original,{slides:[{body:body+text('删除我',3),rels:relationship('http://wrong.example'),transition:'<p:transition><p:fade/></p:transition>'}]});
  await fixture(reference,{slides:[{body,rels:relationship('http://www.kepu.gov.cn')}]});
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
  for(const type of ['hyperlink','transitionNone','objectDeleted'])assert.ok(rules.some(r=>r.type===type));
  assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
  const graded=await gradePptSubmission({studentPath:original,rules});
  for(const type of ['hyperlink','transitionNone','objectDeleted'])assert.equal(graded.results.find(r=>r.type===type).passed,false);
}));

test('混合文字逐段检查字号，首段正确不能掩盖第二段错误',()=>files(async(original,reference,student)=>{
  const body=size=>text('第一段',2,1800).replace('</a:p>','<a:r><a:rPr sz="'+size+'"><a:ea typeface="黑体"/></a:rPr><a:t>第二段</a:t></a:r></a:p>');
  await fixture(original,{slides:[{body:body(1800)}]});
  await fixture(reference,{slides:[{body:body(7200)}]});
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
  const fontRule=rules.find(r=>r.type==='textProperty' && r.expected.property==='fontSize');assert.ok(fontRule);
  assert.equal((await gradePptSubmission({studentPath:reference,rules:[fontRule]})).score,10);
  assert.equal((await gradePptSubmission({studentPath:original,rules:[fontRule]})).score,0);
}));

test('仅移动位置不生成得分点，旧坐标规则不计分，宽度仍判定',()=>files(async(original,reference,student)=>{
  const body=(x,width)=>text('标题',2).replace('<p:txBody>',`<p:spPr><a:xfrm><a:off x="${x}" y="200"/><a:ext cx="${width}" cy="1000000"/></a:xfrm></p:spPr><p:txBody>`);
  await fixture(original,{slides:[{body:body(100,1000000)}]});
  await fixture(reference,{slides:[{body:body(9000000,1000000)}]});
  assert.deepEqual(await generatePptGradeRules({originalPath:original,referencePath:reference}),[]);
  await fixture(reference,{slides:[{body:body(9000000,2000000)}]});
  const generated=await generatePptGradeRules({originalPath:original,referencePath:reference});
  assert.ok(generated.some(r=>r.type==='objectProperty' && r.expected.property==='cx' && r.enabled===false));
  const rules=generated.map(r=>({...r,enabled:true}));
  assert.ok(!rules.some(r=>r.type==='objectProperty' && ['x','y'].includes(r.expected.property)));
  await fixture(student,{slides:[{body:body(0,2000000)}]});
  const legacy={type:'objectProperty',title:'旧坐标',score:10,slideNumber:1,expected:{property:'x',value:9000000}};
  const result=await gradePptSubmission({studentPath:student,rules:[...rules,legacy]});
  assert.equal(result.score,10);assert.ok(!result.results.some(r=>r.title==='旧坐标'));
  assert.equal((await gradePptSubmission({studentPath:original,rules})).score,0);
}));

test('图片内容分不受尺寸影响，启用独立宽度项才扣尺寸分',()=>files(async(original,reference,student)=>{
  const pic=width=>`<p:pic><p:nvPicPr><p:cNvPr id="3" name="测试图片"/></p:nvPicPr><p:blipFill><a:blip r:embed="image"/></p:blipFill><p:spPr><a:xfrm><a:off x="100" y="200"/><a:ext cx="${width}" cy="1000000"/></a:xfrm></p:spPr></p:pic>`;
  const rel='<Relationship Id="image" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>';
  await fixture(original,{slides:[{body:text('标题')}]});
  await fixture(reference,{slides:[{body:text('标题')+pic(2000000),rels:rel}]});
  await fixture(student,{slides:[{body:text('标题')+pic(9000000),rels:rel}]});
  const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
  assert.ok(rules.some(r=>r.type==='picture'));
  assert.equal((await gradePptSubmission({studentPath:student,rules})).score,10);
  const size=rules.find(r=>r.type==='objectProperty' && r.expected.property==='cx');
  assert.equal(size.enabled,false);
  const explicit=[rules.find(r=>r.type==='picture'),{...size,enabled:true}];
  const result=await gradePptSubmission({studentPath:student,rules:explicit});
  assert.equal(result.results.find(r=>r.type==='picture').score,1);
  assert.equal(result.results.find(r=>r.type==='objectProperty').score,0);
  assert.equal((await gradePptSubmission({studentPath:student,rules:[explicit[0],{...explicit[1],score:2}]})).score,3.33);
}));

test('单纯移动幻灯片不自动生成顺序得分点',()=>files(async(original,reference)=>{
 const slides=['甲页','乙页','丙页'].map(title=>({body:text(title)}));
 await fixture(original,{slides});await fixture(reference,{slides,order:[3,1,2]});
 assert.deepEqual(await generatePptGradeRules({originalPath:original,referencePath:reference}),[]);
}));
const mediaPicture=(id=7)=>`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="视频${id}"/><p:nvPr><a:videoFile r:link="videoLink"/><p:extLst><p:ext><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="mediaEmbed"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="poster"/></p:blipFill></p:pic>`;
const mediaRelationships=`<Relationship Id="videoLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="../media/video1.mp4"/><Relationship Id="mediaEmbed" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/video1.mp4"/><Relationship Id="poster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>`;
const mediaTiming=(id=7,start='afterEffect',loop=true)=>`<p:par><p:cTn id="${id}" presetClass="mediacall" presetID="1" nodeType="${start}"><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par><p:video><p:cMediaNode showWhenStopped="0"><p:cTn id="${id+10}" ${loop?'repeatCount="indefinite"':''}><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl></p:cMediaNode></p:video>`;
test('音频跨页默认只判是否跨页，具体范围需启用，自动和循环不能代替跨页',()=>files(async(original,reference,student)=>{
 const options=count=>({slides:[{body:mediaPicture().replaceAll('videoFile','audioFile'),rels:mediaRelationships.replaceAll('/video"','/audio"').replaceAll('video1.mp4','audio1.mp3'),timing:'<p:timing><p:tnLst>'+mediaTiming().replaceAll('p:video','p:audio').replace('<p:cMediaNode ',`<p:cMediaNode numSld="${count}" `)+'</p:tnLst></p:timing>'}],mediaFiles:{'audio1.mp3':'same audio'}});
 await fixture(original,options(1));await fixture(reference,options(3));
 const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
 assert.equal(rules.find(r=>r.type==='mediaSlideCount').enabled,false);
 assert.ok(rules.some(r=>r.type==='mediaAcrossSlides'));
 await fixture(student,options(5));assert.equal((await gradePptSubmission({studentPath:student,rules})).score,10);
 const exact=rules.filter(r=>r.type==='mediaSlideCount').map(r=>({...r,enabled:true}));
 assert.equal((await gradePptSubmission({studentPath:student,rules:exact})).score,0);
 assert.equal((await gradePptSubmission({studentPath:reference,rules:exact})).score,10);
 assert.equal((await gradePptSubmission({studentPath:original,rules})).score,0);
 assert.equal((await analyzePptx(reference)).slides[0].media[0].slideCount,3);
 assert.deepEqual(await generatePptGradeRules({originalPath:reference,referencePath:reference}),[]);
}));
test('同一视频的link和embed只生成一套得分点，封面不另判图片分',()=>files(async(original,reference,student)=>{
 await fixture(original,{slides:[{body:text('视频课')}]});
 const options={slides:[{body:text('视频课')+mediaPicture(),rels:mediaRelationships,timing:'<p:timing><p:tnLst>'+mediaTiming()+'</p:tnLst></p:timing>'}],mediaFiles:{'video1.mp4':'video bytes'}};
 await fixture(reference,options);const analysis=await analyzePptx(reference);assert.equal(analysis.slides[0].media.length,1);assert.equal(analysis.slides[0].pictures.length,0);assert.equal(analysis.slides[0].media[0].playMode,'auto');
 const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});
 assert.equal(rules.filter(r=>r.type==='mediaFile').length,1);assert.equal(rules.filter(r=>r.type==='mediaPlayMode').length,1);assert.equal(rules.filter(r=>r.type==='animationObject').length,0);assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
 options.slides[0].rels=mediaRelationships.replaceAll('video1.mp4','renamed.mp4');options.mediaFiles['renamed.mp4']='video bytes';await fixture(student,options);assert.equal((await gradePptSubmission({studentPath:student,rules})).score,10);
 options.slides[0].rels=mediaRelationships;
 options.slides[0].timing='<p:timing><p:tnLst>'+mediaTiming(7,'clickEffect',false)+'</p:tnLst></p:timing>';await fixture(student,options);
 const graded=await gradePptSubmission({studentPath:student,rules});assert.equal(graded.results.find(r=>r.type==='mediaPlayMode').score,0);assert.equal(graded.results.find(r=>r.type==='mediaLoop').score,0);assert.equal(graded.results.find(r=>r.type==='mediaFile').score,1);
 const changes=await generatePptGradeRules({originalPath:student,referencePath:reference});assert.deepEqual(changes.filter(r=>r.type.startsWith('media')).map(r=>r.type).sort(),['mediaLoop','mediaPlayMode']);
}));
test('两个独立视频对象保留两套要求，播放与循环按各自对象检查',()=>files(async(original,reference,student)=>{
 await fixture(original,{slides:[{body:text('两个视频')}]});
 const options={slides:[{body:text('两个视频')+mediaPicture(7)+mediaPicture(8),rels:mediaRelationships,timing:'<p:timing><p:tnLst>'+mediaTiming(7,'afterEffect',true)+mediaTiming(8,'clickEffect',false)+'</p:tnLst></p:timing>'}],mediaFiles:{'video1.mp4':'video bytes'}};
 await fixture(reference,options);const analysis=await analyzePptx(reference);assert.equal(analysis.slides[0].media.length,2);assert.deepEqual(analysis.slides[0].media.map(m=>[m.playMode,m.loop]),[['auto',true],['click',false]]);
 const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});assert.equal(rules.filter(r=>r.type==='mediaFile').length,2);assert.equal((await gradePptSubmission({studentPath:reference,rules})).score,10);
 options.slides[0].timing='<p:timing><p:tnLst>'+mediaTiming(7,'afterEffect',true)+mediaTiming(8,'afterEffect',true)+'</p:tnLst></p:timing>';await fixture(student,options);
 const graded=await gradePptSubmission({studentPath:student,rules});assert.equal(graded.results.filter(r=>r.type==='mediaLoop' && r.passed).length,1);assert.equal(graded.results.filter(r=>r.type==='mediaPlayMode' && r.passed).length,1);
}));
test('母版图片按指定页应用比例给分，并标明未通过的页码',()=>files(async(original,reference,student)=>{
 await fixture(original,{slides:[{},{}]});await fixture(reference,{slides:[{},{}]});await fixture(student,{slides:[{},{}]});
 const update=async(file,partial)=>{const zip=await JSZip.loadAsync(await fs.readFile(file));
  zip.file('ppt/slideMasters/slideMaster1.xml',`<p:sldMaster ${ns}><p:cSld><p:spTree><p:pic><p:nvPicPr><p:cNvPr id="5" name="母版图片"/></p:nvPicPr><p:blipFill><a:blip r:embed="image"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sldMaster>`);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels','<Relationships><Relationship Id="image" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
  if(partial)zip.file('ppt/slideMasters/slideMaster2.xml',`<p:sldMaster ${ns}><p:cSld><p:spTree/></p:cSld></p:sldMaster>`);
  for(let i=1;i<=2;i++)zip.file('ppt/slideLayouts/_rels/slideLayout'+i+'.xml.rels',`<Relationships><Relationship Id="master" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster${partial && i===2?2:1}.xml"/></Relationships>`);
  await fs.writeFile(file,await zip.generateAsync({type:'nodebuffer'}));};
 await update(reference,false);await update(student,true);const rules=await generatePptGradeRules({originalPath:original,referencePath:reference});const graded=await gradePptSubmission({studentPath:student,rules});
 const result=graded.results.find(r=>r.type==='masterPicture');assert.equal(result.score,0.5);assert.equal(result.maxScore,1);assert.match(result.message,/1\/2/);assert.match(result.message,/第2张/);
}));
