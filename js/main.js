// CREDITS: Daniel J. Cucuzza
// DATE: June 22nd, 2023
// You can contact me at gaunletgames@gmail.com if you have
// any questions about the implementation or if you notice
// any errors.

let P5GL;		// p5 drawing context
let NSE_E; 		// program entity
let VIEW;		// view context

let ACTIVE;		// is active

let OBB_OBJ;
let GL_BOX_OBJ;

function mousePressed() {
	const mv = new vec2(mouseX, mouseY);
	NSE_E.man.onClick(mv);
	if(ACTIVE) { requestPointerLock(); }
	if(!ACTIVE) ACTIVE = true;
}

function keyPressed() { 
	if(keyCode == 27) ACTIVE = false;
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
		ent.man.onFudge=(v)=>{};
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
	glb.background(10,50,90);
}

function preload() {
	loadImage("images/stone.png", (img)=> {
		IMG = img;
	});
}

function setup() {
	GENERATE_VOXEL_MESH();
	MESH = CUBE_MESH();
	P5GL = BOOTSTRAP_P5GL(1280,720,1280/4,720/4);
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
		man.fudge = 1;
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
		VIEW = new ViewContext3D(new vec3(0.5,0.5,0.5), new vec3(0,0,0));

		OBB_OBJ = new OBB(-1,1,-1,1,-1,1, mIdentity4x4());
		GL_BOX_OBJ = new GL_BBox(ctx, OBB_OBJ.obb_box(), [1,0,0]);
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

		const V = mInverse4x4(view_matrix);					// view
		const P = GL_DEBUG_PERSPECTIVE(width,height,100);	// perspective
	
		DRAW_GL_OBB(ctx, 
			p5gl.shaders["lines"].program,
			p5gl.shaders["points"].program,
			OBB_OBJ,
			GL_BOX_OBJ,
			V, P
		);
	},
	move:function(fsm,man) {
		const dt = deltaTime/1000;
		if(ACTIVE) {
			VIEW.mouselook(16 * dt, movedX, movedY);
			VIEW.move(16 * dt);
			VIEW.orbit(new vec3(0.5,-0.5,8.0));
		}
	}
}]);
