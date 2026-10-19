// Single-tag prototype: matches the actual tag36h11 ID 0 pattern.
// Detection is intentionally limited to the printed frog tag.
export const bits=[[1,1],[2,1],[3,1],[4,1],[5,1],[2,2],[3,2],[4,2],[3,3],[6,1],[6,2],[6,3],[6,4],[6,5],[5,2],[5,3],[5,4],[4,3],[6,6],[5,6],[4,6],[3,6],[2,6],[5,5],[4,5],[3,5],[4,4],[1,6],[1,5],[1,4],[1,3],[1,2],[2,5],[2,4],[2,3],[3,4]];
export function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);let n=b.length;for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;if(Math.abs(a[p][i])<1e-10)return null;[a[i],a[p]]=[a[p],a[i]];let q=a[i][i];for(let k=i;k<=n;k++)a[i][k]/=q;for(let j=0;j<n;j++)if(j!==i){q=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=q*a[i][k];}}return a.map(r=>r[n]);}
export function homography(q){const a=[],b=[];[[0,0],[1,0],[1,1],[0,1]].forEach(([x,y],i)=>{let [u,v]=q[i];a.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);b.push(u,v);});return solve(a,b);}
function project(h,x,y){let z=h[6]*x+h[7]*y+1;return [(h[0]*x+h[1]*y+h[2])/z,(h[3]*x+h[4]*y+h[5])/z];}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let l=[],u=[];for(let p of points){while(l.length>1&&cross(l.at(-2),l.at(-1),p)<=0)l.pop();l.push(p);}for(let p of points.reverse()){while(u.length>1&&cross(u.at(-2),u.at(-1),p)<=0)u.pop();u.push(p);}return l.slice(0,-1).concat(u.slice(0,-1));}
export function detect(gray,w,h){
 const hist=new Uint32Array(256);let sum=0;for(let a of gray){hist[a]++;sum+=a;}let b=0,s=0,best=0,t=100;for(let i=0;i<255;i++){b+=hist[i];s+=i*hist[i];if(!b||b===gray.length)continue;let d=s/b-(sum-s)/(gray.length-b),v=b*(gray.length-b)*d*d;if(v>best){best=v;t=i;}}
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let results=[];
 for(let seed=0;seed<gray.length;seed++){
  if(seen[seed]||gray[seed]>t)continue;let head=0,tail=1;queue[0]=seed;seen[seed]=1;let boundary=[],edge=false;
  while(head<tail){let p=queue[head++],x=p%w,y=(p/w)|0,bd=false;if(x===0||x===w-1||y===0||y===h-1)edge=true;for(let n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]){if(n<0||gray[n]>t){bd=true;continue;}if(!seen[n]){seen[n]=1;queue[tail++]=n;}}if(bd)boundary.push([x,y]);}
  if(tail<100||edge||boundary.length<20)continue;let q=hull(boundary);if(q.length<4)continue;
  while(q.length>4){let index=0,min=Infinity;for(let i=0;i<q.length;i++){let v=Math.abs(cross(q[(i+q.length-1)%q.length],q[i],q[(i+1)%q.length]));if(v<min){min=v;index=i;}}q.splice(index,1);}
  let area=Math.abs(q.reduce((s,p,i)=>s+p[0]*q[(i+1)%4][1]-p[1]*q[(i+1)%4][0],0))/2;
  if(area<700||tail/area<.15||tail/area>.95)continue;
  for(let rot=0;rot<4;rot++){let corners=q.slice(rot).concat(q.slice(0,rot));let H=homography(corners);if(!H)continue;let errors=0,border=0;
   for(let y=0;y<8;y++)for(let x=0;x<8;x++){let [px,py]=project(H,(x+.5)/8,(y+.5)/8);let value=gray[Math.round(py)*w+Math.round(px)]>t?1:0;if(x===0||y===0||x===7||y===7)border+=value;}
   for(let i=0;i<36;i++){let [x,y]=bits[i],[px,py]=project(H,(x+.5)/8,(y+.5)/8);let value=gray[Math.round(py)*w+Math.round(px)]>t?1:0;let expected=Number((0xD7E00984Bn>>BigInt(35-i))&1n);errors+=value!==expected;}
   if(errors<=1&&border<=2){results.push({id:0,corners,H,area});break;}
  }
 }
 return results.sort((a,b)=>b.area-a.area)[0]||null;
}
