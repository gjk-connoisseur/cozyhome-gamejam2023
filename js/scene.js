// this is where all interactivity will occur. Invoked by main.js.
const SCENE_FSM= new FSM([{
	key:'init',
	pulse:function(fsm,man) { fsm.cswitch(man, 'idle'); }
},
{
	key:'idle',
	enter:function(prev,fsm,man) {
		const p5gl = man.p5gl; // p5gl object
		const glb = p5gl.glb;  // webgl buffer
		const ctx = p5gl.ctx;  // webgl context
// initializing scene objects
		man.poly = CONSTRUCT_POLYGON(8,8);

		let pts = man.poly.pts;
		let root = man.poly.root;
		let edge = root;

		const append_pt=(pt)=> {
			pts.push(new WingedVertex(pt));
			return pts.length-1;
		}
	
		const connect_vert=(a,b)=> {
			const new_edge = new WingedEdge();
			new_edge.vert = a;
			const new_twin = new WingedEdge();
			new_twin.vert = b;	
		
			pts[a].push_edge(new_twin);
			pts[b].push_edge(new_edge);

			new_edge.twin = new_twin;
			new_twin.twin = new_edge;
		}
	
		const c = append_pt(new vec3(0,0,16));
		ITERATE_WVERTICES(man.poly, (vid, vertex)=> {
			if(vid == c) return;
			connect_vert(c, vid);
		});

		man.gl_poly = new GL_Wireframe(ctx, man.poly);

		man.obb = new OBB(0,1,0,1,0,1);
		man.gl_obb = new GL_BBox(ctx, man.obb.obb_box(), [1,0,0]);
		man.gl_triad = new GL_Triad(ctx);
		man.gl_board = new GL_Board(ctx, new vec2(16,16), [0.5,0.5,0.5]);
		man.gl_board_m = mMultiply4x4(
			mTranslate4x4(-8,0,-8),
			mMultiply4x4(mScale4x4(16,-16,16), mRotx4x4(Math.PI/2))
		);

		man.cam = CAMERA_CTOR(new vec3(0.5,0.5,-20), new vec3(0,0,0), {
// give access to mouse cursor events
			genPerspectiveMatrix:()=>GL_PERSPECTIVE(glb.width, glb.height),
			genOrthographicMatrix:(scale=1)=>GL_ORTHOGRAPHIC(scale, glb.width, glb.height),
			useParallelProjection: true,
			requestLock: man.requestLock,
			requestFree: man.requestFree,
			onPerspectiveChanged:(type, mat)=> {
				if(type == 'orthographic') {
					SET_POINT_SIZES(ctx, man.p5gl.shaders, 48);
				}else {
					SET_POINT_SIZES(ctx, man.p5gl.shaders, 384);
				}
			},
			onClick: 	  	 (mb, mv) => {},
			onClickReleased: (mb, mv) => {},
			onKeyPressed:  	 (kc) => {},
			onKeyReleased: 	 (kc) => {},
			onScrollWheel: 	 (e) => {}
		});
// initializing callback functions
		man.onClick=(mb,mv)			=> { man.cam.man.onClick(mb,mv); }
		man.onClickReleased=(mb,mv)	=> { man.cam.man.onClickReleased(mb,mv); }
		man.onKeyPressed=(kc) 		=> { man.cam.man.onKeyPressed(kc); }
		man.onKeyReleased=(kc) 		=> { man.cam.man.onKeyReleased(kc); }
		man.onScrollWheel=(e)		=> { man.cam.man.onScrollWheel(e); }
	},
	pulse:function(fsm,man) {
		const p5gl = man.p5gl; // p5gl object
		const glb = p5gl.glb;
		const p5b = p5gl.p5b;  // P2D buffer
		const ctx = p5gl.ctx;  // webgl context

		p5b.clear();
		p5b.noFill();
		p5b.strokeWeight(1);
		p5b.stroke(255);

		const lines_s = p5gl.shaders["lines"].program;
		const point_s = p5gl.shaders["points"].program;

		const cam_e = man.cam;
		const cam_m = cam_e.man;

		cam_e.fsm.pulse(man.cam.man);

		const pm  = cam_m.getProjectionMatrix(); 	// perspective matrix
		const vm  = cam_m.getViewMatrix(); 			// view matrix
		const ivm = mInverse4x4(vm);				// inverse view matrix

		const vpos = cam_m.getViewPos();

		let pts = man.poly.pts;
		let root = man.poly.root;
		let edge = root;

		p5b.noStroke();
		p5b.fill(0,255,0);
		p5b.textSize(16);
		p5b.text(`FPS: ${(0^frameRate()*10)/10}`, 48, 32);
		ITERATE_WVERTICES(man.poly, (vid, vertex)=> {
			let zero_pos = WORLD_TO_P5SCREEN(pts[vid].pos.f3d(), ivm, pm, p5b);
				p5b.textAlign(CENTER);
				if(zero_pos[2] > 0) {
					if(cam_m.getProjectionType() == 'orthographic') {
						p5b.textSize(16);
					}else {
						p5b.textSize(256 / zero_pos[2]);
					}
					p5b.text(`${vid}`, zero_pos[0], zero_pos[1]);
				}
		});

// get mouse position
		let mv = cam_m.getViewAt(p5b.width, p5b.height);
		let wd = P5SCREEN_TO_VIEW_DIR(mv.slice(), p5b, vm);
		let wd_v3 = new vec3(...wd);

	// test both against AABB and OBB
		let hit_axial = line_intersect_axial(vpos, wd_v3, man.obb.aabb_box());
		let hit_orien = line_intersect_oriented(vpos, wd_v3, mInverse4x4(man.obb.l2w()), man.obb.obb_box());

		DRAW_GL_WIREFRAME(ctx, lines_s, point_s, man.gl_poly, mIdentity4x4(), ivm, pm);

		DRAW_GL_BOARD(ctx, lines_s, point_s, man.gl_board, man.gl_board_m, ivm, pm);
		DRAW_GL_OBB(ctx, lines_s, point_s, man.obb, man.gl_obb, ivm, pm, false, hit_orien.toi < Number.POSITIVE_INFINITY ? [1,0,0] : [1,1,1]);
		DRAW_GL_TRIAD(ctx, lines_s, man.gl_triad, mMultiply4x4(mScale4x4(128,128,128),man.obb.l2w()), ivm, pm);
		DRAW_GL_TRIAD(ctx, lines_s, man.gl_triad, mMultiply4x4(mScale4x4(-128,-128,-128),man.obb.l2w()), ivm, pm);
	},
}]);
