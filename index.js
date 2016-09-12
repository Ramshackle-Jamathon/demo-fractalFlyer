var glslify = require("glslify");
var createShader = require("gl-shader");
var createBuffer = require("gl-buffer");
var flyCamera = require("gl-flyCamera");
var glMatrix = require("gl-matrix");


var Stats = require("stats.js");
var stats = new Stats();
document.body.appendChild( stats.dom );

controls = new flyCamera({
	movementSpeed: 0.7,
	rollSpeed: Math.PI / 3
});
controls.start();

var canvas = document.body.appendChild(document.createElement("canvas"));
canvas.width  = window.innerWidth * quality;
canvas.height = window.innerHeight * quality;
canvas.style.width  = "100%";
canvas.style.height = "100%";


var gl = createContext(canvas, render);
var renderOpts = init(gl);

var defaultQuality = 1;
var quality = defaultQuality;
var lastTimeStamp = 0;
var startTime;
var ellapsedTime;
function renderLoop(timeStamp){
	if(!startTime){
		startTime = timeStamp;
	}
	ellapsedTime = timeStamp - startTime;
	var dt = timeStamp - lastTimeStamp;
	lastTimeStamp = timeStamp;

	if (ellapsedTime < 5000 && dt > 45.0){
		quality = quality - 0.01;
		resizeCanvas(quality);
	}

	renderOpts.dt = dt;
	gl.render(renderOpts);
	window.requestAnimationFrame(renderLoop);
}
window.requestAnimationFrame(renderLoop);

window.addEventListener( "resize", function(){
	var canvas = gl.canvas;
	quality = defaultQuality;

	var displayWidth  = window.innerWidth * quality;
	var displayHeight = window.innerHeight * quality;

	if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
		startTime = 0;
		resizeCanvas(quality);
	}
}); 



var shader, buffer, controls;
function init(gl){



	//Create full screen vertex buffer
	buffer = createBuffer(gl, [
		// First triangle:
		 1.0,  1.0,
		-1.0,  1.0,
		-1.0, -1.0,
		// Second triangle:
		-1.0, -1.0,
		 1.0, -1.0,
		 1.0,  1.0
	]);


	//Create shader
	shader = createShader(
		gl,
		glslify("./shaders/scene.vert", {
			transform: ["glslify-hex"]
		}),
		glslify("./shaders/scene.frag", {
			transform: ["glslify-hex"]
		})
	);
	shader.attributes.position.location = 0

	return {
		buffer: buffer,
		shader: shader
	};

}

function render(gl, opts){

	var shader = opts.shader;
	var buffer = opts.buffer;

	stats.begin();

	//Bind shader
	shader.bind();

	//Bind buffer
	buffer.bind();

	//Set attributes
	shader.attributes.position.pointer();

	//Set uniforms
	shader.uniforms.uResolution = [canvas.width, canvas.height];

	var vectorDir = glMatrix.vec3.fromValues( 0, 0, -1 );
	glMatrix.vec3.transformQuat( vectorDir, vectorDir, controls.quaternion );
	glMatrix.vec3.normalize( vectorDir, vectorDir );
	var vectorUp = glMatrix.vec3.fromValues( 0, 1, 0 );
	glMatrix.vec3.transformQuat( vectorUp, vectorUp, controls.quaternion );
	glMatrix.vec3.normalize( vectorUp, vectorUp );

	shader.uniforms.uCamPosition = controls.position;
	shader.uniforms.uCamUp = vectorUp;
	shader.uniforms.uCamDir = vectorDir;

	shader.uniforms.uGlobalTime += opts.dt / 3000;
	shader.uniforms.uMinimumDistance = 0.005;
	shader.uniforms.uNormalDistance = 1.3;
	shader.uniforms.uAnaglyph = 0;
	shader.uniforms.uForms = 3;
	shader.uniforms.uSpaceFolding = 1;

	//Draw
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	controls.update(opts.dt);
	stats.end();
}


function resizeCanvas(quality) {
	canvas.width  = window.innerWidth * quality;
	canvas.height = window.innerHeight * quality;
	gl.viewport(0, 0, canvas.width, canvas.height);
}

function createContext(canvas, render) {
	var gl = (
		canvas.getContext("webgl") ||
		canvas.getContext("webgl-experimental") ||
		canvas.getContext("experimental-webgl")
	);

	if (!gl) {
		throw new Error("Unable to initialize gl");
	}

	if (render){
		gl.render = function what(renderOpts) {
			render(gl, renderOpts);
		}
	}

	return gl;
}


window.addEventListener( "keydown", function (event) {
	if ( event.altKey ) {
			return;
	}
	event.preventDefault();
	if( event.shiftKey ){
		switch ( event.keyCode ) {
			case 187: /* + */ quality += 0.05; resizeCanvas(quality); break;
			case 189: /* - */ quality -= 0.05; resizeCanvas(quality); break;
		}
	}
});
