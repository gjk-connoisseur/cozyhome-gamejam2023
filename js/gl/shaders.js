// this will be where all of our default shaders
// are stored. As well as this, we will have some
// functions that will automatically compile, and
// draw things to the screen
// -DC @ 7/22/23

const DRAW_GL_OBB=(ctx, lines_s, points_s, 
		obb, gl_box, 
		inv_view, project, 
		draw_aabb=false,
		c1=[1,0,0], c2=[0,1,0])=> {
	GL_BOX_OBJ.write_colors(ctx, c1);
	GL_BOX_OBJ.write_points(ctx, OBB_OBJ.obb_box());
	GL_BOX_OBJ.upload(ctx);
		
	DRAW_GL_BOX(ctx, lines_s, points_s,
		gl_box, OBB_OBJ.l2w(), inv_view, project
	);

	if(draw_aabb) {
		GL_BOX_OBJ.write_colors(ctx, c2);
		GL_BOX_OBJ.write_points(ctx, OBB_OBJ.aabb_box());
		GL_BOX_OBJ.upload(ctx);

		DRAW_GL_BOX(ctx, lines_s, points_s,
			gl_box, mIdentity4x4(), inv_view, project
		);
	}
}

const DRAW_GL_BOX=(ctx, lines_s, points_s, gl_box, model, inv_view, project)=> {
// guarantee that we are still using the lines program
	ctx.useProgram(lines_s);
	gl_box.bind(ctx, lines_s);

	const BPE = Float32Array.BYTES_PER_ELEMENT;
	const vert_size = 6;
// VERTEX ATTRIBUTE STRUCTURE:
// || ----------- ||
// ||  X   Y   Z  || -aPos := attribute object-space vertex position		(3 elements)
// || ----------- || 
// ||  R   G   B  || -aCol := attribute homogenous-space color				(3 elements)
// || ----------- ||
// VERTEX POSITION (XYZ)
	let aPos = ctx.getAttribLocation(lines_s, 'aPos');
	let aCol = ctx.getAttribLocation(lines_s, 'aCol');

	ctx.enableVertexAttribArray(aPos);
	ctx.vertexAttribPointer(aPos, 3, ctx.FLOAT, false, vert_size*BPE, 0*BPE);

	ctx.enableVertexAttribArray(aCol);
	ctx.vertexAttribPointer(aCol, 3, ctx.FLOAT, false, vert_size*BPE, 3*BPE);

	GL_SET_UNIFORM(ctx, lines_s, 'Matrix4fv', 'uMatrix',	 false, model);
	GL_SET_UNIFORM(ctx, lines_s, 'Matrix4fv', 'uViewMatrix', false, inv_view);
	GL_SET_UNIFORM(ctx, lines_s, 'Matrix4fv', 'uProject', 	 false, project);

// draw edges using the edge shaders
	gl_box.draw_edges(ctx);

// we'll need to context switch to the points program
// in order to draw the vertices
	ctx.useProgram(points_s);
	gl_box.bind(ctx, points_s);

	aPos = ctx.getAttribLocation(points_s, 'aPos');
	aCol = ctx.getAttribLocation(points_s, 'aCol');

	ctx.enableVertexAttribArray(aPos);
	ctx.vertexAttribPointer(aPos, 3, ctx.FLOAT, false, vert_size*BPE, 0*BPE);

	ctx.enableVertexAttribArray(aCol);
	ctx.vertexAttribPointer(aCol, 3, ctx.FLOAT, false, vert_size*BPE, 3*BPE);

	GL_SET_UNIFORM(ctx, points_s, '1f', 'uPointSize', 8.0);
	GL_SET_UNIFORM(ctx, points_s, 'Matrix4fv', 'uMatrix',	  false, model);
	GL_SET_UNIFORM(ctx, points_s, 'Matrix4fv', 'uViewMatrix', false, inv_view);
	GL_SET_UNIFORM(ctx, points_s, 'Matrix4fv', 'uProject', 	  false, project);

// draw points using the point shaders
	gl_box.draw_points(ctx);
}

class GL_BBox {
	_verts; // vertices of the AABB (x,y,z,r,g,b)
	_edges; // edges of the AABB (e0, e1)
	_vbo;   // vertex array object
	_ebo;   // element array object

	constructor(ctx, bbox, color) {
		const min = bbox.min();
		const max = bbox.max();
	
		// floats per element = 3 xyz, 3 rgb
		const num_verts = 8; // eight vertices in a dilated cube
		const floats_per_vert = 6; // num of floats per vertex object	

		const num_edges = 12;
		const ints_per_edge = 2;

		this._verts = new Float32Array(num_verts*floats_per_vert);
		this._edges = new Uint16Array(num_edges*ints_per_edge);
		this._vbo = ctx.createBuffer();
		this._ebo = ctx.createBuffer();

		this.write_points(ctx, bbox);
		this.write_colors(ctx, color);
// ran once and is separate from update:
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this._vbo);
		ctx.bufferData(ctx.ARRAY_BUFFER, this._verts, ctx.STATIC_DRAW);

		const write_edge=(i,et)=> {
			let ei = i*ints_per_edge;
			for(let j=0; j<ints_per_edge; ei++, j++) {
				this._edges[ei] = et[j];
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

		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this._ebo);
		ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, this._edges, ctx.STATIC_DRAW);
	}
	write_colors=(ctx, color)=> {
		const floats_per_vert = 6; // num of floats per vertex object	
		const num_verts = 8; // num of vertices total
		for(let vi = 0; vi < floats_per_vert * num_verts; vi += floats_per_vert) {
			for(let i=0;i<3;i++) {
				this._verts[vi + i + 3] = color[i];
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
				this._verts[vi] = vt[j];
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
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this._vbo);
		ctx.bufferSubData(ctx.ARRAY_BUFFER, 0, this._verts);
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
		ctx.bindBuffer(ctx.ARRAY_BUFFER, this._vbo);
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this._ebo);
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
		gl_PointSize = uPointSize;
	
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
		fragColor = vec4(vAlbedo.xyz, 1.);
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

