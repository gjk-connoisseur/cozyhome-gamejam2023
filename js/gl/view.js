class ViewContext3D {
	#_cm;
// pos := vec3 position
// rot :+ vec3 euler angles
	constructor(pos, rot) {
		this.#_cm = new Matrix4x4();
		if(pos != null) this.#_cm.translate(pos.f4d());
		if(rot != null) {
			this.#_cm.rotx(rot.x()*Math.PI/180);
			this.#_cm.roty(rot.y()*Math.PI/180);
			this.#_cm.rotz(rot.z()*Math.PI/180);
		}
	}
	look=(ds=0,mx=0,my=0)=> {
// integrate
		let dx = -my*ds; let dy = mx*ds;
		const m = this.#_cm.get();
		let deltaM = mIdentity4x4();

		if(Math.abs(dy) > 0.001) {
			deltaM = mRoty4x4(dy * Math.PI/180, deltaM);
		}
// translate to origin
		const pos = this.#_cm.getvec(3);
		this.#_cm.setcol(3, [0,0,0,0]);

		this.#_cm.set(mMultiply4x4(deltaM, this.#_cm.get()));
// teleport back to position
		this.#_cm.setcol(3, pos.f4d());
// get the signed angle so we know not to overshoot our x rotation.
		const x_angle = sangle3(
			this.up(), 			 // up
			new vec3(0,1,0), 	 // global-up
			this.rgt()  		 // right
		);

		const MAX_VERTICAL = 85;
		if(x_angle + dx > MAX_VERTICAL) {
			dx = MAX_VERTICAL - x_angle;
		}else if(x_angle + dx < -MAX_VERTICAL) {
			dx = (-MAX_VERTICAL - x_angle);
		}
		if(Math.abs(dx) > 0.001) {
			this.#_cm.rotx(-dx * Math.PI/180);
		}
	}
	orbit=(ds=0,dx=0,dy=0,z=16)=> {
		const pos = add3(this.pos(), mul3(z, this.fwd()));
		this.look(ds,dx,dy);
		const next_pos = add3(pos, mul3(-z, this.fwd()));
		this.#_cm.setcol(3, next_pos.f4d());
	}
	move=(ds=0,dx=0,dy=0,dz=0)=> {
// construct input vector and transform it along the basis of cm
		let wish = new vec3(dx,dy,dz);
// keep it unit, then scale
		wish = mul3(ds, unit3(wish));
// convert vec3 type to vec4 direction, transform and add
// to current matrix
		let pos = this.#_cm.getvec(3);
		const f = this.fwd();
		const r = this.rgt();
		const u = this.up();
	
		pos._x += (f._x*wish._z + r._x*wish._x + u._x*wish._y);
		pos._y += (f._y*wish._z + r._y*wish._x + u._y*wish._y);
		pos._z += (f._z*wish._z + r._z*wish._x + u._z*wish._y);

		this.#_cm.setcol(3, pos.f4d());
	}
	pan=(ds=0,mx=0,my=0)=> {
// construct input vector and transform it along the basis of cm
		let wish = new vec3(ds*mx,ds*my,0);
// convert vec3 type to vec4 direction, transform and add
// to current matrix
		let pos = this.#_cm.getvec(3);
		const r = this.rgt();
		const u = this.up();
	
		pos._x += (r._x*wish._x - u._x*wish._y);
		pos._y += (r._y*wish._x - u._y*wish._y);
		pos._z += (r._z*wish._x - u._z*wish._y);

		this.#_cm.setcol(3, pos.f4d());
	}

	bind=(pos,fwd,fov)=> {
		this.#_cm.setcol(3, [+pos._x,+pos._y,+pos._z, 1]);
		const rgt = mTD4x4(mRoty4x4(90*Math.PI/180), fwd);
		this.#_cm.setcol(2, [fwd._x,fwd._y,fwd._z,0]); // fwd
		this.#_cm.setcol(0, [rgt._x,rgt._y,rgt._z,0]); // rgt
	}

	pos=()=> { return this.#_cm.getvec(3); }
	fwd=()=> { return this.#_cm.getvec(2); }
	up=()=>  { return this.#_cm.getvec(1); }
	rgt=()=> { return this.#_cm.getvec(0); }
	mat=()=> { return this.#_cm.get(); }
}

