// Math (#282): how long is a stick bent to the top-chord curve, how tight is the bend, and how far is it from the straight-piece model?
// Usage: TE_ROOT=<app dir> node arc.js <bridge.json ...>
const R=process.env.TE_ROOT, C=require(R+'/src/core.js'), L=require(R+'/tests/lib.js'), fs=require('fs');
// the app's curve (core.js bottomY, copied so this is independent of buildTruss's node placement)
function catA(h,d){let lo=Math.log(h/700),hi=Math.log(1e9);for(let i=0;i<200;i++){const m=(lo+hi)/2,a=Math.exp(m);if(a*(Math.cosh(h/a)-1)>d)lo=m;else hi=m}return Math.exp((lo+hi)/2)}
function y(x,S,shape,c){const d=Math.abs(c),sg=c<0?-1:1,h=S/2,u=x-h;let m;if(shape==='arc'){const Rr=(h*h+d*d)/(2*d);m=Math.sqrt(Rr*Rr-u*u)-(Rr-d)}else if(shape==='catenary'){const a=catA(h,d);m=a*(Math.cosh(h/a)-Math.cosh(u/a))}else m=d*(1-(u/h)**2);return sg*m}
for (const f of process.argv.slice(2)) {
  const j=JSON.parse(fs.readFileSync(f,'utf8')), S0=Object.assign({},L.DEFAULT,j.bridge), tr=C.buildTruss(L.design(S0)), b=+S0.mat.b||3.18;
  const top=tr.elems.map((e,k)=>({e,k})).filter(q=>q.e.type==='top');
  const xs=[...new Set(top.flatMap(q=>[q.e.i,q.e.j]))].map(n=>tr.nodes[n]).sort((a,c)=>a[0]-c[0]);
  const H=+S0.height, te=+S0.topEnd, S=200, shape=S0.topShape, Y=x=>te+y(x,S,shape,H-te);
  // only the curved run: joints with 0 < x < S (over the desks the chord is flat)
  const cur=xs.filter(p=>p[0]>-1e-6&&p[0]<S+1e-6); const x0=cur[0][0], x1=cur[cur.length-1][0];
  const chords=cur.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-cur[i][0],p[1]-cur[i][1]),0);
  let arc=0,kmax=0,N=20000; for(let i=0;i<N;i++){const a=x0+(x1-x0)*i/N,c=x0+(x1-x0)*(i+1)/N;arc+=Math.hypot(c-a,Y(c)-Y(a));}
  for(let i=1;i<N;i++){const x=x0+(x1-x0)*i/N,hh=1e-3,y1=(Y(x+hh)-Y(x-hh))/(2*hh),y2=(Y(x+hh)-2*Y(x)+Y(x-hh))/hh**2;kmax=Math.max(kmax,Math.abs(y2)/(1+y1*y1)**1.5);}
  const maxDev=cur.slice(1).reduce((m,p,i)=>{const q=cur[i];let d=0;for(let t=1;t<50;t++){const x=q[0]+(p[0]-q[0])*t/50,yl=q[1]+(p[1]-q[1])*t/50;d=Math.max(d,Math.abs(Y(x)-yl))}return Math.max(m,d)},0);
  const joints=cur.map(p=>Math.abs(p[1]-Y(p[0]))).reduce((a,c)=>Math.max(a,c),0);
  // angle between chord direction and curve tangent at each interior joint (what changes the flush cuts of the members meeting it)
  let tang=0; cur.forEach((p,i)=>{if(i===0||i===cur.length-1)return;const sl=(Y(p[0]+1e-3)-Y(p[0]-1e-3))/2e-3,t=Math.atan(sl);[cur[i-1],cur[i+1]].forEach(q=>{const a=Math.atan2(q[1]-p[1],q[0]-p[0]);let d=Math.abs(((a-t)*180/Math.PI)%180);d=Math.min(d,180-d);tang=Math.max(tang,d)})});
  console.log(`${f}: ${shape}, rise ${(H-te).toFixed(1)} mm, curved run x ${x0.toFixed(1)}..${x1.toFixed(1)} (${cur.length} joints, joints on the curve to ${joints.toExponential(1)} mm)`);
  console.log(`  sum of straight chords ${chords.toFixed(2)} mm; centre-line arc ${arc.toFixed(2)} mm (+${(arc-chords).toFixed(2)} mm, ${(100*(arc/chords-1)).toFixed(2)}%)`);
  console.log(`  bent stick sits off the straight chord by up to ${maxDev.toFixed(2)} mm between joints; members meet the bent stick up to ${tang.toFixed(1)}° off the chord direction`);
  // turning angle of the curve over the run -> outer vs inner face length difference = b*Δθ
  const th=x=>Math.atan((Y(x+1e-3)-Y(x-1e-3))/2e-3), dth=Math.abs(th(x1-1e-3)-th(x0+1e-3)); console.log(`  total turning ${(dth*180/Math.PI).toFixed(1)}°: outer face is ${(b*dth).toFixed(2)} mm longer than the inner face`);
}
