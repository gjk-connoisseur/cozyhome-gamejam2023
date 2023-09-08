// this will be where all of our default shaders
// are stored. As well as this, we will have some
// functions that will automatically compile, and
// draw things to the screen
// -DC @ 7/22/23

const DRAW_GL_WIREFRAME=(ctx, lines_s, point_s, gl_wframe, l2w, iv, p)=> {
	ctx.useProgram(lines_s);
	gl_wframe.bind(ctx);
	GL_DEFAULT_ATTR(ctx, lines_s);
	GL_SET_MVP(ctx, lines_s, l2w, iv, p);
	gl_wframe.draw_edges(ctx);

	ctx.useProgram(point_s);
	GL_DEFAULT_ATTR(ctx, point_s);
	GL_SET_MVP(ctx, point_s, l2w, iv, p);
	gl_wframe.draw_points(ctx);
}

const DRAW_GL_TRIAD=(ctx, lines_s, gl_triad, model, inv_view, project)=> {
	const BPE = Float32Array.BYTES_PER_ELEMENT;
	const vert_size = 6;
	
	ctx.useProgram(lines_s);
	gl_triad.bind(ctx);
// draw the grid lines
	GL_DEFAULT_ATTR(ctx, lines_s);
	GL_SET_MVP(ctx, lines_s, model, inv_view, project);
// initiate draw call sequence
	gl_triad.draw(ctx);
}

const DRAW_GL_BOARD=(ctx, lines_s, points_s, 
		gl_board, model, inv_view, project,
		draw_points=false)=> {
	const BPE = Float32Array.BYTES_PER_ELEMENT;
	const vert_size = 6;

	ctx.useProgram(lines_s);
	gl_board.bind(ctx);

	GL_DEFAULT_ATTR(ctx, lines_s);
	GL_SET_MVP(ctx, lines_s, model, inv_view, project);
// draw edges using the edge shaders
	gl_board.draw_edges(ctx);

	if(!draw_points) return;
// we'll need to context switch to the points program
// in order to draw the vertices
	ctx.useProgram(points_s);
	gl_board.bind(ctx);

	GL_DEFAULT_ATTR(ctx, points_s);
	GL_SET_MVP(ctx, points_s, model, inv_view, project);
// draw points using point shaders
	gl_board.draw_points(ctx);
}

const DRAW_GL_OBB=(ctx, lines_s, points_s, 
		obb, gl_box, 
		inv_view, project, 
		draw_aabb=false,
		c1=[1,0,0], c2=[0,1,0])=> {
	gl_box.write_colors(ctx, c1);
	gl_box.write_points(ctx, obb.obb_box());
	gl_box.upload(ctx);
		
	DRAW_GL_BOX(ctx, lines_s, points_s, gl_box, obb.l2w(), inv_view, project);

	if(draw_aabb) {
		gl_box.write_colors(ctx, c2);
		gl_box.write_points(ctx, obb.aabb_box());
		gl_box.upload(ctx);

		DRAW_GL_BOX(ctx, lines_s, points_s, gl_box, mIdentity4x4(), inv_view, project);
	}
}

const DRAW_GL_BOX=(ctx, lines_s, points_s, gl_box, model, inv_view, project)=> {
// guarantee that we are still using the lines program
	ctx.useProgram(lines_s);
	gl_box.bind(ctx, lines_s);

	GL_DEFAULT_ATTR(ctx, lines_s);
	GL_SET_MVP(ctx, lines_s, model, inv_view, project);

// draw edges using the edge shaders
	gl_box.draw_edges(ctx);

// we'll need to context switch to the points program
// in order to draw the vertices
	ctx.useProgram(points_s);
	gl_box.bind(ctx);

	GL_DEFAULT_ATTR(ctx, points_s);
	GL_SET_MVP(ctx, points_s, model, inv_view, project);

// draw points using the point shaders
	gl_box.draw_points(ctx);
}

class GL_Triad {
	#_verts; // vertices for the gimbal
	#_edges; // edges for the gimbal
	#_vbo;   // vertices
	#_ebo;   // edges
	constructor(ctx) {
		const ints_per_edge = 2;
		const floats_per_vert = 6;

		const num_verts = 6;
		const num_edges = 3;
	
		this.#_verts = new Float32Array(floats_per_vert*num_verts);
		this.#_edges = new Uint16Array(num_edges*ints_per_edge);

		const write_point=(i,vt)=> {
			let vi = i*floats_per_vert;
			for(let j=0;j<floats_per_vert;vi++,j++) {
				this.#_verts[vi] = vt[j];
			}
		}
// 0 -> [1,0,0], 1 -> [0,1,0], 2 -> [0,0,1]
		write_point(0, [0,0,0, 1,0,0]);
		write_point(1, [1,0,0, 1,0,0]);
		write_point(2, [0,0,0, 0,0,1]);
		write_point(3, [0,1,0, 0,0,1]);
		write_point(4, [0,0,0, 0,1,0]);
		write_point(5, [0,0,1, 0,1,0]);

		this.#_vbo = ctx.createBuffer();
		this.#_ebo = ctx.createBuffer();
// ran once and is separate from update:
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bufferData(ctx.ARRAY_BUFFER, this.#_verts, ctx.STATIC_DRAW);

		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
		ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, this.#_edges, ctx.STATIC_DRAW);
	}
	draw=(ctx)=> {
		const floats_per_vert = 6; // num of floats per vertex object	
		const num_verts = this.#_verts.length / floats_per_vert;
		ctx.drawArrays(ctx.LINES, 0, num_verts);
	}
	bind=(ctx)=> {
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
	}
}

class GL_Wireframe {
	#_vert_size;
	#_verts;
	#_edges;
	#_vbo;
	#_ebo;
	constructor(ctx, poly) {
		const fdata = CONSTRUCT_WIREFRAME(poly);
		this.#_vert_size = fdata.vert_size;
		this.#_verts = fdata.verts;
		this.#_edges = fdata.edges;

		this.#_vbo = ctx.createBuffer();	// vertex buffer object
		this.#_ebo = ctx.createBuffer(); // edge element object
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bufferData(ctx.ARRAY_BUFFER, this.#_verts, ctx.STATIC_DRAW);

		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
		ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, this.#_edges, ctx.STATIC_DRAW);
	}
	bind=(ctx)=> {
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
	}
	draw_edges=(ctx)=> {
		const num_edges = this.#_edges.length;
		ctx.drawElements(ctx.LINES, num_edges, ctx.UNSIGNED_SHORT, 0);
	}
	draw_points=(ctx)=> {
		const num_verts = this.#_verts.length;
		ctx.drawArrays(ctx.POINTS, 0, num_verts);
	}
}

class GL_Board {
// topologically a two dimensional manifold
	#_verts; // vertices of the grid
	#_edges; // edges of the grid
	#_vbo;   // vertex buffer object
	#_ebo;   // element array object
	#_dim;	 // dimensions of the 

	constructor(ctx, dim, color) {
		this.#_dim = dim;
		const dx = (this.#_dim.x()+1)^0, dy = (this.#_dim.y()+1)^0;
// total number of vertices in a 2D grid given x,y voxels
		const num_verts = dx*dy;
		const num_edges = (dx-1)*dy + (dy-1)*dx;
		const ints_per_edge = 2;
		const floats_per_vert = 6;

		const write_color=(i,vt)=> {
			let vi = i*floats_per_vert;
			for(let j=0;j<3;vi++,j++) {
				this.#_verts[vi+3] = vt[j];
			}
		}
		const write_point=(i,vt)=> {
			let vi = i*floats_per_vert;
			for(let j=0;j<3;vi++,j++) {
				this.#_verts[vi] = vt[j];
			}
		}
		const write_edge=(i,et)=> {
			let ei = i*ints_per_edge;
			for(let j=0; j<ints_per_edge; ei++, j++) {
				this.#_edges[ei] = et[j];
			}
		}
		this.#_verts = new Float32Array(num_verts*floats_per_vert);
		this.#_edges = new Uint16Array(num_edges*ints_per_edge);

		this.#_vbo = ctx.createBuffer();
		this.#_ebo = ctx.createBuffer();

// populate lattice
		let ix = 0, iy = 0;
		for(let i=0;i<num_verts;i++) {
			ix = (i % dx)^0;
			iy = (i / dy)^0;
			write_point(i, [ix / (dx-1),iy / (dy-1), 0]);
			write_color(i, color);
		}
// populate edges
		let ei=0;
// populate horizontally
		for(let iy=0;iy<dy;iy++) {
			for(let ix=0;ix<dx-1;ix++) {
				let i = iy*dx + ix;
				write_edge(ei++, [i, i+1]);
			}
		}
// populate vertically
		for(let ix=0;ix<dx;ix++) {
			for(let iy=0;iy<dy-1;iy++) {
				let i = iy*dx + ix;
				write_edge(ei++, [i, i + dx]);
			}
		}
// ran once and is separate from update:
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bufferData(ctx.ARRAY_BUFFER, this.#_verts, ctx.STATIC_DRAW);

		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
		ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, this.#_edges, ctx.STATIC_DRAW);
	}
/* draw calls assume context switches have already occured via bind(...) */
	draw_edges=(ctx)=> {
		const num_edges = this.#_edges.length;
		ctx.drawElements(ctx.LINES, num_edges, ctx.UNSIGNED_SHORT, 0);
	}
	draw_points=(ctx)=> {
		const floats_per_vert = 6; // num of floats per vertex object	
		const num_verts = this.#_verts.length / floats_per_vert;
		ctx.drawArrays(ctx.POINTS, 0, num_verts);
	}
	bind=(ctx)=> {
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
	}
}

class GL_BBox {
	#_verts; // vertices of the AABB (x,y,z,r,g,b)
	#_edges; // edges of the AABB (e0, e1)
	#_vbo;   // vertex array object
	#_ebo;   // element array object

	constructor(ctx, bbox, color) {
		const min = bbox.min();
		const max = bbox.max();
	
		// floats per element = 3 xyz, 3 rgb
		const num_verts = 8; // eight vertices in a dilated cube
		const floats_per_vert = 6; // num of floats per vertex object	

		const num_edges = 12;
		const ints_per_edge = 2;

		this.#_verts = new Float32Array(num_verts*floats_per_vert);
		this.#_edges = new Uint16Array(num_edges*ints_per_edge);
		this.#_vbo = ctx.createBuffer();
		this.#_ebo = ctx.createBuffer();

		this.write_points(ctx, bbox);
		this.write_colors(ctx, color);
// ran once and is separate from update:
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bufferData(ctx.ARRAY_BUFFER, this.#_verts, ctx.STATIC_DRAW);

		const write_edge=(i,et)=> {
			let ei = i*ints_per_edge;
			for(let j=0; j<ints_per_edge; ei++, j++) {
				this.#_edges[ei] = et[j];
			}
		}
// form chains along AABB
		for(let j=0;j<2;j++) {
			for(let i=0;i<4;i++) {
				let r = 4*j;
				write_edge(i+r, [i+r, ((i+1)%4)^0 + r]);
			}	
		}
// edges that connect the two bounding chains	
		for(let i=0;i<4;i++) {
			write_edge(8+i, [i, i+4]);
		}

		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
		ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, this.#_edges, ctx.STATIC_DRAW);
	}
	write_colors=(ctx, color)=> {
		const floats_per_vert = 6; // num of floats per vertex object	
		const num_verts = 8; // num of vertices total
		for(let vi = 0; vi < floats_per_vert * num_verts; vi += floats_per_vert) {
			for(let i=0;i<3;i++) {
				this.#_verts[vi + i + 3] = color[i];
			}
		}
	}
// updates the values in the vertex mesh accordingly
	write_points=(ctx, bbox)=> {
		const min = bbox.min();
		const max = bbox.max();

		const floats_per_vert = 6; // num of floats per vertex object	

		const write_point=(i,vt)=> {
			let vi = i*floats_per_vert;
			for(let j=0;j<3;vi++,j++) {
				this.#_verts[vi] = vt[j];
			}
		}

		write_point(0, [ min.x(), min.y(), min.z() ]); // 0
		write_point(1, [ max.x(), min.y(), min.z() ]); // 1
		write_point(2, [ max.x(), min.y(), max.z() ]); // 2
		write_point(3, [ min.x(), min.y(), max.z() ]); // 3

		write_point(4, [ min.x(), max.y(), min.z() ]); // 4
		write_point(5, [ max.x(), max.y(), min.z() ]); // 5
		write_point(6, [ max.x(), max.y(), max.z() ]); // 6
		write_point(7, [ min.x(), max.y(), max.z() ]); // 7
	}
	upload=(ctx)=> {
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bufferSubData(ctx.ARRAY_BUFFER, 0, this.#_verts);
	}
/* draw calls assume context switches have already occured via bind(...) */
	draw_edges=(ctx)=> {
		const num_verts = 24; // twelve edges in cube, two vertices per edge
		ctx.drawElements(ctx.LINES, num_verts, ctx.UNSIGNED_SHORT, 0);
	}
	draw_points=(ctx)=> {
		const num_verts = 8;
		ctx.drawArrays(ctx.POINTS, 0, num_verts);
	}
	bind=(ctx)=> {
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#_vbo);
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#_ebo);
	}
}

const SET_POINT_SIZES=(ctx, progs, size=16.0)=> {
	for(const shader of Object.values(progs)) {
		ctx.useProgram(shader.program);
		GL_SET_UNIFORM(ctx, shader.program, '1f', 'uPointSize', size);
	}
}

const POINT_VERTEX_SHADER = `#version 300 es
	precision mediump float;
// vertex attrs
	in vec3 aPos;
	in vec3 aCol;

// uniforms
	uniform float uPointSize;
	uniform mat4 uViewMatrix, uMatrix, uProject;
// outs
	out vec3 vAlbedo;

	void main() {
		float div = 1.0;

		vec4 pos = uViewMatrix * uMatrix * vec4(aPos, 1.);
		gl_Position = (uProject * pos) * vec4(1., 1., 1., 1. + div);
		gl_PointSize = uPointSize / (1. + gl_Position.w);
	
		vAlbedo = aCol;
	}`;

const POINT_FRAGMENT_SHADER = `#version 300 es
	precision mediump float;
// varyings (interpolations)
	in vec3 vAlbedo;
// outs
	out vec4 fragColor;

	void main() {
		vec2 dif = gl_PointCoord - vec2(0.5);
		float dis = dot(dif,dif);
		if(dis > 0.25)
			discard;

		fragColor = vec4(vAlbedo.xyz, 1.);
	}`;

const LINE_VERTEX_SHADER = `#version 300 es
	precision mediump float;
// vertex attrs
	in vec3 aPos;
	in vec3 aCol;
// outs
	out vec3 vAlbedo;

// uniforms
	uniform mat4 uViewMatrix, uMatrix, uProject;

	void main() {
		float div = 1.0;
	
		vec4 pos = uViewMatrix * uMatrix * vec4(aPos, 1.);
		gl_Position = (uProject * pos) * vec4(1., 1., 1., 1. + div);

		vAlbedo = aCol;
	}`;

const LINE_FRAGMENT_SHADER = `#version 300 es
	precision mediump float;
// ins
	in vec3 vAlbedo;
// outs
	out vec4 fragColor;

	void main() {
		fragColor = vec4(vAlbedo, 1.);
	}`;

const DEFAULT_VERTEX_SHADER = `#version 300 es
	precision mediump float;
// vertex attributes
	in vec3 aPos, aNor; 
	in vec2 aUV; 

// interpolated
	out vec3 vPos, vNor;
	out	vec2 vUV;

// transformations
	uniform mat4  uViewMatrix, uMatrix, uInvMatrix, uProject;

	void main() {
		float div = 1.0;

		vec4 pos = uViewMatrix * uMatrix * vec4(aPos, 1.);

		vUV = aUV;
 	    vNor = vec3(vec4(aNor, 0.) * uInvMatrix);
		vPos = pos.xyz;

		gl_Position = (uProject * pos) * vec4(1., 1., 1., 1. + div);
	}`;

const DEFAULT_FRAGMENT_SHADER = `#version 300 es
	precision mediump float;
// interpolated
	in vec3 vPos, vNor;
	in vec2 vUV;

	out vec4 fragColor;

// phong matrix
	uniform vec3  uAlbedo;

// texture
	uniform sampler2D uSampler;

	void main() {
		vec3 diffuse = texture(uSampler, vUV).rgb * uAlbedo;
		fragColor = vec4(diffuse, 1.);
	}`;

const GL_DEFAULT_ATTR=(ctx, prog_s)=> {
	const BPE = Float32Array.BYTES_PER_ELEMENT;
	const vert_size = 6;
// VERTEX ATTRIBUTE STRUCTURE:
// || ----------- ||
// ||  X   Y   Z  || -aPos := attribute object-space vertex position		(3 elements)
// || ----------- || 
// ||  R   G   B  || -aCol := attribute homogenous-space color				(3 elements)
// || ----------- ||
// VERTEX POSITION (XYZ)
	const aPos = ctx.getAttribLocation(prog_s, 'aPos');
	const aCol = ctx.getAttribLocation(prog_s, 'aCol');

	ctx.enableVertexAttribArray(aPos);
	ctx.vertexAttribPointer(aPos, 3, ctx.FLOAT, false, vert_size*BPE, 0*BPE);

	ctx.enableVertexAttribArray(aCol);
	ctx.vertexAttribPointer(aCol, 3, ctx.FLOAT, false, vert_size*BPE, 3*BPE);
}

const GL_SET_MVP=(ctx, prog_s, model, inv_view, project)=> {
	GL_SET_UNIFORM(ctx, prog_s, 'Matrix4fv', 'uMatrix',	 	false, model);
	GL_SET_UNIFORM(ctx, prog_s, 'Matrix4fv', 'uViewMatrix', false, inv_view);
	GL_SET_UNIFORM(ctx, prog_s, 'Matrix4fv', 'uProject', 	false, project);
}
