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

function mousePressed() {
	const mv = new vec2(mouseX, mouseY);
	if(NSE_E) NSE_E.man.onClick(mouseButton, mv);
}

function mouseReleased() {
	const mv = new vec2(mouseX, mouseY);
	if(NSE_E) NSE_E.man.onClickReleased(mouseButton, mv);
}

function keyPressed() { if(NSE_E) NSE_E.man.onKeyPressed(keyCode); }
function keyReleased() { if(NSE_E) NSE_E.man.onKeyReleased(keyCode); }

function mouseWheel(event) { if(NSE_E) NSE_E.man.onScrollWheel(event); }

function preload() {}

function setup() {
	GENERATE_VOXEL_MESH();
	MESH = CUBE_MESH();
// create graphics state objects
	const iw = windowWidth*.9;
	const ih = min(windowHeight*.95,iw*4/5);
	P5GL = BOOTSTRAP_P5GL(iw,ih,iw,ih);
	NSE_E = CONSTRUCTOR_P5GL_FSE(SCENE_FSM, P5GL);

	const center_view = document.getElementById('overlay');
	if(center_view) {
		center_view.style.width  = `${iw}px`;
		center_view.style.height = `${ih}px`;
	}

// disable right clicking override
	document.addEventListener("contextmenu", (event) => { event.preventDefault(); });
}

function draw() {
	NSE_E.fsm.pulse(NSE_E.man);
	FLUSH_GL(P5GL);
}

const FLUSH_GL=(p5gl)=> {
	const glb  = p5gl.glb; // framebuffer
	const p5b  = p5gl.p5b; // p2d buffer
// canvas
	const p5c = p5gl.p5c;
// dumping 3D viewport framebuffer
	image(glb,0,0,p5c.width,p5c.height);
// dumping 2D viewport imagebuffer
	image(p5b,0,0,p5c.width,p5c.height);

	glb.clear();
	glb.background(10,10,10);
}

// adds some more data for our state machine entity
const CONSTRUCTOR_P5GL_FSE=(fsm,p5gl,man,init)=> {
	return CONSTRUCTOR_FSE_OVERRIDE(fsm,man,init, (ent)=> {
// executes before setup(...)
		ent.man.p5gl = p5gl;
		ent.man.isActive = () => { return ACTIVE; }
		ent.man.isLocked = () => { return LOCKED; }
// give entity access to I/O
		ent.man.onClick 	  	= (mb, mv) => {};
		ent.man.onClickReleased = (mb, mv) => {};
		ent.man.onKeyPressed  	= (kc) => {};
		ent.man.onKeyReleased 	= (kc) => {};
		ent.man.onScrollWheel	= (e) => {};
		ent.man.mouseOut 	  	= () => {};
		ent.man.mouseOver 	  	= () => {};
	
		ACTIVE = true;
	
		ent.man.requestLock = () => { 
			LOCKED = true;
			requestPointerLock();
		};

		ent.man.requestFree = () => {
			LOCKED = false;
			exitPointerLock();
		};

		p5gl.p5c.mouseOut(()=>ent.man.mouseOut());
		p5gl.p5c.mouseOver(()=>ent.man.mouseOver());
	});
}

// responsible for constructing both the WebGL framebuffer and p2d
// image buffer.
const BOOTSTRAP_P5GL=(pw,ph,gw,gh)=> {
	const canvas = createCanvas(pw,ph);
	canvas.id("p5canvas");
	canvas.parent("#center_flexbox");

	const gl_buffer = createGraphics(gw,gh,WEBGL);	// WEBGL Renderer
	const p5_buffer = createGraphics(pw,ph,P2D);	// P2D Renderer
	const gl_ctx = gl_buffer.drawingContext;
	const init = GL_DEBUG_INIT(gl_ctx);

	frameRate(144);
	p5_buffer.frameRate(144);
	gl_buffer.frameRate(144);

	return {
		p5c:canvas,	   		  // the sketch canvas
		glb:gl_buffer, 		  // the WEBGL2 graphics buffer
		p5b:p5_buffer,		  // the P2D graphics buffer
		ctx:gl_ctx,	   		  // WebGL2RenderingContext
		shaders:init.shaders, // initial compiled program (QOL)
	}
}
