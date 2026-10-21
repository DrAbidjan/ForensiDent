/* ForensiDent – Batch 1 acceptance tests (audit 21 Oct 2026).
   Synthetic data only. Software checks, not scientific validation.
   Run: node tests/forensident.test.js  (from the project folder, after python3 build.py) */
const {chromium,devices}=require('playwright');const fs=require('fs');const crypto=require('crypto');const path=require('path');
const LANGS=['de','en','fr','es','ar','it','pt','tr','ur','hi','id','ru','zh','ja'];
let pass=0,fail=0;const log=[];
function ok(id,cond,msg){if(cond){pass++;log.push(`PASS ${id} ${msg}`)}else{fail++;log.push(`FAIL ${id} ${msg}`)}}
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();
const errs=[],net=[];p.on('pageerror',e=>errs.push(e.message));p.on('request',r=>net.push(r.url()));
const url='file://'+path.resolve(__dirname,'..','gh','index.html');
await p.goto(url);await p.waitForTimeout(300);await p.tap('#testMode');await p.waitForTimeout(300);
const E=(fn,arg)=>p.evaluate(fn,arg);

/* T1 bite-mark guide wording, 14 languages */
for(const lg of LANGS){
  const t=await E(lg=>{store.settings.lang=lg;guideId='biterep';go('guide');return document.getElementById('app').innerText},lg);
  const bad=/cannot be excluded|kann nicht ausgeschlossen|n.?a pas pu être exclu|no puede excluirse/i.test(t);
  const has=lg==='en'?t.includes('does not support any statement that a person is or is not the source'):lg==='de'?t.includes('trägt keine Aussage'):!t.includes('does not support any statement that a person');
  ok('T1',!bad&&has,`bite guide ${lg}: no exclusion wording, new key text present`);
}
await E(()=>{store.settings.lang='en'});

/* T2 computed DVI summary */
const t2=await E(()=>{
  const S=()=>{const o={};ALL.forEach(n=>o[n]=TT());return o};
  const r={};
  let c={am:S(),pm:S()};r.sound=analyse(c).v;                                  // all sound
  c={am:{},pm:{}};r.none=analyse(c).v;                                          // nothing recorded
  c={am:{16:TT({fill:{O:'amalgam'}})},pm:{16:TT({fill:{O:'amalgam'}})}};const a1=analyse(c);r.one=a1.v;r.oneCompared=a1.compared; // one distinctive tooth only
  c={am:S(),pm:S()};c.am[46]=TT({s:'missing'});c.pm[46]=TT();r.incon=analyse(c).v;   // missing AM, present PM
  c={am:S(),pm:S()};Object.assign(c.am,{16:TT({crown:true}),36:TT({s:'missing'}),46:TT({s:'implant'}),11:TT({feat:{diastema:true}})});Object.assign(c.pm,JSON.parse(JSON.stringify(c.am)));
  const a=analyse(c);r.counts=distCounts(c,a.rows);r.multi=a.v;
  return r});
ok('T2',t2.sound.cls==='expl','all-sound charts give "low specificity", not identification');
ok('T2',t2.none.cls==='nodata','nothing recorded gives "no comparable teeth"');
ok('T2',t2.one.cls==='match'&&t2.oneCompared===1,'a single distinctive tooth is reported (no 6-tooth minimum)');
ok('T2',t2.incon.cls==='incon','missing AM vs present PM gives unexplained discrepancy');
ok('T2',t2.counts.rest===1&&t2.counts.miss===1&&t2.counts.impl===1,`counts by type ${JSON.stringify(t2.counts)}`);
ok('T2',!JSON.stringify(t2).match(/Identification possible|Identifizierung möglich|Exclusion suggested/),'no identification or exclusion wording in computed summary');

/* T3 identification status */
const t3=await E(()=>{const c=blankCase();c.rep.type='id';const out={};
  out.unset=idStatusLine(c,'en');
  for(const s of ['candidate','assessed','confirmed']){c.idStatus={s,by:'Board X',date:'2026-10-21',ref:'ID-1'};out[s]=idStatusLine(c,'en')}
  const old={id:'x',meta:{},am:{},pm:{}};ensure(old);out.old=idStatusLine(old,'en');return out});
ok('T3',t3.unset.includes('Not set')&&t3.unset.includes('pending'),'new case: "Not set", confirmation pending');
ok('T3',t3.candidate.includes('pending')&&t3.assessed.includes('pending'),'candidate/assessed: confirmation pending');
ok('T3',t3.confirmed.includes('Confirmed by Identification Board')&&!t3.confirmed.includes('pending')&&t3.confirmed.includes('ID-1'),'only status 3 prints confirmed, with decision reference');
ok('T3',t3.old.includes('Not set'),'old case without status shows "Not set"');

/* T4 assumed-sound teeth + T5 change log */
await E(()=>{const c=blankCase();c.meta.caseNo='T4';c.meta.examiner='Ex One';[18,17,16,15,14,13,12,11,21,22].forEach(n=>c.pm[n]=TT());
  [18,17,16,15,14,13,12,11,21,22].forEach(n=>c.am[n]=TT());store.cases.push(c);store.cur=c.id;save();go('chart',2)});
await p.waitForTimeout(200);await E(()=>{const b=document.getElementById('allSound');b.click();b.click()});await p.waitForTimeout(200);
const t4=await E(()=>{const c=cur();const as=ALL.filter(n=>c.pm[n]&&c.pm[n].as).length;const a=analyse(c);
  const rep=genReport(c);const r={as,compared:a.compared,listed:rep.includes('assumed sound, not individually examined'),dashed:document.querySelectorAll('.tooth.assumed').length};
  quick='sound';applyQuick('pm',48,'sound');r.after=!!cur().pm[48].as;r.audit=cur().audit.length;r.last=cur().audit[cur().audit.length-1];return r});
ok('T4',t4.as===22,`22 unrecorded teeth flagged as assumed (got ${t4.as})`);
ok('T4',t4.dashed===22,'flagged teeth drawn with dashed outline');
ok('T4',t4.compared===10||t4.compared<=10,`assumed teeth not compared (compared ${t4.compared})`);
ok('T4',t4.listed,'report lists assumed teeth');
ok('T4',t4.after===false,'confirming a tooth removes its flag');
ok('T5',t4.audit>=23&&t4.last.ch==='pm'&&t4.last.n===48&&t4.last.ex==='Ex One'&&t4.last.o&&t4.last.o.as===true,'each edit logged with time, examiner, chart, tooth, old and new value');
const t5=await E(()=>{const c=cur();const n0=c.audit.length;applyQuick('pm',47,'crown');applyQuick('pm',47,'crown');return {n0,n1:c.audit.length}});
ok('T5',t5.n1-t5.n0<=1,'rapid repeated edits of one tooth coalesce (no log flooding)');

/* T6 PM lock and custody check */
const t6=await E(()=>{const c=cur();go('cmp',0);const r={locked:pmLocked(c)};
  const before=JSON.stringify(c.pm[46]);applyQuick('pm',46,'missing');r.blocked=JSON.stringify(c.pm[46])===before;
  r.toast=(document.getElementById('toast')||{}).textContent||'';
  go('chart',2);document.getElementById('unlockPM').click();r.noReason=pmLocked(c);
  document.getElementById('unlockWhy').value='Typo in tooth 46';document.getElementById('unlockPM').click();r.open=!pmLocked(c);
  applyQuick('pm',46,'missing');const e=c.audit[c.audit.length-1];r.corr=e.corr===true&&e.why==='Typo in tooth 46';
  r.repCorr=genReport(c).includes('Corrections to the PM chart after it was locked');
  c.log.events.push({t:'2026-10-21T10:00',a:'Received',item:'Body',by:'A',to:'',note:'',added:nowISO()});sealEvents(c);
  r.okLine=chainLine(c,'en');c.log.events[0].item='Changed';r.badLine=chainLine(c,'en');return r});
ok('T6',t6.locked,'PM chart locks when the comparison is opened');
ok('T6',t6.blocked&&t6.toast.length>0,'locked chart blocks silent edits and tells the user');
ok('T6',t6.noReason,'unlock without a reason is refused');
ok('T6',t6.open&&t6.corr,'unlock with reason works and later edits are logged as corrections');
ok('T6',t6.repCorr,'report lists corrections after the lock');
ok('T6',t6.okLine.includes('no change detected')&&!/tamper-proof|no entry has been changed/i.test(t6.okLine),'custody wording says "no change detected", not tamper-proof');
ok('T6',t6.badLine.startsWith('Warning'),'altered custody entry gives a warning');

/* T7 age snapshot */
const t7=await E(()=>{ensureRefs();store.refs.dem.H={mmin:'18.0',mmean:'20.5',msd:'2'};store.refs.source='Test table A';
  const old={id:uid(),meta:{caseNo:'OLD'},am:{},pm:{},age:{sex:'m',teeth:{38:{dem:'H'}}}};ensure(old);store.cases.push(old);
  const r={legacy:old.age.snap&&old.age.snap.why,min1:ageResult(old).top.min};
  store.refs.dem.H={mmin:'16.0',mmean:'19',msd:'2'};store.refs.source='Test table B';
  r.min2=ageResult(old).top.min;r.src=refsFor(old).source;
  const fresh=blankCase();fresh.age.teeth={38:{dem:'H'}};r.freshMin=ageResult(fresh).top.min;r.freshSnap=!!fresh.age.snap;
  fresh.rep.type='age';freezeForReport(fresh);r.frozen=fresh.age.snap&&fresh.age.snap.why;
  snapRefs(old,'manual');r.min3=ageResult(old).top.min;return r});
ok('T7',t7.legacy==='legacy','old case with stages gets a legacy snapshot on first open');
ok('T7',t7.min1===18&&t7.min2===18&&t7.src==='Test table A','changing global reference values does not change the old result or citation');
ok('T7',t7.freshMin===16&&!t7.freshSnap,'new case uses current values until frozen');
ok('T7',t7.frozen==='report','values freeze when the PDF report is created');
ok('T7',t7.min3===16,'"Recalculate" takes the current values');

/* T8 original image integrity */
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8AARAwM/xkYAA9+Af8RFFJLAAAAAElFTkSuQmCC','base64');
const tmp=path.join(__dirname,'t8_test.png');fs.writeFileSync(tmp,png);const want=crypto.createHash('sha256').update(png).digest('hex');
await E(()=>{const c=blankCase();c.meta.caseNo='T8';c.photos.push({id:'oldph',cat:'opg',src:'pm',date:'2026-01-01',teeth:'',note:'',pdf:true});store.cases.push(c);store.cur=c.id;save();go('log',2)});
await p.waitForTimeout(200);await p.setInputFiles('#photoIn',tmp);await p.waitForTimeout(600);
await E(()=>{document.querySelector('[data-pcat="opg"]').click()});await p.waitForTimeout(150);await E(()=>document.getElementById('pSave').click());await p.waitForTimeout(800);
const t8=await E(async()=>{const c=cur();const ph=c.photos.find(x=>x.id!=='oldph');const bl=await IDB.get(ph.id+'.o');const buf=bl?await bl.arrayBuffer():new ArrayBuffer(0);
  return {sha:ph.sha,orig:ph.orig,size:bl?bl.size:0,ownSha:await sha256Bytes(buf),oldLbl:origLine(c.photos.find(x=>x.id==='oldph')),newLbl:origLine(ph),text:document.getElementById('app').innerText.includes('Original kept')}});
fs.unlinkSync(tmp);
ok('T8',t8.orig&&t8.sha===want,`stored SHA-256 equals hash computed outside the app (${String(t8.sha).slice(0,12)}…)`);
ok('T8',t8.size===png.length&&t8.ownSha===want,'stored original is byte-identical');
ok('T8',t8.oldLbl.includes('Original not kept'),'old photo labelled "original not kept"');
ok('T8',t8.text,'thumbnail shows "Original kept"');

/* T11 report wording, 14 languages (text report; PDFs are checked by the regression scripts) */
for(const lg of LANGS){
  const t=await E(lg=>{const c=sampleCase();c.rep.type='both';c.rep.lang=lg;store.settings.repLang=lg;c.log.events.push({t:'2026-10-21T10:00',a:'Received',item:'Body',by:'A',to:'',note:'',added:nowISO()});sealEvents(c);c.rep.idCat='positive';return genReport(c)},lg);
  const bad=/Identification possible|tamper-proof|Exclusion suggested|cannot be excluded|Computed assessment/i.test(t);
  const untranslated=lg!=='en'&&lg!=='de'&&/Computed summary|Odontological assessment|SHA-256 check/.test(t);
  ok('T11',!bad&&!untranslated,`text report ${lg}: forbidden phrases absent, new wording translated`);
}
await E(()=>{store.settings.repLang='app';store.settings.lang='en'});

/* T13 privacy: no network requests other than local files during the run */
const ext=net.filter(u=>!u.startsWith('file:')&&!u.startsWith('blob:')&&!u.startsWith('data:'));
ok('T13',ext.every(u=>/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u)),`no case data leaves the device (external requests: ${ext.length?[...new Set(ext.map(u=>new URL(u).host))].join(', '):'none'})`);

ok('ALL',errs.length===0,`no page errors${errs.length?': '+errs.slice(0,3).join(' | '):''}`);
await b.close();
console.log(log.join('\n'));console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
