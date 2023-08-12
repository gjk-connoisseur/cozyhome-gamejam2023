
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
	constructor(minx=0,maxx=0,miny=0,maxy=0,minz=0,maxz=0, l2w) {
		this.#_l2w = l2w;
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

class Mesh {
// vertex list (not a Float32Array)
	#_verts;
// triangles list (not a UInt32Array)
	#_tris;
// WebGL2Program
	#_prog;
	
	constructor(verts, tris, prog) {
		this.#_verts = verts;
		this.#_tris  = tris;
		this.#_prog  = prog;
	}
}

class Island {
// display information (shader + vertices + tris)
	#_mesh;
// axis aligned bounding box
	#_aabb;
	constructor() { }
}
