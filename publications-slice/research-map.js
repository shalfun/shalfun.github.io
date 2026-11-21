/* A small, dependency-free 3D scene: perspective projection, topic volumes and paper nodes. */
(() => {
  const TAU = Math.PI * 2;
  const axisScale=[1.15,1,1.9], cameraDistance=24;
  const ringCircle=Array.from({length:32},(_,i)=>[Math.cos(i*TAU/32),Math.sin(i*TAU/32)]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smoothstep=(low,high,value)=>{const t=clamp((value-low)/(high-low),0,1);return t*t*(3-2*t);};
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  // Every topic occupies a volume in this one XYZ space. Paper positions satisfy
  // ALL of their memberships, including exclusion from unrelated topic volumes.
  const regionSpecs = {
    "3d": {center: [-1.2, 1.15, -1.25], radius: [2.6, 2, 1.9]},
    media: {center: [-1.5, -.15, 1.5], radius: [2.5, 1.7, 2]},
    worldmodel: {center: [-.4, -.4, -.1], radius: [2.8, 1.9, 2.1]},
    embodied: {center: [1.3, .7, -.1], radius: [2.4, 1.9, 1.9]},
    robotics: {center: [1.3, .2, -.45], radius: [1.95, 1.9, 1.7]},
    llm: {center: [.4, -.15, -.65], radius: [1.8, 3.1, .8]},
    infra: {center: [3.3, 1.1, 1.15], radius: [1.3, 1.5, 1.3]},
    driving: {center: [-1.15, -2, .25], radius: [2.1, 2.1, 1.85]},
  };
  // Map-only abbreviations; full titles remain in the inspector and accessible names.
  const abbreviations={
    "generation-models-know-space":"GMKS", "visual-in-context-learning":"Visual ICL",
    "support-effective-3d":"SE-3D", "drag-your-gaussian":"DYG",
    "when-numbers-speak":"WNS", "360-video-generation":"OmniPano",
    "world-models-for-ad":"WM for AD", "probabilistic-decisions":"Prob. Decisions",
    "visual-specialists":"Vis. Specialists", "vision-remember":"Vis. Remember",
    "revisiting-mllms":"Revisit-MLLMs",
  };
  const defaultView = {yaw: -.25, pitch: -.2, zoom: 1};
  // A persistent contour parameter for each badge. Never reselect a vertex or
  // an outer slot as the camera turns, including when ellipse axes cross.
  const topicAngles={"3d":-140,media:-175,llm:-90,infra:-45,embodied:-30,robotics:40,driving:95,worldmodel:130};
  const metric = (point, region) => point.reduce((sum, value, axis) => sum + ((value-region.center[axis])/region.radius[axis])**2, 0);
  const halton = (index, base) => {let value=0, fraction=1;while(index){fraction/=base;value+=fraction*(index%base);index=Math.floor(index/base);}return value;};
  function rotate(point, view) {
    const [x,y,z]=point.map((v,i)=>v*axisScale[i]),cy=Math.cos(view.yaw),sy=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
    const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*cp-zz*sp,depth=y*sp+zz*cp,k=cameraDistance/(cameraDistance-depth);
    return {x:xx*k,y:yy*k,z:depth,k};
  }
  function layout(projects, themes) {
    const regions=themes.map(theme=>({...theme,...regionSpecs[theme.id]}));
    const signatures=new Map();
    projects.forEach(project=>{const key=project.themes.slice().sort().join("|");if(!signatures.has(key))signatures.set(key,[]);signatures.get(key).push(project);});
    const placed=[];
    // Place the most constrained intersections first, then spread papers inside
    // each feasible region. Resizing or selecting topics never changes XYZ.
    for(const [signature,papers] of [...signatures].sort((a,b)=>b[0].split("|").length-a[0].split("|").length||a[0].localeCompare(b[0]))){
      const members=signature.split("|"),inside=regions.filter(region=>members.includes(region.id));
      const lower=[0,1,2].map(axis=>Math.max(...inside.map(r=>r.center[axis]-r.radius[axis])));
      const upper=[0,1,2].map(axis=>Math.min(...inside.map(r=>r.center[axis]+r.radius[axis])));
      const candidates=[];
      for(let i=1;i<=6000;i++){
        const point=[2,3,5].map((base,axis)=>lower[axis]+halton(i,base)*(upper[axis]-lower[axis]));
        const margin=Math.min(...regions.map(region=>members.includes(region.id)?1-metric(point,region):metric(point,region)-1));
        if(margin>.035)candidates.push({point,margin,screen:rotate(point,defaultView)});
      }
      if(!candidates.length)throw new Error(`No valid topic intersection for ${signature}`);
      const cutoff=Math.min(.15,Math.max(...candidates.map(c=>c.margin))*.5),choices=candidates.filter(c=>c.margin>=cutoff);
      for(const project of papers){
        let best=null,score=-Infinity;
        for(const candidate of choices){
          let spacing=Infinity;
          // Text is wider than it is tall: leave more vertical lanes for names.
          for(const node of placed){const dx=candidate.screen.x-node.screen.x,dy=(candidate.screen.y-node.screen.y)*2.2;spacing=Math.min(spacing,dx*dx+dy*dy);}
          spacing=placed.length?Math.sqrt(spacing):0;
          const next=spacing+candidate.margin*.12;
          if(next>score){score=next;best=candidate;}
        }
        placed.push({project,point:best.point.slice(),screen:best.screen,margin:best.margin});
        choices.splice(choices.indexOf(best),1);
      }
    }
    return {regions,nodes:projects.map(project=>placed.find(node=>node.project.id===project.id))};
  }
  const tint = (hex, alpha) => `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
  function create(root, {projects, themes, shortVenue, openPaper, openTopic}) {
    root.innerHTML = `<div class="map-toolbar"><span class="map-caption">RESEARCH SPACE · ${projects.length} WORKS</span><span class="map-selection" aria-live="polite"></span><span class="map-help">拖拽旋转 · 滚轮 / 双指缩放</span><div class="map-controls"><button type="button" data-map-action="motion" title="鼠标悬停时继续旋转；点击暂停或恢复">暂停旋转</button><button type="button" data-map-action="out" aria-label="缩小论文图谱">−</button><button type="button" data-map-action="in" aria-label="放大论文图谱">+</button><button type="button" data-map-action="reset" aria-label="复位三维图谱">复位</button></div></div><div class="map-stage"><canvas class="map-canvas" tabindex="0" role="img" aria-label="统一 XYZ 坐标系中的三维论文图谱。多主题论文位于对应主题区域的交集内。论文缩写常显，多选主题会点亮任一所选主题的相关论文。拖拽或方向键旋转，加减键缩放，Home 键复位；Tab 可选择论文点。"></canvas><div class="map-objects"></div><div class="map-inspector" hidden></div><span class="map-orientation">同一坐标系 · 交集 = 共同主题</span></div><div class="map-legend" aria-label="研究方向；多选高亮所有相关论文"></div>`;
    const stage = root.querySelector(".map-stage"), canvas = root.querySelector("canvas"), ctx = canvas.getContext("2d");
    const themeToken = (name, fallback) => {
      const value = getComputedStyle(root).getPropertyValue(name).trim();
      return value || fallback;
    };
    let mapTheme = {
      label: "#f5f8f0",
      axis: "#bbceaf",
      axisOrigin: "#a2b69a",
      axisGrid: "#b0c6b10b",
      axisNeg: "#a6bda233",
      axisPos: "#b2c8aa80",
      hoverRing: "#f0f6dc",
      pointStroke: "#f3ffe4",
      selectedRing: "#efffd680",
    };
    const refreshMapTheme = () => {
      mapTheme = {
        label: themeToken("--map-label", "#f5f8f0"),
        axis: themeToken("--map-axis", "#bbceaf"),
        axisOrigin: themeToken("--map-axis", "#a2b69a"),
        axisGrid: themeToken("--map-axis-grid", "#b0c6b10b"),
        axisNeg: themeToken("--map-axis-neg", "#a6bda233"),
        axisPos: themeToken("--map-axis-pos", "#b2c8aa80"),
        hoverRing: themeToken("--map-hover-ring", "#f0f6dc"),
        pointStroke: themeToken("--map-point-stroke", "#f3ffe4"),
        selectedRing: themeToken("--map-selected-ring", "#efffd680"),
      };
    };
    refreshMapTheme();
    // Lighting is low-frequency: compose it at quarter resolution, then copy once.
    // Wireframes, points and text keep the full display resolution.
    const surfaceLayer=document.createElement("canvas"),surfaceCtx=surfaceLayer.getContext("2d");
    const objects = root.querySelector(".map-objects"), inspector = root.querySelector(".map-inspector"), selection = root.querySelector(".map-selection");
    const nodeSpace=document.createElement("div");nodeSpace.className="map-node-space";objects.append(nodeSpace);
    let view = {...defaultView}, width = 0, height = 0, frame = 0, hovered = null, suppressClickUntil = 0, offset={x:0,y:0};
    let plot={x:0,y:0,width:0,height:0}, camera={}, pixelRatio=1;
    const activeTopics=new Set();
    const pointers = new Map(); let gesture = null;
    const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)"), motionButton=root.querySelector('[data-map-action="motion"]');
    let autoRotation=!reducedMotion.matches, inView=false, keyboardFocus=false, motionRunning=false, resumeTimer=0, resumeAt=0, lastMotionAt=0;
    const topicById = new Map(themes.map(theme => [theme.id, theme]));
    const scene=layout(projects,themes),groups=scene.regions;
    const groupById = new Map(groups.map(group => [group.id, group]));
    const nodes=scene.nodes;
    const paintOrder=groups.slice();
    const pointOrder=nodes.slice();
    const matches=node=>!activeTopics.size||node.project.themes.some(id=>activeTopics.has(id));
    for (const node of nodes) {
        const memberColors=node.project.themes.map(id=>groupById.get(id).color);
        const button = document.createElement("button");button.type="button";
        button.className = "map-node" + (node.project.roles.includes("first") || node.project.roles.includes("lead") ? " is-key-paper" : "") + (memberColors.length>1?" is-intersection":"");
        button.dataset.paperId = node.project.id;button.dataset.topics=node.project.themes.join(" ");button.dataset.position=JSON.stringify(node.point);
        button.style.setProperty("--point-color",memberColors[0]);
        button.style.setProperty("--point-fill",memberColors.length===1?memberColors[0]:`conic-gradient(${memberColors.map((color,i)=>`${color} ${i/memberColors.length*100}% ${(i+1)/memberColors.length*100}%`).join(",")})`);
        button.setAttribute("aria-label", `${node.project.shortTitle}，${shortVenue(node.project)}，${node.project.themes.map(id=>topicById.get(id).label).join(" ∩ ")}。打开${node.project.status === "software" ? "项目介绍" : "论文讲解"}`);
        node.mapName=abbreviations[node.project.id]||node.project.shortTitle;node.colors=memberColors;
        button.innerHTML = `<span class="map-node-name">${escape(node.mapName)}</span>`;
        button.addEventListener("focus", () => setHovered(node));
        button.addEventListener("blur", () => setHovered(null));
        button.addEventListener("click", event => {event.stopPropagation();if(event.detail===0||performance.now()>suppressClickUntil)openPaper(node.project.id);});
        nodeSpace.append(button);node.button=button;node.screen={};
        button.style.transform=`translate3d(${node.point[0]*axisScale[0]*100}px,${node.point[1]*axisScale[1]*100}px,${node.point[2]*axisScale[2]*100}px)`;
        node.label={x:0,y:0,w:0,h:0};
    }
    for (const group of groups) {
      const label=document.createElement("button");label.type="button";label.className="map-topic-label";
      label.dataset.mapTopic=group.id;label.style.setProperty("--topic-color",group.color);label.textContent=group.label;
      label.dataset.center=JSON.stringify(group.center);label.dataset.radius=JSON.stringify(group.radius);
      label.setAttribute("aria-label",`选择 ${group.label}，可多选点亮所有相关论文`);label.setAttribute("aria-pressed","false");
      label.addEventListener("click", event => {event.stopPropagation();if(performance.now()>suppressClickUntil)selectTopic(group.id);});
      objects.append(label);group.labelElement=label;group.screen={};group.ellipse={};
      const angle=topicAngles[group.id]*Math.PI/180;group.labelDirection=[Math.cos(angle),Math.sin(angle)];
      group.scaledRadius2=group.radius.map((r,i)=>(r*axisScale[i])**2);
    }
    const legendLabels={"3d":"3D Vision / Gen",media:"Image / Video Gen",llm:"LLM / MLLM",embodied:"VLA / Embodied",infra:"Infrastructure",robotics:"Robotics",driving:"Driving",worldmodel:"World Models"};
    root.querySelector(".map-legend").innerHTML=groups.map(group=>`<span class="map-topic-chip" style="--topic-color:${group.color}" data-topic-chip="${group.id}"><button type="button" data-map-topic="${group.id}" aria-pressed="false" aria-label="选择 ${escape(group.label)}，可多选点亮所有相关论文"><i aria-hidden="true"></i>${escape(legendLabels[group.id]||group.label)}<b>${projects.filter(p=>p.themes.includes(group.id)).length}</b></button><button type="button" data-open-theme="${group.id}" aria-label="打开 ${escape(group.label)} 论文目录">↗</button></span>`).join("");
    root.querySelector(".map-legend").addEventListener("click", event=>{
      const topic=event.target.closest("[data-map-topic]");if(topic)selectTopic(topic.dataset.mapTopic);
      const list=event.target.closest("[data-open-theme]");if(list)openTopic(list.dataset.openTheme);
    });
    function selectTopic(id){
      if(activeTopics.has(id))activeTopics.delete(id);else activeTopics.add(id);setHovered(null);updateSelection();pauseMotionBriefly();
    }
    function updateSelection(){
      root.querySelectorAll("[data-map-topic]").forEach(el=>el.setAttribute("aria-pressed",String(activeTopics.has(el.dataset.mapTopic))));
      root.querySelectorAll("[data-topic-chip]").forEach(el=>el.classList.toggle("is-active",activeTopics.has(el.dataset.topicChip)));
      selection.textContent=activeTopics.size?`${activeTopics.size===1?topicById.get([...activeTopics][0]).label:activeTopics.size+" 个主题"} · ${nodes.filter(matches).length} 篇相关工作`:"";
      for(const node of nodes){node.matched=matches(node);node.button.classList.toggle("is-selected",activeTopics.size>0&&node.matched);node.button.style.pointerEvents=node.matched?"auto":"none";}
      root.dataset.activeTopics=[...activeTopics].join(" ");root.classList.toggle("has-selection",activeTopics.size>0);schedule();
    }
    function setHovered(node){
      if(hovered===node)return;
      if(hovered)hovered.button.classList.remove("is-hovered");hovered=node;
      inspector.hidden=!node;
      if(node){node.button.classList.add("is-hovered");inspector.innerHTML=`<strong>${escape(node.project.title)}</strong><small>${escape(shortVenue(node.project))}</small><em>${escape(node.project.themes.map(id=>topicById.get(id)?.label).filter(Boolean).join(" ∩ "))}　↗ 点击查看讲解</em>`;}
      schedule();
    }
    function nearestNode(event){
      const rect=stage.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      let closest=null,best=Infinity;
      for(const node of nodes){
        if(node.button.hidden||!node.screen||!matches(node))continue;
        const distance=Math.hypot(node.screen.x-x,node.screen.y-y),radius=(width<600?14:13)*clamp(node.screen.k,.82,1.3);
        if(distance<=radius&&distance<best){closest=node;best=distance;}
      }
      if(closest&&best<7)return closest;
      // Abbreviations are clickable too, including while the scene is moving.
      for(let i=pointOrder.length-1;i>=0;i--){const node=pointOrder[i];if(matches(node)&&!node.button.hidden&&Math.abs(node.label.x-x)<=node.label.w/2&&Math.abs(node.label.y-y)<=node.label.h/2)return node;}
      return closest;
    }
    // Resolve overlapping hit areas using the projected dot centers, including touch taps.
    stage.addEventListener("click",event=>{
      if(event.detail===0)return;
      if(performance.now()<=suppressClickUntil){event.preventDefault();event.stopPropagation();return;}
      if(event.target.closest(".map-topic-label"))return;
      const node=nearestNode(event);
      if(node){event.preventDefault();event.stopPropagation();node.button.focus({preventScroll:true});openPaper(node.project.id);}
    },true);
    function updateCamera(){
      const cy=Math.cos(view.yaw),sy=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
      camera={cy,sy,cp,sp,scaleX:1,scaleY:1,eye:[-cameraDistance*cp*sy/axisScale[0],cameraDistance*sp/axisScale[1],cameraDistance*cp*cy/axisScale[2]]};
      // A continuous fit of the current paper envelope uses the available height
      // as well as width. The bounds are continuous through a complete rotation;
      // neither the XYZ positions nor the badges' contour parameters change.
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const node of nodes){project(node.point,node.screen);const p=node.screen;minX=Math.min(minX,p.u);maxX=Math.max(maxX,p.u);minY=Math.min(minY,p.v);maxY=Math.max(maxY,p.v);}
      for(const group of groups){project(group.center,group.screen);projectEllipse(group);}
      const horizontal=fitProjection(0,plot.width/(maxX-minX),width-16);
      const vertical=fitProjection(1,plot.height/(maxY-minY),height-32);
      offset.x=horizontal.center;offset.y=-vertical.center;
      camera.scaleX=horizontal.scale*view.zoom;camera.scaleY=vertical.scale*view.zoom;
      // All 55 accessible hit targets share ONE projective CSS matrix. Their
      // world transforms are constant, so animation no longer restyles each node.
      const sx=camera.scaleX/100,sy2=camera.scaleY/100;
      const ox=plot.x+plot.width/2-offset.x*camera.scaleX,oy=plot.y+plot.height/2+offset.y*camera.scaleY;
      const wx=cp*sy/(100*cameraDistance),wy=-sp/(100*cameraDistance),wz=-cp*cy/(100*cameraDistance);
      nodeSpace.style.transform=`matrix3d(${[
        sx*cy+ox*wx,-sy2*sp*sy+oy*wx,-cp*sy/100,wx,
        ox*wy,-sy2*cp+oy*wy,sp/100,wy,
        sx*sy+ox*wz,sy2*sp*cy+oy*wz,cp*cy/100,wz,
        ox,oy,0,1
      ].join(",")})`;
    }
    function fitProjection(axis,scale,available){
      // Fit the real contours and attached text before applying user zoom.
      // Only global scale/centering changes; individual labels never dodge one
      // another. Solving the active envelope keeps this continuous at crossings.
      let lo,hi,loValue,hiValue,loPad,hiPad;
      const include=(value,before,after)=>{
        const a=value*scale+before,b=value*scale+after;
        if(a<lo){lo=a;loValue=value;loPad=before;}
        if(b>hi){hi=b;hiValue=value;hiPad=after;}
      };
      for(let pass=0;pass<12;pass++){
        lo=Infinity;hi=-Infinity;
        for(const group of groups){
          const e=group.ellipse,c=axis?e.y:e.x,r=Math.sqrt(axis?e.yy:e.xx),half=(axis?group.labelBox.h:group.labelBox.w)/2;
          include(c-r,-1,1);include(c+r,-1,1);include(axis?e.ay:e.ax,-half,half);
        }
        for(const node of nodes){
          if(axis)include(-node.screen.v,-(width<600?17:19)-node.label.h/2,11);
          else include(node.screen.u,-Math.max(node.label.w/2,11),Math.max(node.label.w/2,11));
        }
        if(hi-lo<=available+.001)break;
        scale=Math.min(scale,(available-hiPad+loPad)/(hiValue-loValue));
      }
      return {scale,center:(lo+hi)/(2*scale)};
    }
    function projectXYZ(x,y,z,p={}){
      x*=axisScale[0];y*=axisScale[1];z*=axisScale[2];
      const xx=x*camera.cy+z*camera.sy,zz=-x*camera.sy+z*camera.cy;
      const yy=y*camera.cp-zz*camera.sp,depth=y*camera.sp+zz*camera.cp,k=cameraDistance/(cameraDistance-depth);
      p.u=xx*k;p.v=yy*k;
      p.x=plot.x+plot.width/2+(xx*k-offset.x)*camera.scaleX;
      p.y=plot.y+plot.height/2-(yy*k-offset.y)*camera.scaleY;p.z=depth;p.k=k;return p;
    }
    function project(point,p){return projectXYZ(point[0],point[1],point[2],p);}
    function projectEllipse(group){
      // Perspective projection of an ellipsoid is an ellipse. Its analytic
      // center/covariance replaces 64 silhouette projections per region/frame.
      const [a,b,c]=group.scaledRadius2,{cy,sy,cp,sp}=camera,p=group.screen,e=group.ellipse;
      const xx=a*cy*cy+c*sy*sy,yy=a*sp*sp*sy*sy+b*cp*cp+c*sp*sp*cy*cy;
      const zz=a*cp*cp*sy*sy+b*sp*sp+c*cp*cp*cy*cy;
      const xy=sp*cy*sy*(a-c),xz=cp*cy*sy*(c-a),yz=cp*sp*(b-a*sy*sy-c*cy*cy);
      const x=p.u/p.k,y=p.v/p.k,w=cameraDistance-p.z,den=w*w-zz,factor=cameraDistance*cameraDistance/den;
      e.x=cameraDistance*(x*w+xz)/den;e.y=-cameraDistance*(y*w+yz)/den;
      e.xx=factor*(xx-x*x)+e.x*e.x;e.yy=factor*(yy-y*y)+e.y*e.y;e.xy=-factor*(xy-x*y)+e.x*e.y;
      // The positive matrix square root is continuous even for a circle. It
      // maps one fixed unit vector onto the actual edge, without angle flips.
      const det=Math.sqrt(Math.max(0,e.xx*e.yy-e.xy*e.xy)),div=Math.sqrt(e.xx+e.yy+2*det),[dx,dy]=group.labelDirection;
      e.ax=e.x+((e.xx+det)*dx+e.xy*dy)/div;e.ay=e.y+(e.xy*dx+(e.yy+det)*dy)/div;
    }
    function surfaceWires(group,front){
      // Split each real 3D surface curve at the camera-facing boundary. The
      // crossings interpolate continuously instead of switching whole segments.
      ctx.beginPath();
      for(const ring of group.rings){
        let connected=false;
        for(let i=0;i<ring.screen.length;i++){
          const a=ring.screen[i],b=ring.screen[(i+1)%ring.screen.length];
          const aInside=front?a.facing>=0:a.facing<=0,bInside=front?b.facing>=0:b.facing<=0;
          if(!aInside&&!bInside){connected=false;continue;}
          let ax=a.x,ay=a.y,bx=b.x,by=b.y;
          if(aInside!==bInside){
            const t=a.facing/(a.facing-b.facing),x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
            if(aInside){bx=x;by=y;}else{ax=x;ay=y;}
          }
          if(!connected)ctx.moveTo(ax,ay);ctx.lineTo(bx,by);connected=bInside;
        }
      }
      ctx.stroke();
    }
    function volume(group){
      const chosen=activeTopics.has(group.id)||hovered?.project.themes.includes(group.id),muted=(activeTopics.size||hovered)&&!chosen;
      const e=group.ellipse,sx=camera.scaleX,sy=camera.scaleY;
      const x=plot.x+plot.width/2+(e.x-offset.x)*sx,y=plot.y+plot.height/2+(e.y+offset.y)*sy;
      const xx=e.xx*sx*sx,yy=e.yy*sy*sy,xy=e.xy*sx*sy,mid=(xx+yy)/2,spread=Math.hypot((xx-yy)/2,xy);
      ctx.beginPath();ctx.ellipse(x,y,Math.sqrt(mid+spread),Math.sqrt(Math.max(0,mid-spread)),.5*Math.atan2(2*xy,xx-yy),0,TAU);
      const distanceFade=clamp(.76+group.screen.z*.055,.48,1);
      ctx.strokeStyle=tint(group.color,(muted ? .085 : chosen ? .78 : .38)*distanceFade);ctx.lineWidth=chosen?1.6:1;ctx.stroke();
      // A cached translucent sphere light is mapped onto the exact silhouette.
      // The symmetric square root has no eigenvector flip as the scene rotates.
      const det=Math.sqrt(Math.max(0,xx*yy-xy*xy)),div=Math.sqrt(xx+yy+2*det);
      surfaceCtx.save();surfaceCtx.globalAlpha=(muted?.12:chosen?1:.75)*distanceFade;
      surfaceCtx.transform((xx+det)/div,xy/div,xy/div,(yy+det)/div,x,y);
      surfaceCtx.drawImage(group.surfaceSprite,-1,-1,2,2);surfaceCtx.restore();
      const eye=group.center.map((c,i)=>(camera.eye[i]-c)/group.radius[i]);
      for(const ring of group.rings){
        for(let i=0;i<ring.points.length;i++){
          const p=project(ring.points[i],ring.screen[i]),n=ring.unit[i];
          p.facing=n[0]*eye[0]+n[1]*eye[1]+n[2]*eye[2]-1;
        }
      }
      ctx.lineWidth=.6;ctx.strokeStyle=tint(group.color,(muted?.014:chosen?.10:.048)*distanceFade);surfaceWires(group,false);
      ctx.lineWidth=chosen?1.2:.95;ctx.strokeStyle=tint(group.color,(muted?.05:chosen?.48:.29)*distanceFade);surfaceWires(group,true);
    }
    function line(a,b,color,lineWidth=.7){
      const p=project(a),q=project(b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();return [p,q];
    }
    function coordinates(){
      // One reference grid and one origin shared by every topic and paper.
      for(let x=-3;x<=4;x++)line([x,-3.1,-2.25],[x,3.4,-2.25],mapTheme.axisGrid);
      for(let y=-3;y<=3;y++)line([-3.5,y,-2.25],[4.25,y,-2.25],mapTheme.axisGrid);
      const ends=[[4.4,0,0],[0,3.6,0],[0,0,2.7]],negative=[[-3.5,0,0],[0,-3.2,0],[0,0,-2.6]];
      ends.forEach((end,i)=>{
        ctx.setLineDash([3,5]);line(negative[i],[0,0,0],mapTheme.axisNeg);ctx.setLineDash([]);
        const [p,q]=line([0,0,0],end,mapTheme.axisPos,.8),angle=Math.atan2(q.y-p.y,q.x-p.x);
        ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-6*Math.cos(angle-.4),q.y-6*Math.sin(angle-.4));ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-6*Math.cos(angle+.4),q.y-6*Math.sin(angle+.4));ctx.stroke();
        ctx.fillStyle=mapTheme.axis;ctx.font="10px monospace";ctx.fillText(["X","Y","Z"][i],q.x+7,q.y-5);
      });
      const origin=project([0,0,0]);ctx.fillStyle=mapTheme.axisOrigin;ctx.font="9px monospace";ctx.fillText("O",origin.x+4,origin.y+11);
    }
    function positionTopicLabel(group){
      const e=group.ellipse,b=group.labelBox;
      b.x=plot.x+plot.width/2+(e.ax-offset.x)*camera.scaleX;
      b.y=plot.y+plot.height/2+(e.ay+offset.y)*camera.scaleY;
      group.labelElement.style.transform=`translate3d(${b.x.toFixed(3)}px,${b.y.toFixed(3)}px,0) translate(-50%,-50%)`;
    }
    function measureScene(){
      // DOM measurements are confined to resize/font changes.
      for(const group of groups)group.labelBox={w:group.labelElement.offsetWidth||135,h:group.labelElement.offsetHeight||25};
      const plotHeight=height-80,plotWidth=width<600?width-72:Math.min(width*.80,plotHeight*1.9);
      plot={x:(width-plotWidth)/2,y:32,width:plotWidth,height:plotHeight};
    }
    function sprite(w,h,paint){
      const image=document.createElement("canvas");image.width=Math.ceil(w*pixelRatio);image.height=Math.ceil(h*pixelRatio);
      const context=image.getContext("2d");context.scale(pixelRatio,pixelRatio);paint(context);return image;
    }
    function cachePaperSprites(){
      // Shape text and paint gradients once per size/font change, not 55 times
      // every frame. Animation only copies these small, already-rasterized images.
      refreshMapTheme();
      const font=`500 ${width<600?9.5:11}px ${getComputedStyle(root).getPropertyValue("--body")||"sans-serif"}`;
      ctx.font=font;
      for(const node of nodes){
        const label=node.label;label.w=Math.ceil(ctx.measureText(node.mapName).width)+10;label.h=width<600?17:19;
        node.nameSprite=sprite(label.w,label.h,c=>{
          c.font=font;c.textBaseline="middle";c.fillStyle=mapTheme.label;c.fillText(node.mapName,5,label.h/2+.5);
        });
        node.nameSprite.dataset.paperLabel=node.project.id;
        node.pointSprites=[false,true].map(selected=>sprite(40,40,c=>{
          const radius=node.colors.length>1?6.2:5.2;
          const glow=c.createRadialGradient(20,20,2,20,20,14);glow.addColorStop(0,tint(node.colors[0],selected?.42:.26));glow.addColorStop(1,tint(node.colors[0],0));
          c.fillStyle=glow;c.fillRect(6,6,28,28);
          if(selected){c.beginPath();c.arc(20,20,10,0,TAU);c.strokeStyle=mapTheme.selectedRing;c.lineWidth=.8;c.stroke();}
          node.colors.forEach((color,i)=>{c.beginPath();c.moveTo(20,20);c.arc(20,20,radius,i/node.colors.length*TAU-TAU/4,(i+1)/node.colors.length*TAU-TAU/4);c.closePath();c.fillStyle=color;c.fill();});
          const light=c.createRadialGradient(18,18,0,20,20,radius);light.addColorStop(0,"#ffffffb3");light.addColorStop(.35,"#ffffff22");light.addColorStop(1,"#00000038");
          c.beginPath();c.arc(20,20,radius,0,TAU);c.fillStyle=light;c.fill();c.strokeStyle=mapTheme.pointStroke;c.lineWidth=.7;c.stroke();
        }));
        for(const image of node.pointSprites)image.dataset.paperPoint=node.project.id;
      }
    }
    function papers(){
      // Names are rigidly attached to their paper points. Paint from back to
      // front and fade with depth; intentional overlap never triggers relayout.
      pointOrder.sort((a,b)=>a.screen.z-b.screen.z);
      const back=pointOrder[0].screen.z,depthSpan=Math.max(1,pointOrder[pointOrder.length-1].screen.z-back);
      for(const node of pointOrder){
        const p=node.screen,b=node.label,match=matches(node),el=node.button;
        const onscreen=p.x>6&&p.x<width-6&&p.y>6&&p.y<height-6;
        if(el.hidden===onscreen)el.hidden=!onscreen;
        const tabIndex=match&&onscreen?0:-1;if(el.tabIndex!==tabIndex)el.tabIndex=tabIndex;
        b.x=p.x;b.y=p.y-(width<600?17:19);
        if(!onscreen)continue;
        const depth=(p.z-back)/depthSpan,focus=smoothstep(.18,.88,depth),alpha=.13+.87*focus*focus;
        ctx.globalAlpha=match?alpha:.045;
        ctx.drawImage(node.nameSprite,b.x-b.w/2,b.y-b.h/2,b.w,b.h);
        const chosen=node===hovered||(activeTopics.size&&match),size=40*(.52+.85*focus);
        ctx.globalAlpha=match ? .12+.88*focus : .045;
        ctx.drawImage(node.pointSprites[chosen?1:0],p.x-size/2,p.y-size/2,size,size);
        if(node===hovered){ctx.globalAlpha=1;ctx.beginPath();ctx.arc(p.x,p.y,9,0,TAU);ctx.strokeStyle=mapTheme.hoverRing;ctx.lineWidth=1;ctx.stroke();}
      }
      ctx.globalAlpha=1;
    }
    function draw(now){
      frame=0;if(!width||!height)return;
      if(motionRunning){view.yaw+=Math.min(Math.max(0,now-lastMotionAt),64)*.000075;lastMotionAt=now;}
      updateCamera();ctx.clearRect(0,0,width,height);surfaceCtx.clearRect(0,0,width,height);coordinates();
      for(const group of groups)project(group.center,group.screen);
      paintOrder.sort((a,b)=>a.screen.z-b.screen.z).forEach(volume);
      ctx.drawImage(surfaceLayer,0,0,width,height);
      for(const node of nodes)project(node.point,node.screen);
      for(const group of groups){
        const opacity=activeTopics.size&&!activeTopics.has(group.id)?".4":"1";
        if(group.labelElement.style.opacity!==opacity)group.labelElement.style.opacity=opacity;
        positionTopicLabel(group);
      }
      papers();
      root.dataset.rotation=`${view.yaw.toFixed(3)},${view.pitch.toFixed(3)}`;root.dataset.zoom=view.zoom.toFixed(3);root.dataset.rendered="true";
      if(motionRunning)schedule();
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
    // Hover never stops motion. Gestures and keyboard exploration do; avoid a
    // catch-up jump when the scene comes back onscreen or a drag ends.
    function motionAvailable(){
      return autoRotation&&inView&&!document.hidden&&!pointers.size&&!keyboardFocus;
    }
    function syncMotion(){
      keyboardFocus=!!stage.querySelector(":focus-visible");
      clearTimeout(resumeTimer);resumeTimer=0;
      const remaining=resumeAt-performance.now();motionRunning=motionAvailable()&&remaining<=0;
      root.dataset.autoRotation=String(autoRotation);root.dataset.autoRotating=String(motionRunning);
      motionButton.textContent=autoRotation?"暂停旋转":"自动旋转";
      motionButton.setAttribute("aria-label",autoRotation?"暂停三维图谱自动旋转":"开启三维图谱自动旋转");
      if(motionRunning){lastMotionAt=performance.now();schedule();}
      else if(motionAvailable()&&remaining>0)resumeTimer=setTimeout(syncMotion,remaining+10);
    }
    function pauseMotionBriefly(){resumeAt=performance.now()+1400;syncMotion();}
    function resize(){
      width=stage.clientWidth;height=stage.clientHeight;pixelRatio=Math.min(devicePixelRatio||1,2);
      measureScene();
      canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
      surfaceLayer.width=Math.ceil(width/4);surfaceLayer.height=Math.ceil(height/4);surfaceCtx.setTransform(surfaceLayer.width/width,0,0,surfaceLayer.height/height,0,0);
      cachePaperSprites();schedule();
    }
    function reset(){view={...defaultView};activeTopics.clear();updateSelection();setHovered(null);pauseMotionBriefly();schedule();}
    root.querySelector(".map-controls").addEventListener("click",event=>{
      const action=event.target.closest("[data-map-action]")?.dataset.mapAction;
      if(action==="motion"){autoRotation=!autoRotation;resumeAt=0;syncMotion();}
      else if(action==="reset")reset();else if(action){view.zoom=clamp(view.zoom*(action==="in"?1.2:1/1.2),.6,2.3);pauseMotionBriefly();schedule();}
    });
    root.addEventListener("focusin",()=>queueMicrotask(syncMotion));
    root.addEventListener("focusout",()=>queueMicrotask(syncMotion));
    document.addEventListener("visibilitychange",syncMotion);
    reducedMotion.addEventListener("change",()=>{autoRotation=!reducedMotion.matches;resumeAt=0;syncMotion();});
    const distance=()=>{const p=[...pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
    stage.addEventListener("pointerdown",event=>{
      if(event.button!==0)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});syncMotion();
      gesture={startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,dragged:pointers.size>1,distance:distance(),zoom:view.zoom};
      if(pointers.size>1){setHovered(null);stage.classList.add("is-dragging");}
    });
    stage.addEventListener("pointermove",event=>{
      if(!pointers.has(event.pointerId)||!gesture){if(event.pointerType!=="touch")setHovered(nearestNode(event));return;}
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size>1){if(gesture.distance>0)view.zoom=clamp(gesture.zoom*distance()/gesture.distance,.6,2.3);gesture.dragged=true;schedule();return;}
      if(!gesture.dragged&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)<5)return;
      if(!gesture.dragged){gesture.dragged=true;stage.setPointerCapture(event.pointerId);stage.classList.add("is-dragging");setHovered(null);}
      view.yaw+=(event.clientX-gesture.lastX)*.006;view.pitch=clamp(view.pitch+(event.clientY-gesture.lastY)*.005,-1.15,1.15);
      gesture.lastX=event.clientX;gesture.lastY=event.clientY;schedule();
    });
    function release(event){
      if(!pointers.has(event.pointerId))return;
      if(gesture?.dragged){suppressClickUntil=performance.now()+350;}
      pointers.delete(event.pointerId);if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);
      if(pointers.size){const p=[...pointers.values()][0];gesture={startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,dragged:true};}
      else{gesture=null;stage.classList.remove("is-dragging");}pauseMotionBriefly();schedule();
    }
    stage.addEventListener("pointerup",release);stage.addEventListener("pointercancel",release);
    stage.addEventListener("pointerleave",event=>{if(!stage.hasPointerCapture(event.pointerId)&&pointers.size<2)release(event);if(!nodes.some(n=>n.button===document.activeElement))setHovered(null);});
    stage.addEventListener("wheel",event=>{event.preventDefault();view.zoom=clamp(view.zoom*Math.exp(-event.deltaY*.0012),.6,2.3);setHovered(null);pauseMotionBriefly();schedule();},{passive:false});
    canvas.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-","Home","Escape"].includes(event.key))return;
      event.preventDefault();event.stopPropagation();pauseMotionBriefly();
      
      if(event.key==="Home")reset();else if(event.key==="Escape"){activeTopics.clear();updateSelection();setHovered(null);}
      else if(event.key==="ArrowLeft")view.yaw-=.12;else if(event.key==="ArrowRight")view.yaw+=.12;
      else if(event.key==="ArrowUp")view.pitch=clamp(view.pitch-.12,-1.15,1.15);else if(event.key==="ArrowDown")view.pitch=clamp(view.pitch+.12,-1.15,1.15);
      else view.zoom=clamp(view.zoom*(event.key==="-"?1/1.2:1.2),.6,2.3);schedule();
    });
    groups.forEach(group=>{
      const curves=[0,1,2].map(axis=>ringCircle.map(([cos,sin])=>{
        const n=[0,0,0];n[(axis+1)%3]=cos;n[(axis+2)%3]=sin;return n;
      }));
      for(const latitude of [-.52,.52])curves.push(ringCircle.map(([cos,sin])=>[Math.sqrt(1-latitude*latitude)*cos,latitude,Math.sqrt(1-latitude*latitude)*sin]));
      group.rings=curves.map(unit=>({unit,points:unit.map(n=>n.map((v,i)=>group.center[i]+group.radius[i]*v)),screen:unit.map(()=>({}))}));
      group.surfaceSprite=sprite(192,192,c=>{
        const light=c.createRadialGradient(62,53,4,96,96,121);
        light.addColorStop(0,tint(group.color,.23));light.addColorStop(.32,tint(group.color,.12));light.addColorStop(.72,tint(group.color,.028));light.addColorStop(1,tint(group.color,.006));
        c.beginPath();c.arc(96,96,95.5,0,TAU);c.fillStyle=light;c.fill();
      });
    });
    root.dataset.pointCount=String(nodes.length);root.dataset.coordinateSystem="shared-xyz";
    new ResizeObserver(resize).observe(stage);resize();
    document.fonts.ready.then(resize);
    new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncMotion();},{threshold:0}).observe(stage);
    syncMotion();
    return {
      setTopics(ids) {
        activeTopics.clear();
        (ids || []).forEach(id => { if (topicById.has(id)) activeTopics.add(id); });
        setHovered(null);
        updateSelection();
      }
    };
  }
  window.ResearchMap={create,layout};
})();
