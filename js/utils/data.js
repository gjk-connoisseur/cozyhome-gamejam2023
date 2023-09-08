const ITERATE_QUEUE=(queue, yoink)=> {
	if(!queue.head()) return; // is queue null?
	let dummy=queue.head().get_next();
	if(!dummy) return; // is next entry null?
	do{
		yoink(dummy.data());
		dummy=dummy.get_next();
	}while(dummy != null);
}

class QNode {
	#_prev; #_next; #_obj;
	constructor(obj) { this.#_obj = obj; }
	set_prev=(prev)=> { this.#_prev = prev; }
	set_next=(next)=> { this.#_next = next; }
	get_prev=()=> { return this.#_prev; }
	get_next=()=> { return this.#_next; }
	data=()=>{ return this.#_obj; }
}

class Queue {
	#_head; #_tail; #_count;
	constructor() { this.#_count = 0; }
	head=()=>{ return this.#_head; }
	push=(obj)=> {
		if(this.#_count > 0) {
			const next = new QNode(obj);
			next.set_prev(this.#_tail);
			this.#_tail.set_next(next);
			this.#_tail = next;
		}else {
			this.#_head = new QNode();
			this.#_tail = new QNode(obj);
			this.#_head.set_next(this.#_tail);
		}
		this.#_count++;
	}
	skip=(obj)=> {
		const next = new QNode(obj);
		const hn = this.#_head.get_next();
		this.#_head.set_next(next);
		next.set_prev(this.#_head);
		next.set_next(hn);
		if(hn) hn.set_prev(next);
		this.#_count++;
	}
	pop=()=> {
		if(this.#_count > 0) {
			const hn = this.#_head.get_next();
			this.#_head = hn;
			hn.set_prev(null);
			this.#_count--;
			return hn.data();
		}else {
			return null;
		}
	}
	peek=()=> {
		if(this.#_count > 0) return this.#_head.get_next().data();
		return null;
	}
	count=()=> { return this.#_count; }
	empty=()=> { return this.#_count <= 0; }
}

class OctreeNode {
// reference to lower depth level
	#_parent;
// sub-nodes
	#_children;
// data elements
	#_entities;
// depth for this node
	#_depth;
// bounding box
	#_bbox;

// depedency: relies on the parent object (or whomever is allocating)
// to know what its span will be before construction.
	constructor(parent, bbox) {
// initialize to empty list for now
		this.#_children = [];
		this.#_entities = [];
// set our bounding box
		this.#_bbox = bbox;
// remember our parent
		this.#_parent = parent;
// calculate our depth immediately
		this.#_depth = parent.depth() + 1;
	}
// helper classes
	isleaf() { return this.#_children > 0; }
	depth() { return this.#_depth; }
	parent() { return this.#_parent; }
	children() { return this.#_children; }
	entities() { return this.#_entities; }
	bbox() { return this.#_bbox; }
}

// i want a recursively assigned spatial hashing architecture that
// hashes 3-tuples into string buckets. Operating similar to that of
// an octree:

// INSERT (ROOT, X,Y,Z, OBJ):
	// LOOK INTO BUCKET(X,Y,Z) AT ROOT
		// IF HASH(BUCKET(X,Y,Z)) IS MAP:
			// INSERT (HASH(BUCKET(X,Y,Z), X,Y,Z, OBJ)
		// ELSE
			// IF | HASH(BUCKET(X,Y,Z) | > 4 && ROOT.DEPTH() < 4:
				// LET CHILDREN = HASH(BUCKET(X,Y,Z));
				// HASH(BUCKET(X,Y,Z)) = NEW NODE(ROOT, SPAN / 2);
				// FOR(LET I=0;I<CHILDREN.LENGTH;I++) {
					// INSERT(HASH(BUCKET(X,Y,Z)), X,Y,Z, OBJ);
				//}
			// ELSE:
				// HASH(BUCKET(X,Y,Z)).PUSH(HASH(X,Y,Z), OBJ);


// stores component bbox and matrix transform
class OBB {
	#_obb_box;
	#_aabb_box;
	#_l2w;
	constructor(minx=0,maxx=0,miny=0,maxy=0,minz=0,maxz=0,l2w=null) {
		this.#_l2w = l2w == null ? mIdentity4x4() : l2w;
		this.#_obb_box = new BBox(minx,maxx,miny,maxy,minz,maxz);
		this.#_aabb_box = AABB_FROM_OBB(this.#_obb_box, this.#_l2w);
	}
	l2w=()=>{ return this.#_l2w; }
	obb_box=()=>{ return this.#_obb_box; }
	aabb_box=()=>{ return this.#_aabb_box; }
	transform=(a)=> {
		this.#_l2w = mMultiply4x4(this.#_l2w, a);
		UPDATE_AABB_OBB(this.#_aabb_box, this.#_obb_box, this.#_l2w);
	}
}

class BBox {
	#_cen; #_ext;
	constructor(minx=0,maxx=0,miny=0,maxy=0,minz=0,maxz=0) {
		this.#_cen = new vec3();
		this.#_ext = new vec3();
		this.#_cen._x = (minx + maxx) / 2;
		this.#_cen._y = (miny + maxy) / 2;
		this.#_cen._z = (minz + maxz) / 2;

		this.#_ext._x = (maxx - minx) / 2;
		this.#_ext._y = (maxy - miny) / 2;
		this.#_ext._z = (maxz - minz) / 2;
// positive definite extents
		if(this.#_ext._x < 0) this.#_ext._x *= -1;
		if(this.#_ext._y < 0) this.#_ext._y *= -1;
		if(this.#_ext._z < 0) this.#_ext._z *= -1;
	}
	cen=()=> { return this.#_cen; }
	ext=()=> { return this.#_ext; }
	min=()=> { return sub3(this.#_cen, this.#_ext); }
	max=()=> { return add3(this.#_cen, this.#_ext); }
	bind=(minx=0,maxx=0,miny=0,maxy=0,minz=0,maxz=0)=> {
		this.#_cen._x = (minx + maxx) / 2;
		this.#_cen._y = (miny + maxy) / 2;
		this.#_cen._z = (minz + maxz) / 2;

		this.#_ext._x = (maxx - minx) / 2;
		this.#_ext._y = (maxy - miny) / 2;
		this.#_ext._z = (maxz - minz) / 2;

// positive definite extents
		if(this.#_ext._x < 0) this.#_ext._x *= -1;
		if(this.#_ext._y < 0) this.#_ext._y *= -1;
		if(this.#_ext._z < 0) this.#_ext._z *= -1;
	}
}

// tests for overlap between two axis aligned bounding boxes in 3D
const TEST_AABB_AABB=(A,B,slack=0)=> {
	const abs=(a)=>{ return a > 0 ? a : -a; }
	const ac = A.box().cen(); const ar = A.box().ext();
	const bc = B.box().cen(); const br = B.box().ext();

	if(abs(ac._x - bc._x) > ar._x + br._x + slack) return false;
	if(abs(ac._y - bc._y) > ar._y + br._y + slack) return false;
	if(abs(ac._z - bc._z) > ar._z + br._z + slack) return false;
	return true;
}

// inflates a bounding box by a provided vector
const SUPPORT_AABB=(v, box, inf=8)=> {
	const cen = box.cen();
	const ext = box.ext();
	const abs=(a)=>{ return a > 0 ? a : -a; }

	cen._x += v._x/2;
	cen._y += v._y/2;
	cen._z += v._z/2;

	ext._x += inf + abs(v._x/2);
	ext._y += inf + abs(v._y/2);
	ext._z += inf + abs(v._z/2);
}

// takes a convex polygonal set and constructs its locally aligned bounding box
const POINTSET_TO_OBB=(pts, l2w)=> {
	const sup = new vec3(0,1,0);
	const m_up = SUPPORT_OBB(sup,pts); // up
	sup._y = -1;
	const m_dn = SUPPORT_OBB(sup,pts); // down
	sup._y = 0; sup._x = 1;
	const m_rt = SUPPORT_OBB(sup,pts); // right
	sup._x = -1;
	const m_lt = SUPPORT_OBB(sup,pts); // left
	sup._x = 0; sup._z = 1;
	const m_fw = SUPPORT_OBB(sup,pts); // forward
	sup._z = -1;
	const m_bk = SUPPORT_OBB(sup,pts); // back

	const min = new vec3(
		Math.min(m_lt._x, m_rt._x),
		Math.min(m_dn._y, m_up._y),
		Math.min(m_fw._z, m_bk._z),
	);
	const max = new vec3(
		Math.max(m_lt._x, m_rt._x),
		Math.max(m_dn._y, m_up._y),
		Math.max(m_fw._z, m_bk._z)
	);
	return new OBB(
		new AABB(
			min._x,max._x, 
			min._y,max._y,
			min._z,max._z),
		l2w // local to world matrix
	);
}

// takes an OBB and returns an AABB
const AABB_FROM_OBB=(obb, m)=> {
	const aabb = new BBox();
	UPDATE_AABB_OBB(aabb, obb, m);
	return aabb;
}

// takes an OBB and updates the aabb via a delta matrix
const UPDATE_AABB_OBB=(aabb, obb, m)=> {
// fasthand matrix transform
	const wcen = MT3(m, obb.cen());
// fasthand positive definite matrix transform for directions
	const wext = MTD3_ABS(m, obb.ext());

	const minx = wcen._x - wext._x;
	const maxx = wcen._x + wext._x;
	const miny = wcen._y - wext._y;
	const maxy = wcen._y + wext._y;
	const minz = wcen._z - wext._z;
	const maxz = wcen._z + wext._z;

// reassign all new mins and maxes computed
	aabb.bind(minx,maxx,miny,maxy,minz,maxz);
}

const SUPPORT_OBB=(v,set)=> {
	let mv = set[0];
	let max = Number.NEGATIVE_INFINITY;
	for(let i=0;i<set.length;i++) {
		const dot = dot3(set[i],v);
		if(dot >= max) {
			max = dot;
			mv = set[i];
		}
	}
	return mv;
}

class WingedVertex {
	pos; // v3
	egs; // edge array
	constructor(pos) { this.pos = pos; this.egs = []; }
	push_edge(edge) { this.egs.push(edge); }
}

class WingedEdge {
	next; // next edge in chain
	twin; // dual of edge going in opposite direction
	face; // map to one of the two bounding faces in 3D
	vert; // map from edge to Z (vertex index)
	orient; // +1: outside chain, -1: inside chain
	constructor() { }
}

class WingedFace {
	normal;
	constructor(normal) { this.normal = normal; }
}

const ITERATE_WEDGES=(hep, yoink=(edge)=>{})=> {
	const pts = hep.pts;
// copy edges with a hash bleed into edge structure.
	const eset = new Set();
	const vqueue = new Queue();
	let count = 0;
// push vertices into queue..
	for(let i=0;i<pts.length;i++) { vqueue.push(i); }
	do {
// get the vertex associated with index i
		const vid = vqueue.pop();
		const vertex = pts[vid];

// bleed into its neighbors
		const egs = vertex.egs;

// do it along the vertices instead :)!
		count = 0;
		for(let i=0;i<egs.length;i++) {
// next vertex index
			const nvi = egs[i].vert; 

			const e_str = vid > nvi ? `${nvi}_${vid}` : `${vid}_${nvi}`;
// if the edge map does not contain either directed edge, insert:
			if(!eset.has(e_str)) {
				eset.add(e_str);
				vqueue.push(nvi);
				count++;
				yoink(egs[i]);
			}
		}
	} while(count != 0);
}

const ITERATE_WVERTICES=(hep, yoink=(vid, vertex)=>{})=> {
	const pts = hep.pts;
// copy edges with a hash bleed into edge structure.
	const vset = new Set();
	const vqueue = new Queue();
	let count = 0;
// push vertices into queue..
	for(let i=0;i<pts.length;i++) { vqueue.push(i); }
	do {
// get the vertex associated with index i
		const vid = vqueue.pop();
		const vertex = pts[vid];

// bleed into its neighbors
		const egs = vertex.egs;

		count = 0;
		if(!vset.has(vid)) {
			for(let i=0;i<egs.length;i++) {
				const nvi = egs[i].vert;  // next vertex
				vqueue.push(nvi);
				count++;
			}
			vset.add(vid);
			yoink(vid, vertex);
		}
	} while(count != 0);
}

const COMPUTE_NUM_EDGES=(hep)=> {
	let num_edges = 0;
	ITERATE_WEDGES(hep, ()=>{ num_edges++; });
	return num_edges;
}

// takes in an half edge polygonal data structure.
const CONSTRUCT_WIREFRAME=(hep)=> {
	const pts = hep.pts;

	const num_verts = pts.length;

	const num_velems = 6; // 3 float 32s (xyz), 3 float 32s (rgb)
	const num_eelms = 2;  // 2 uint16s

	const vlen = num_verts * num_velems; 
	const elen = COMPUTE_NUM_EDGES(hep) * num_eelms;
	
// copy vertices into flat array.
	const vf32 = new Float32Array(vlen);
	for(let i=0;i<pts.length;i++) {
		for(let j=0;j<num_velems;j++) {
			vf32[num_velems*i + j] = pts[i].pos.at(j);
		}
		for(let j=0;j<num_velems;j++) {
			vf32[3+ num_velems*i + j] = 1.0;
		}
	}
// copy unique edges into flat array.
	const eu16 = new Uint16Array(elen);
	let ec = 0;
	ITERATE_WEDGES(hep, (edge)=> {
		eu16[num_eelms*ec]   = edge.twin.vert;
		eu16[num_eelms*ec+1] = edge.vert;
		ec++;
	});
	return { verts: vf32, edges: eu16, vert_size: num_velems };
}

// constructs the data structures required to represent manifold polygonal data.
const CONSTRUCT_POLYGON=(n=4,w=1)=> {
	const ts = 360 / n;
	const pts = [];	
	const egs = [];
// push points to a point array
	let rv = new vec2(w,0);
	for(let i=0;i<n;i++) {
		pts.push(new WingedVertex(new vec3(rv._x, rv._y, 0)));
		let v = copy2(rv);
		rv = rot2(ts, rv);
	}

	let edge = new WingedEdge();
	for(let i=0;i<n;i++) {
		egs.push(edge);
		edge.orient = 1;
		edge.vert = (i+1) % n;
// don't construct a new edge. we are looping
		if(i == n-1) {
			edge.next = egs[0];
		}else {
			edge.next = new WingedEdge();
			edge = edge.next;
		}
	}
// (n*(1 + ~~(i/n)) + i = 5
	const roll = (i,n)=> {
		return i >= 0 ? i % n : (1+~~(i/n))*n + i;
	}

	let tedge = new WingedEdge();
	for(let i=n-1;i>=0;i--) {
		egs.push(tedge);

		tedge.orient = -1;
		tedge.vert = roll(i,n);

		tedge.twin = egs[roll(i,n)];
		tedge.twin.twin = tedge;

		pts[tedge.twin.vert].push_edge(tedge);
		pts[tedge.twin.vert].push_edge(tedge.twin.next);

		const p1 = pts[tedge.vert].pos;
		const p2 = pts[tedge.twin.vert].pos;

		const normal = perp2(sub2(p2,p1));

		tedge.twin.face = new WingedFace(normal);
		tedge.face = new WingedFace(mul2(-1,normal));

// handle looping
		if(i == 0) {
			tedge.next = egs[n].twin;
		}else {
			tedge.next = new WingedEdge();
			tedge = tedge.next;
		}
	}
// graph
	return { pts: pts, egs:egs, root:egs[0] };
}
