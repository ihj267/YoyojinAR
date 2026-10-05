// Presentation only: never extrapolate points beyond the current mural target.
// Matrix filtering in MindAR remains unchanged. Fresh observations, rather than
// render frames, populate this median so a single bad pose is not counted twice.
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function createStablePins({holdMs=200,deadband=1.5}={}) {
  let source=null,revision=null,viewport='',samples=0,firstAt=0,lastSample=0,lastFrame=null,lostAt=null;
  let pins=new Map(),shown=new Set();
  function reset() {
    source=null;revision=null;viewport='';samples=0;lastFrame=null;lostAt=null;
    pins.clear();shown.clear();
  }
  return {
    reset,
    observe({target,sequence,points,now,width,height}) {
      const size=`${width}x${height}`;
      if(source!==target||viewport!==size||(lostAt!==null&&now-lostAt>holdMs)||now-lastSample>1000){
        reset();source=target;viewport=size;firstAt=now;
      }
      if(revision===sequence)return;
      revision=sequence;lastSample=now;lostAt=null;samples++;
      const present=new Set();
      for(const point of points){
        if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
        present.add(point.id);
        let pin=pins.get(point.id);
        if(!pin){pin={id:point.id,x:point.x,y:point.y,gx:point.x,gy:point.y,xs:[],ys:[]};pins.set(point.id,pin);}
        pin.xs.push(point.x);pin.ys.push(point.y);
        if(pin.xs.length>3){pin.xs.shift();pin.ys.shift();}
        pin.gx=median(pin.xs);pin.gy=median(pin.ys);
        // Before initial acquisition, start at the robust estimate; don't fly
        // through the screen from an earlier target or a bad first observation.
        if(samples<=3){pin.x=pin.gx;pin.y=pin.gy;}
      }
      for(const id of pins.keys())if(!present.has(id)){pins.delete(id);shown.delete(id);}
    },
    lose(now) { if(source!==null&&lostAt===null)lostAt=now; },
    frame({now,left,right,top,bottom,reduceOverlap=false}) {
      if(source===null)return [];
      if((lostAt!==null&&now-lostAt>holdMs)||now-lastSample>1000){reset();return [];}
      const dt=lastFrame===null?1/60:Math.max(0,Math.min(.1,(now-lastFrame)/1000));
      lastFrame=now;
      if(samples<3||lastSample-firstAt<60)return [];
      const candidates=[];
      for(const pin of pins.values()){
        const dx=pin.gx-pin.x,dy=pin.gy-pin.y,distance=Math.hypot(dx,dy);
        if(distance>deadband){
          const tau=distance<18?.1:.04,alpha=1-Math.exp(-dt/tau);
          pin.x+=dx*alpha;pin.y+=dy*alpha;
        }
        if(pin.x<left||pin.x>right||pin.y<top||pin.y>bottom)continue;
        candidates.push({id:pin.id,x:pin.x,y:pin.y,interactive:lostAt===null});
      }
      // No numerical ceiling. In the optional tidy view, retained pins win and
      // newcomers need extra clearance, avoiding a flicker at the old 48px edge.
      candidates.sort((a,b)=>(reduceOverlap?Number(shown.has(b.id))-Number(shown.has(a.id)):0)||a.id.localeCompare(b.id));
      const result=[];
      for(const pin of candidates){
        const gap=shown.has(pin.id)?40:52;
        if(reduceOverlap&&result.some(other=>Math.hypot(pin.x-other.x,pin.y-other.y)<gap))continue;
        result.push(pin);
      }
      shown=new Set(result.map(pin=>pin.id));
      return result;
    }
  };
}
