
// statics

let TEX;		// texture object
let IMG;		// stone image to UV map

let MESH;		// debugging mesh
let ABUF;		// array buffer

// setup

// preload mesh
		ABUF = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, ABUF);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(MESH), ctx.STATIC_DRAW);
// preload texture
		TEX = GL_CREATE_TEXTURE(ctx, IMG, true);



// draw function
		const mesh = MESH;							// mesh array
		const prog = p5gl.shaders["standard"].program;	// gl program
		let matrix = mTranslate4x4(0.5,0,8.0);	// object matrix

		const view_matrix = VIEW.mat();	// view context 4x4
		const vert_size = 8; 			// standard vertex size

		const M = matrix;									// model
		const V = mInverse4x4(view_matrix);					// view
		const P = GL_DEBUG_PERSPECTIVE(width,height,100);	// perspective
		const IM = mInverse4x4(M);							// inverse model
	
// bind the program
		GL_USE_PROGRAM(ctx, prog);
// bind the vertex buffer
		ctx.bindBuffer(ctx.ARRAY_BUFFER, ABUF);
// set vertex attribute pointer
		GL_INIT_VERTEXATTR(ctx, prog);
// set the textures for render pass
		ctx.bindTexture(ctx.TEXTURE_2D, TEX);
		ctx.activeTexture(ctx.TEXTURE0);
// set the uniforms for render pass
		GL_SET_UNIFORM(ctx, prog, '1f', 	   'uFudgeFactor', man.fudge);
		GL_SET_UNIFORM(ctx, prog, '3fv', 	   'uAlbedo', new Float32Array([1.0,1.0,1.0]));
		GL_SET_UNIFORM(ctx, prog, 'Matrix4fv', 'uProject', 	 	false, P);
		GL_SET_UNIFORM(ctx, prog, 'Matrix4fv', 'uViewMatrix', 	false, V);
		GL_SET_UNIFORM(ctx, prog, 'Matrix4fv', 'uMatrix', 	 	false, M);
		GL_SET_UNIFORM(ctx, prog, 'Matrix4fv', 'uInvMatrix',  	false, IM);
		GL_SET_UNIFORM(ctx, prog, '1i', 	   'uSampler', 0);
// call GL.Draw(...)
		ctx.drawArrays(ctx.TRIANGLES, 0, mesh.length / vert_size);
