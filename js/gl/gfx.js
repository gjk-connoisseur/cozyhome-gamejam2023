///// WEBGL \\\\\\

// overrides the initialize context function in p5js renderer. Provided by:
// https://editor.p5js.org/a_/sketches/2zXozr2NJ
p5.RendererGL.prototype._initContext = function() {
	try {
		this.drawingContext =
		this.canvas.getContext('webgl2', this._pInst._glAttributes) ||
		this.canvas.getContext('experimental-webgl', this._pInst._glAttributes);
		if (this.drawingContext === null) {
			throw new Error('Error creating webgl context');
		} else {
			const gl = this.drawingContext;
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
				this._viewport = this.drawingContext.getParameter(
		   			this.drawingContext.VIEWPORT
			);
		}
	} catch (er) {
		throw er;
	}
};

const P5SCREEN_TO_VIEW_DIR=(p, p5b, view)=> {
	const rto = p5b.width/p5b.height;
// transforms from p5's coordinate frame to NDC
	p = P5SCREEN_TO_NDC(p, p5b, 0);
	p[0] *= (rto) * .5;
	p[1] *= .5;
	return mTransform4x4(view, p);
}

// takes a screen coordinate and transforms it into NDC
const P5SCREEN_TO_NDC=(p, p5b, t=0)=> {
	const w = p5b.width;
	const h = p5b.height;

	p[0] = (2*p[0]/w) - 1;
	p[1] = 1 - (2*p[1]/h);
	return [p[0],p[1],1,t];
}

// take a world point to screen coordinates
const WORLD_TO_NDC=(wp, inv_view, project)=> {
	const vp = mTransform4x4(inv_view, wp); // w2v
	const cp = mTransform4x4(project,  vp); // v2p
	
// perspective divide
	const w = (cp[3]);
	for(let i=0;i<3;i++) { cp[i] /= w; }

// we are now in NDC
	return cp;
}

// converts from NDC to default coordinate frame
const NDC_TO_P5SCREEN=(cp, p5b)=> {
	const w = p5b.width;
	const h = p5b.height;

	return [w*(cp[0]/4 + 0.5), h*(0.5 - cp[1]/4), cp[3]];
}

const WORLD_TO_P5SCREEN=(wp, inv_view, project, p5b)=> {
// normalized device coordinates
	const cp = WORLD_TO_NDC(wp, inv_view, project);
// scale and interpolate to screen
	return NDC_TO_P5SCREEN(cp, p5b);
}

const CONSTRUCT_DEFAULT_SHADERS=(ctx)=> {
	let shaders = {};
// standard vertex/fragment shader for fullbright
	shaders.standard = GL_CONSTRUCT_PROGRAM(ctx, DEFAULT_VERTEX_SHADER, DEFAULT_FRAGMENT_SHADER);
// standard line program for drawing wireframes
	shaders.lines = GL_CONSTRUCT_PROGRAM(ctx, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
// standard point program for drawing points
	shaders.points = GL_CONSTRUCT_PROGRAM(ctx, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);
	return shaders;
}

// LIFETIME:
// GL_CREATE_PROGRAM()
	// GL_CREATE_SHADER() (vert)
	// GL_CREATE_SHADER() (frag)
	// GL_ATTACH_SHADER(S) ()

// canvas, vertex shader, fragment shader
const GL_CREATE_PROGRAM=(ctx)=> { return ctx.createProgram(); }

// create, compile, and attach shader to program
// ctx := webgl rendering context
// program := program we are attaching our shader to
// type := shader type
// src := newline enumerated shader code source string
const GL_CREATE_SHADER=(ctx, type, src)=> {
	let gl_type = null;
	if(type == 'vert') 		gl_type = ctx.VERTEX_SHADER;
	else if(type == 'frag') gl_type = ctx.FRAGMENT_SHADER;
	else return { error:true, msg: 'shader type was not correctly specified. see GL_CREATE_SHADER for details' };

	let shader = ctx.createShader(gl_type);
	ctx.shaderSource(shader, src);
	ctx.compileShader(shader);
// determine compilation success
	if(!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
// shader failed to compile
		let msg = ctx.getShaderInfoLog(shader);
		return {
			shader:null,
			error:true,
			msg:msg,
		}
	}else {
// shader successfully compiled
		return {
			shader:shader,
			error:false,
			msg:null
		}
	}
}

// used in conjunction with GL_CREATE_SHADER to attach a compiled shader to a 
// program.
const GL_ATTACH_SHADER=(ctx, program, shader)=> { ctx.attachShader(program, shader); }
// linking a program is the final step in its creation before usage. This is usually
// used in conjunction with GL_USE_PROGRAM
const GL_LINK_PROGRAM=(ctx, program)=> {
	try {
		ctx.linkProgram(program);
	}catch(e) {
		console.log("GLPROGRAM LINK ERROR:", e);
	}
}
// this contextually switches the operating context of GL's current shader.
const GL_USE_PROGRAM=(ctx, program)=> {
	try {
		ctx.useProgram(program);
	}catch(e) {
		console.log("GLPROGRAM USE ERROR:", e);
	}
}

// set non-varying data in provided gl program
const GL_SET_UNIFORM=(ctx, program, type, name, a, b, c, d)=> {
	const loc = ctx.getUniformLocation(program, name);
	(ctx['uniform'+type])(loc, a, b, c, d);
}

// this function is responsible for initializing the input data structures
// sent to the GPU during a draw call
// abfr := array buffer ID
const GL_INIT_VERTEXATTR=(ctx, program)=> {
// notify GL we want a buffer to represent an array of
// VERTEX, ATTRIBUTE, DATA!
	const BPE = Float32Array.BYTES_PER_ELEMENT;
	const vert_size = 8;
// we will assume the following for our vertex and fragment shaders:
//		data type: GL.FLOAT
// VERTEX ATTRIBUTE STRUCTURE:
// ||  X   Y   Z  || -aPos := attribute object-space vertex position		(3 elements)
// || ----------- ||
// || NX  NY  NZ  || -aNor := attribute object-space normal					(3 elements)
// || ----------- ||
// ||  U	   V  || -aUV  := attribute object-space UV "unwrap" position	(2 elements)
// || ----------- ||
// VERTEX POSITION (XYZ)
	const aPos = ctx.getAttribLocation(program, 'aPos');
	ctx.enableVertexAttribArray(aPos);
	ctx.vertexAttribPointer(aPos, 3, ctx.FLOAT, false, vert_size*BPE, 0*BPE);
// VERTEX NORMAL (NX,NY,NZ)
	const aNor = ctx.getAttribLocation(program, 'aNor');
	ctx.enableVertexAttribArray(aNor);
	ctx.vertexAttribPointer(aNor, 3, ctx.FLOAT, false, vert_size*BPE, 3*BPE);
// VERTEX UNWRAVEL (UV)
	const aUV  = ctx.getAttribLocation(program, 'aUV');
	ctx.enableVertexAttribArray(aUV);
	ctx.vertexAttribPointer(aUV, 2, ctx.FLOAT, false, vert_size*BPE, 6*BPE);
}

// run this if you don't want to think about initializing GL correctly
const GL_STANDARD_INIT=(ctx)=> {
// enable z-buffer
	ctx.enable(ctx.DEPTH_TEST);
// cull back faces
	ctx.enable(ctx.CULL_FACE);
	ctx.frontFace(ctx.CW);
// newer depth fragments that are closer to the screen pass into the fragment shader
	ctx.depthFunc(ctx.LEQUAL);
// default depth value every frame is reset to -1 (which clamps to zero via kronos docs)
	ctx.clearDepth(-1);
// enable transparency component
	ctx.enable(ctx.BLEND);
// transparency function
	ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
}

// constructs, compiles and links a new gl program
const GL_CONSTRUCT_PROGRAM=(ctx, vs, fs)=> {
	if(vs == null || fs == null) {
		return {
			error:true,
			msg:"shaders supplied were null",
			program:null
		}
	}
	if(ctx == null) {
		return {
			error:true,
			msg:"gl context supplied was null",
			program:null
		}
	}

	const program 		= GL_CREATE_PROGRAM(ctx);
	const vertex_s 		= GL_CREATE_SHADER(ctx, 'vert', vs);
	const fragment_s	= GL_CREATE_SHADER(ctx, 'frag', fs);

	if(vertex_s.error || fragment_s.error) {
		if(vertex_s.error) console.log(vertex_s.msg);
		if(fragment_s.error) console.log(fragment_s.msg);
		return {
			error:true,
			msg:"error: shader compilation failed",
			program:null,
			vs:vertex_s,
			fs:fragment_s
		}
	}

// attach shaders to program
	GL_ATTACH_SHADER(ctx, program, vertex_s.shader);
	GL_ATTACH_SHADER(ctx, program, fragment_s.shader);

	GL_LINK_PROGRAM(ctx, program);
	return {
		error:false,
		msg:"program construction successful",
		program:program
	}
}

const GL_DEBUG_INIT=(ctx)=> {
// set up default program
	const vert_size	= 8;
// construct and compile shaders
	const shaders = CONSTRUCT_DEFAULT_SHADERS(ctx);
	for(const shader_key in shaders) {
		const shader = shaders[shader_key];
		if(shader.error) {
			console.log(shader.msg);
			return;
		}
	}

// set up buffers
	GL_STANDARD_INIT(ctx);

// return the active attribute buffer token
// return the default compiled program token
	return { shaders:shaders };
}

// construct texture(QOL)
const GL_CREATE_TEXTURE=(ctx, img, flip=false)=> {
	const tex = ctx.createTexture();
	ctx.bindTexture(ctx.TEXTURE_2D, tex);
	img.loadPixels();
	const px = img.pixels;

	if(flip) {
		ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
	}

	ctx.texImage2D(
		ctx.TEXTURE_2D, 	// texture 2D type
		0,					// LEVEL OF DETAIL
		ctx.RGBA, 			// RGBA format (INTERNAL FORMAT)
		img.width,			// texture width
		img.height,			// texture height
		0,					// border width (must be 0)
		ctx.RGBA,			// CONVERTED FORMAT
		ctx.UNSIGNED_BYTE,	// 8 bits per channel (32 bits total)
		px					// the actual pixels array!
	);

// x coordinate of texture will clamp to edge
	ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
// y coordinate of texture will clamp to edge
	ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
// texture minification filter (when far away)
	ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
// texture maxification filter (when close by)
	ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);

	if(flip) {
		ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
	}

	return tex;
}

// taken from MDN documentation
// https://jsfiddle.net/tatumcreative/86fd797g/
const GL_PERSPECTIVE=(w=1,h=1)=> {
	const fov = 0.5;
	const aspect = w/h;
	const near = 0.1;
	const far = 100;
	return GL_PERSPECTIVE_MATRIX(fov,aspect,near,far);
}

const GL_PERSPECTIVE_MATRIX=(fov, aspect, near, far)=> {
	const f = 1 / Math.tan(fov / 2);
	return [
		f/aspect,	0, 						  0, 		0,
		0,			f,						  0,		0,
		0,			0,(near + far)/(near - far),	   	1, /*handedness*/
		0,			0,	2*(near*far/(near-far)),	    0
	];
}

const GL_ORTHOGRAPHIC=(s=7,w=1,h=1)=> {
	const aspect = w/h;
	return GL_ORTHOGRAPHIC_MATRIX(-s*aspect,+s*aspect,-s,+s,0.1,100);
}

const GL_ORTHOGRAPHIC_MATRIX=(left, right, bottom, top, near, far)=> {
// Each of the parameters represents the plane of the bounding box
    var lr = 1 / (left - right);
    var bt = 1 / (bottom - top);
    var nf = 1 / (near - far);
	
    var row4col1 = (left + right) * lr;
    var row4col2 = (top + bottom) * bt;
    var row4col3 = (far + near) * nf;
  
    return [
       -2 * lr,        0,        0, 0,
             0,  -2 * bt,        0, 0,
             0,        0,   2 * nf, 0,
      row4col1, row4col2, row4col3, 1
    ];
  }

//// WEBGL \\\\\\
