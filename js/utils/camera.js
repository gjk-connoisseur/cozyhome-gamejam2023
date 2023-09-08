// maps signals to real numbers
class InputMap {
	#_pk; #_nk; #_pv; #_nv; #_dv; #_lv; #_h;
	constructor(pk,nk,pv,nv,dv,h=false,mouse=false) {
		this.#_pk=pk; // positive keycode
		this.#_nk=nk; // negative keycode
		this.#_pv=pv; // positive value
		this.#_nv=nv; // negative value
		this.#_dv=dv; // dead value
		this.#_lv=dv; // last value
		this.#_h = h; // can we be continuously held down?
		this.down = mouse // are we capturing mouse input..?
			? (mc) => { return mouseIsPressed && mouseButton == mc; } // mouse press 
			: (kc) => { return keyIsDown(kc); } // key press
	}
	eval=()=> {
		let vl = this.#_dv;
 		if(this.down(this.#_pk) && !this.down(this.#_nk)) vl = this.#_pv;
		if(!this.down(this.#_pk) && this.down(this.#_nk)) vl = this.#_nv;
// check for holding down
		if(this.#_h) {
			return vl;
		}else {
			if(vl != this.dead() && vl == this.#_lv) vl = this.dead();
			else this.#_lv = vl;
		}
		return vl;
	}
	low=() 	=> this.#_nv;
	dead=()	=> this.#_dv;
	high=()	=> this.#_pv;
}

function createDropdown(header) {
	// Create the main container div
	const dropdownDiv = document.createElement('div');
	dropdownDiv.className = 'dropdown';
	dropdownDiv.style.width = 'fit-content'; 
	dropdownDiv.style.margin = '0'; 
	dropdownDiv.style.position = 'absolute';

	// Create the button element
	const button = document.createElement('button');
	button.className = 'btn btn-sm btn-secondary dropdown-toggle';
	button.type = 'button';
	button.setAttribute('data-bs-auto-close','inside');
	button.setAttribute('data-bs-toggle', 'dropdown');
	button.setAttribute('aria-expanded', 'false');
	button.textContent = header;

	// Create the ul element
	const ul = document.createElement('ul');
	ul.className = 'dropdown-menu';

	// Create the list items and anchor links
	const actions = ['Action', 'Another action', 'Something else here'];
	actions.forEach(actionText => {
		const li = document.createElement('li');
		const a = document.createElement('a');
		a.className = 'dropdown-item';
		a.href = '#';
		a.textContent = actionText;
		li.appendChild(a);
		ul.appendChild(li);
	});

	// Append elements to the main container
	dropdownDiv.appendChild(button);
	dropdownDiv.appendChild(ul);

	// Return the constructed dropdown
	return dropdownDiv;
}

// constructs a camera entity using position and euler
const CAMERA_CTOR=(pos, euler, props)=> {
	return CONSTRUCTOR_FSE_OVERRIDE(CAMERA_FSM, null, null, (ent)=> {
		ent.man.pos = pos;
		ent.man.euler = euler;
		Object.assign(ent.man, props);
	});
}

const CAMERA_FSM = new FSM([{
	key:'init',
	enter:function(prev,fsm,man) {
// pass transformation information in via the constructor function
		if(!man.pos) { man.pos = new vec3(0,0,0); }
		if(!man.euler) { man.euler = new vec3(0,0,0); }
// make sure we have access to information before constructing the viewcontext
		man.view = new ViewContext3D(man.pos, man.euler);
		delete man.pos; delete man.euler;

		if(man.useParallelProjection) {
			man.projection = man.genPerspectiveMatrix();
		}else {
			man.projection = man.genOrthographicMatrix();
		}

// variables
		man.minOrthographicScale = 1;
		man.orthographicScale 	 = 10;
		man.maxOrthographicScale = 20;
		man.altFire = false;
// getters
		man.getProjectionType	= () => man.useParallelProjection ? "parallel" : "orthographic";
		man.getProjectionMatrix = () => man.projection;
 		man.getViewPos 			= () => man.view.pos();
		man.getViewMatrix 		= () => man.view.mat();
		man.getViewAt 			= (w,h) => [0,0];
		man.getAimDir			= () => [movedX, movedY];		
		man.getWishDir			= () => man.useParallelProjection 
			? [man.rgtMap.eval(), man.upMap.eval(), man.fwdMap.eval() ]	// parallel projection mode
			: [man.rgtMap.eval(), man.fwdMap.eval(), 0]; 				// orthographic projection mode
// setters
		man.setProjectionMatrix = (b) => {
			if(b != man.useParallelProjection) {
				man.projection = b 
					? man.genPerspectiveMatrix() 
					: man.genOrthographicMatrix(man.orthographicScale);
				man.useParallelProjection = b;
				man.onPerspectiveChanged(man.getProjectionType(), man.projection);
			}
		}

		man.setOrthographicScale = (scale=1) => {
			scale = max(scale, man.minOrthographicScale);
			scale = min(scale, man.maxOrthographicScale);

			if(scale != man.orthographicScale && !man.useParallelProjection) {
				man.projection = man.genOrthographicMatrix(scale);
			}
			man.orthographicScale = scale;
		}

		if(man.requestFree) man.requestFree();
// generate inputs	
		man.fwdMap = new InputMap(87,83,1,-1,0,true,false);		// +X
		man.rgtMap = new InputMap(68,65,1,-1,0,true,false);		// +Y
		man.upMap  = new InputMap(81,69,1,-1,0,true,false); 	// +Z

		man.onKeyReleased=(kc)=> {
			if(kc == 16) {
				man.altFire = false;
				fsm.cswitch(man, 'free');
			}
		}

		man.onKeyPressed=(kc)=> {
// handling alt fire mode
			if(kc == 16) {
				man.altFire = true;
				return;
			}
// generate the type of projection matrix depending on the keybindings
			if(kc == 49 || kc == 50) {
				man.setProjectionMatrix(kc == 49);
				return;
			}
// handle entering/exiting fps mode
			if(kc == 90) {
				const next = man.cur().key;
				if(next == 'free') {
					fsm.cswitch(man, 'fps');
				}else if(next == 'fps') {
					fsm.cswitch(man, 'free');
				}
				return;
			}
		}

		man.onClick=(mb,mv)=> {
			if(man.altFire) {
				if(mb == LEFT) fsm.cswitch(man, 'orbit');
				if(mb == CENTER) fsm.cswitch(man, 'pan');
			}else {
				if(mb == RIGHT) {
					const center_view = document.getElementById('overlay');
					if(center_view) {
						const child = createDropdown("Viewport Menu");
						center_view.appendChild(child);

						child.style.left =`${mouseX}px`;
						child.style.top =`${mouseY}px`;
						man.dropdown = child;
					}
				}
				if(mb == CENTER) fsm.cswitch(man, 'orbit');
			}
		}

		man.onClickReleased=(mb,mv)=> {
			if(mb == CENTER) fsm.cswitch(man, 'free');
	
			if(man.altFire) {
				if(mb == LEFT) fsm.cswitch(man, 'free');
			}
		}

		man.onScrollWheel=(e)=> {
			const dx = e.delta;
			fsm.sget('zoom').setDeltaScroll(dx);
			fsm.cswitch(man, 'zoom');
		}
	},
	pulse:function(fsm,man) { fsm.cswitch(man, 'free'); }
}, 
{	key:'free',
	enter:function(prev,fsm,man) {
		man.requestFree();
		man.getViewAt = (w,h) => [mouseX, mouseY];
	},
	pulse:function(fsm,man) {
		const view = man.view;
		const dt = deltaTime/1000;

		const wish = man.getWishDir();		
		view.move(8*dt, ...wish);
	}
},
{	key:'pan',
	pulse:function(fsm,man) {
		const view = man.view;
		let dt = deltaTime/1000;
		
		if(!man.useParallelProjection) {
			dt *= (man.orthographicScale / 4);
		}

		view.pan(dt, -movedX, -movedY);
	}
},
{	key:'orbit',
	pulse:function(fsm,man) {
		const view 	= man.view;
		const aim 	= man.getAimDir();
		const dt 	= deltaTime/1000;

		view.orbit(12*dt, ...aim, 6);
	}
},
{	key:'fps',
	enter:function(prev,fsm,man) {
		man.getViewAt = (w,h) => [w/2,h/2];
		man.requestLock();
	},
	pulse:function(fsm,man) {
		const view = man.view;
		const wish = man.getWishDir();
		const aim  = man.getAimDir();
		const dt   = deltaTime/1000;

		view.move(8*dt, ...wish);
		view.look(12*dt, ...aim);
	}
},
{
	key:'zoom',
	setup:function(fsm,man) { 
		this.setDeltaScroll = (dx) => { this.delta = dx; }
	},
	enter:function(prev,fsm,man) {
		if(prev != this.key) this.prev = prev;
	},
	pulse:function(fsm,man) {
		const view = man.view;
		const dx = this.delta;
		const dt = deltaTime/1000;

		if(man.useParallelProjection) {
			view.move(dx*dt,0,0,-1);
		}else {
			man.setOrthographicScale(man.orthographicScale*(1 + dx*dt*2e-1));
		}

		fsm.cswitch(man, this.prev);
	}
}]);
