
const line_intersect_otree=(p,v,otree,onhit)=> {

}

const line_intersect_obb=(p,v,obb)=> {
// cast against the axial bounding box
	const axial_hit = line_intersect_axial(p,v,obb.aabb_box());
	if(axial_hit.toi < Number.POSITIVE_INFINITY) {
		const l2w_i = mInverse4x4(obb.l2w());
		return line_intersect_oriented(p,v,l2w_i,obb.obb_box());
	}else {
		return axial_hit;
	}
}

// returns the toi of an arbitrarily transformed bounding box
const line_intersect_oriented=(p,v,l2w_inv,bbox)=> {
	return line_intersect_axial(MT3(l2w_inv, p), MTD3(l2w_inv, v), bbox);
}

// returns the time of impact, point of intersection, and face
// of least impact for a bounding box in general position
const line_intersect_axial=(p,v,bbox)=>{
	const min = bbox.min();
	const max = bbox.max();

	const tol = 1e-5;
	const abs = (x)=> {return x > 0 ? x : -x; }
// minimum face index, and minimum positive definite time of impact
// i maps to enumerations in [0,6] where:
// i / 2 -> biface pair
// i % 2 -> face of biface pair
	let min_e = -1;
	let min_t = Number.POSITIVE_INFINITY;

	for(let i=0;i<3;i++) {
		let min_ei = -1;
		let min_ti = Number.POSITIVE_INFINITY;
// does a valid projection exist?
		if(abs(v.at(i)) > tol) {
// negative projections imply we miss the halfspace, we need
// to account for these in our search
			let t0 = (min.at(i) - p.at(i)) / v.at(i);
			let t1 = (max.at(i) - p.at(i)) / v.at(i);
// determine the smallest positive definite time of impact
			if(t0 > 0 && t1 > 0) {
				if(t1 > t0) {
					min_ti = t0;
					min_ei = 2*i;
				}else {
					min_ti = t1;
					min_ei = 2*i + 1;
				}
			}
// determine whether the associated minimum toi properly slices
// into subspace formed by the (n-1) other components
			let j=0;
			for(;j<3;j++) {
				if(j==i) continue; // skip itself
				let j_i = min_ti*v.at(j) + p.at(j);
				if(j_i < min.at(j) || j_i > max.at(j)) break;
			}
// determine the global positive definite minima	
			if(j == 3 && min_ti < min_t) {
				min_t = min_ti;
				min_e = min_ei;
			}
		}
	}
// hit object
	return { toi:min_t, face: min_e };
}
