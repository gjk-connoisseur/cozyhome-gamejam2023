// CREDITS: Daniel J. Cucuzza
// DATE: June 22nd, 2023
// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

let P5GL;		// p5 drawing context
let NSE_E; 		// program entity
let VIEW;		// view context

let ACTIVE;		// is active
let LOCKED;		// mouse locked

let GL_TRIAD_OBJ; // triad wrapper

let GL_BOARD_OBJ; // gl board wrapper
let GL_GRID_M;

let OBB_OBJ;
let GL_BOX_OBJ;

function mousePressed() {
	const mv = new vec2(mouseX, mouseY);
	NSE_E.man.onClick(mv);
	if(ACTIVE) { 
		requestPointerLock(); 
		LOCKED = true;
	}
	if(!ACTIVE) ACTIVE = true;
}

function keyPressed() { 
	if(keyCode == 27) {
		ACTIVE = false;
		LOCKED = false;
	}
	if(ACTIVE) NSE_E.man.onKeyTyped(keyCode);
}

// (pw,ph) := p5canvas span
// (gw,gh) := webgl canvas span
const BOOTSTRAP_P5GL=(pw,ph,gw,gh)=> {
	const canvas = createCanvas(pw,ph);
	canvas.id("p5canvas");
	canvas.parent("#center_flexbox");

	frameRate(144);
	const gl_buffer = createGraphics(gw,gh,WEBGL);	// WEBGL Renderer
	const p5_buffer = createGraphics(pw,ph,P2D);	// P2D Renderer
	const gl_ctx = gl_buffer.drawingContext;
	const init = GL_DEBUG_INIT(gl_ctx, DEFAULT_VERTEX_SHADER, DEFAULT_FRAGMENT_SHADER);

	return {
		p5c:canvas,	   		  // the sketch canvas
		glb:gl_buffer, 		  // the WEBGL2 graphics buffer
		p5b:p5_buffer,		  // the P2D graphics buffer
		ctx:gl_ctx,	   		  // WebGL2RenderingContext
		shaders:init.shaders, // initial compiled program (QOL)
	}
}

// adds some more data for our state machine entity
const CONSTRUCTOR_P5GL_FSE=(fsm,p5gl,man,init)=> {
	return CONSTRUCTOR_FSE_OVERRIDE(fsm,man,init, (ent)=> {
// give the entity access to drawing buffers
		ent.man.p5gl = p5gl;
// give entity access to I/O
		ent.man.onClick=()=>{};
		ent.man.onKey=(kc)=>{};
		ent.man.mouseOut=()=>{};
		ent.man.mouseOver=()=>{};
		p5gl.p5c.mouseOut(()=>ent.man.mouseOut());
		p5gl.p5c.mouseOver(()=>ent.man.mouseOver());
	});
}

const FLUSH_GL=(p5gl)=> {
// renderer buffers
	const glb  = p5gl.glb;
	const p5b  = p5gl.p5b;
// canvas
	const p5c = p5gl.p5c;
	noSmooth();

	image(glb,0,0,p5c.width,p5c.height);
	image(p5b,0,0,p5c.width,p5c.height);

	glb.clear();
	glb.background(10,10,10);
}

function preload() {
	loadImage("images/stone.png", (img)=> { IMG = img; });
}

function setup() {
	const iw = windowWidth*.9;
	const ih = min(windowHeight*.95,iw*9/16);

	GENERATE_VOXEL_MESH();
	MESH = CUBE_MESH();
	P5GL = BOOTSTRAP_P5GL(iw,ih,iw/2,ih/2);
	NSE_E = CONSTRUCTOR_P5GL_FSE(NSE_FSM, P5GL);
}

function draw() {
	NSE_E.fsm.pulse(NSE_E.man);
	FLUSH_GL(P5GL);
}

const NSE_FSM = new FSM([{
	key:'init',
	setup:function(fsm,man) {},
	enter:function(prev,fsm,man) {
		fsm.cswitch(man, 'nse');
	},
	exit:function(next,fsm,man) {},
	pulse:function(fsm,man) {}
},
{
	key:'nse',
	setup:function(fsm,man) {},
	enter:function(prev,fsm,man) {
		const p5gl = man.p5gl;	// p5gl bundle
		const ctx = p5gl.ctx;	// drawingContext

// generate view context		
		VIEW = new ViewContext3D(new vec3(0,0,0), new vec3(0,0,0));

		OBB_OBJ    = new OBB(0,1,0,1,0,1, mIdentity4x4());
		GL_BOX_OBJ = new GL_BBox(ctx, OBB_OBJ.obb_box(), [1,0,0]);

		GL_BOARD_OBJ = new GL_Board(ctx, new vec2(16,16), [0.5,0.5,0.5]);
		GL_GRID_M = 
			mMultiply4x4(
				mTranslate4x4(-8,0,-8),
				mMultiply4x4(
					mScale4x4(16,-16,16),
					mRotx4x4(Math.PI/2))
		);

		GL_TRIAD_OBJ = new GL_Triad(ctx);

// overrides
		man.onClick=(mv)=> {
			if(mouseButton == LEFT) {}
			else if(mouseButton == CENTER) {}
			else if(mouseButton == RIGHT) {}
		}
		man.onKeyTyped=(key)=> {}
	},
	exit:function(next,fsm,man) {},
	pulse:function(fsm,man) {
		const p5gl = man.p5gl;	// p5gl bundle
		const ctx = p5gl.ctx;	// drawingContext
		const p5b = p5gl.p5b;	// image buffer
		
		p5b.clear();
		p5b.noFill();
		p5b.strokeWeight(1);
		p5b.stroke(255);
// draw origin
		p5b.stroke(0,255,0);
		p5b.circle(0,0,16);
// let mv = new vec2(mouseX, mouseY);
		this.move(fsm,man);

		const V = VIEW.mat();								// view
		const P = GL_DEBUG_PERSPECTIVE(width,height,100);	// perspective

		const IV = mInverse4x4(V);

		let mv = [mouseX, mouseY];
		if(LOCKED) {
			mv[0] = width/2;
			mv[1] = height/2;
		}

		let wd = P5SCREEN_TO_VIEW_DIR(mv.slice(), p5b, V);
		let wd_v3 = new vec3(...wd);
	
// test both against AABB and OBB
		let hit_axial = line_intersect_axial(VIEW.pos(), wd_v3, OBB_OBJ.aabb_box());
		let hit_orien = line_intersect_oriented(VIEW.pos(), wd_v3, 
			mInverse4x4(OBB_OBJ.l2w()), OBB_OBJ.obb_box()
		);

// convert to world coordinate
		let wp = add3(VIEW.pos(), mul3(hit_orien.toi, wd_v3));
// convert to screen co-ordinate
		let sp = WORLD_TO_P5SCREEN(wp.f4d(), IV, P, p5b);

		p5b.strokeWeight(2);
		if(hit_orien.toi < Number.POSITIVE_INFINITY) {
			p5b.circle(sp[0],sp[1],64/(hit_orien.toi));
			p5b.circle(sp[0],sp[1],32/(hit_orien.toi));
		}else {
			p5b.stroke(255);
			p5b.circle(mv[0],mv[1],16);
		}
		p5b.strokeWeight(1);

		OBB_OBJ.transform(mRoty4x4(deltaTime/1000));

		DRAW_GL_OBB(ctx, 
			p5gl.shaders["lines"].program, p5gl.shaders["points"].program,
			OBB_OBJ, GL_BOX_OBJ, // object bounding box, and its gl wrapper
			IV, P, // inverse view, projection matrix
			true, // draw AABB?
			hit_orien.toi < Number.POSITIVE_INFINITY ? [120,120,0] : [255,0,0],
			hit_axial.toi < Number.POSITIVE_INFINITY ? [120,0,120] : [0,255,0]
		);
	
		DRAW_GL_TRIAD(ctx,
			p5gl.shaders["lines"].program,
			GL_TRIAD_OBJ, OBB_OBJ.l2w(), IV, P
		);

		DRAW_GL_BOARD(ctx,
			p5gl.shaders["lines"].program, p5gl.shaders["points"].program,
			GL_BOARD_OBJ,
			GL_GRID_M, IV, P,
			false
		);

		DRAW_GL_TRIAD(ctx,
			p5gl.shaders["lines"].program,
			GL_TRIAD_OBJ, GL_GRID_M, IV, P
		);

	},
	move:function(fsm,man) {
		const dt = deltaTime/1000;
		if(ACTIVE) {
			VIEW.mouselook(16 * dt, movedX, movedY);
			VIEW.move(8 * dt);
			VIEW.orbit(new vec3(0.5,-0.5,8.0));
		}
	}
}]);
