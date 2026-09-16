// Maze generation and pathfinding

function seededRandom(seed){
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng=Math.random){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

/* Worksheet-inspired 21x21 maze for Medium. */
const mediumMap = [
"#####################",
"#.....#.......#.....#",
"#.###.#.#####.#.###.#",
"#...#.#.....#.#...#.#",
"###.#.#####.#.###.#.#",
"#...#.....#.#.....#.#",
"#.#######.#.#######.#",
"#.......#.#.#.......#",
"#######.#.#.#.#######",
"#.....#.#...#.#.....#",
"#.###.#.#####.#.###.#",
"#.#...#...#...#...#.#",
"#.#.#####.#.#####.#.#",
"#...#.....#.....#...#",
"###.#.###.###.###.#.#",
"#...#.#.......#.#...#",
"#.###.#.#####.#.###.#",
"#.....#...#...#.....#",
"#.#########.#########",
"#...................#",
"#####################"
];

function generateMaze(size, seed, extraLoops){
  const rng = seededRandom(seed);
  const grid = Array.from({length:size},()=>Array(size).fill("#"));
  const dirs = [[0,-2],[2,0],[0,2],[-2,0]];
  function carve(x,y){
    grid[y][x]=".";
    for(const [dx,dy] of shuffle(dirs,rng)){
      const nx=x+dx, ny=y+dy;
      if(nx>0&&nx<size-1&&ny>0&&ny<size-1&&grid[ny][nx]==="#"){
        grid[y+dy/2][x+dx/2]=".";
        carve(nx,ny);
      }
    }
  }
  carve(1,1);

  const candidates=[];
  for(let y=1;y<size-1;y++){
    for(let x=1;x<size-1;x++){
      if(grid[y][x]!=="#") continue;
      const h=grid[y][x-1]==="."&&grid[y][x+1]===".";
      const v=grid[y-1][x]==="."&&grid[y+1][x]===".";
      if(h||v) candidates.push([x,y]);
    }
  }
  for(const [x,y] of shuffle(candidates,rng).slice(0,extraLoops)) grid[y][x]=".";
  return grid.map(row=>row.join(""));
}

function neighbors(x,y){
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy])=>({x:x+dx,y:y+dy}))
    .filter(p=>p.x>=0&&p.y>=0&&p.y<map.length&&p.x<map[0].length&&map[p.y][p.x]!== "#");
}
function findNearestWalkable(sx,sy){
  if(map[sy]?.[sx] !== "#") return {x:sx,y:sy};
  const q=[{x:sx,y:sy}], seen=new Set([sx+","+sy]);
  for(let i=0;i<q.length;i++){
    const p=q[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=p.x+dx,y=p.y+dy,k=x+","+y;
      if(x<0||y<0||y>=map.length||x>=map[0].length||seen.has(k)) continue;
      if(map[y][x] !== "#") return {x,y};
      seen.add(k); q.push({x,y});
    }
  }
  return {x:1,y:1};
}
function distanceMap(start){
  const d=new Map([[start.x+","+start.y,0]]);
  const q=[start];
  for(let i=0;i<q.length;i++){
    const p=q[i], base=d.get(p.x+","+p.y);
    for(const n of neighbors(p.x,p.y)){
      const k=n.x+","+n.y;
      if(!d.has(k)){d.set(k,base+1);q.push(n);}
    }
  }
  return d;
}
function farthestReachable(start=player){
  const d=distanceMap(start);
  return [...d.entries()]
    .map(([k,dist])=>{const [x,y]=k.split(",").map(Number);return{x,y,dist};})
    .sort((a,b)=>b.dist-a.dist);
}
function choosePlayerStart(rng=Math.random){
  const d=distanceMap({x:1,y:1});
  const cells=[...d.keys()].map(k=>{
    const [x,y]=k.split(",").map(Number);
    return {x,y,dist:d.get(k)};
  }).filter(p=>p.x>0 && p.y>0 && p.x<map[0].length-1 && p.y<map.length-1);
  const preferred=cells.filter(p=>p.dist>=Math.max(3,Math.floor(map.length*0.18)));
  const pool=preferred.length?preferred:cells;
  return pool[Math.floor(rng()*pool.length)] || {x:1,y:1};
}

function chooseTargets(count, rng=Math.random, start=player){
  const d=distanceMap(start);
  const cells=shuffle([...d.keys()].map(k=>{
    const [x,y]=k.split(",").map(Number);
    return {x,y,dist:d.get(k)};
  }).filter(p=>!(p.x===start.x&&p.y===start.y)),rng);
  const selectWithGap=(gap)=>{
    const chosen=[];
    for(const c of cells){
      if(Math.abs(c.x-start.x)+Math.abs(c.y-start.y)<gap) continue;
      if(chosen.some(p=>Math.abs(p.x-c.x)+Math.abs(p.y-c.y)<gap)) continue;
      chosen.push(c);
      if(chosen.length===count) return chosen;
    }
    return chosen;
  };
  let chosen=selectWithGap(levelKey === "easy" ? 4 : 5);
  for(const gap of [4,3,2,1]){
    if(chosen.length>=count) break;
    chosen=selectWithGap(gap);
  }
  return chosen.slice(0,count);
}

function chooseHome(){
  const cells=farthestReachable();
  const candidates=cells.filter(p=>
    !(p.x===player.x&&p.y===player.y) &&
    p.dist>Math.max(10, Math.floor(map.length*0.8))
  );
  return candidates[Math.floor(Math.random()*Math.max(1,candidates.length))] ||
         cells.find(p=>!(p.x===player.x&&p.y===player.y)) || cells[0];
}

