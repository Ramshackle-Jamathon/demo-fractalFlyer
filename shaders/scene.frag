precision mediump float;

uniform float uGlobalTime;
uniform float uMinimumDistance;
uniform float uNormalDistance;
uniform int uAnaglyph;
uniform int uForms;
uniform int uSpaceFolding;
uniform vec2 uResolution;
uniform samplerCube uSamplerCube;

uniform vec3 uCamPosition;
uniform vec3 uCamDir;
uniform vec3 uCamUp;

varying vec2 uv;

// Kaleidoscopic Journey
//
// Mikael Hvidtfeldt Christensen
// @SyntopiaDK
//
// Edited: Joseph Van Drunen
//
// License:
// Creative Commons Attribution
// http://creativecommons.org/licenses/by/3.0/

// Decrease this for better performance
#define Iterations 7
#define MaxSteps 70
#define ColorInterpolateStep 0.4
#define PI 3.141592
#define Scale 2.0
#define FieldOfView 1.0
#define Jitter 0.0
#define FudgeFactor 1.0

#define Ambient 0.28452
#define Diffuse 0.57378
#define Specular 0.07272
#define LightDir vec3(1.0,1.0,-0.65048)
#define LightColor vec3(1.0,0.666667,0.0)
#define LightDir2 vec3(1.0,-0.62886,1.0)
#define LightColor2 vec3(0.596078,0.635294,1.0)

vec2 rotate(vec2 v, float a) {
	return vec2(cos(a)*v.x + sin(a)*v.y, -sin(a)*v.x + cos(a)*v.y);
}

// Two light source + env light
vec3 getLight(in vec3 color, in vec3 normal, in vec3 dir) {
	vec3 lightDir = normalize(LightDir);
	float specular = pow(max(0.0,dot(lightDir,-reflect(lightDir, normal))),20.0); // Phong
	float diffuse = max(0.0,dot(-normal, lightDir)); // Lambertian
	vec3 lightDir2 = normalize(LightDir2);
	float specular2 = pow(max(0.0,dot(lightDir2,-reflect(lightDir2, normal))),20.0); // Phong
	float diffuse2 = max(0.0,dot(-normal, lightDir2)); // Lambertian
	
	return
		 textureCube(uSamplerCube, reflect(dir, normal)).xyz*Specular+
		(Specular*specular)*LightColor+(diffuse*Diffuse)*(LightColor*color) +
		(Specular*specular2)*LightColor2+(diffuse2*Diffuse)*(LightColor2*color);
}

// Geometric orbit trap. Creates the fractal forms look.
float trap(vec3 p){
	if (uForms == 1) return  length(p.x-0.5-0.5*sin(uGlobalTime/10.0)); // <- cube forms 
	if (uForms == 2) return  length(p.x-1.0); // <-plane forms
	if (uForms == 3) return length(p.xz-vec2(1.0,1.0))-0.05; // <- tube forms
	return length(p); // <- no trap
}

vec3 offset = vec3(1.0+0.2*(cos(uGlobalTime/5.7)),0.3+0.1*(cos(uGlobalTime/1.7)),1.).xzy;

// DE: Infinitely tiled Kaleidoscopic IFS. 
//
// For more info on KIFS, see: 
// http://www.fractalforums.com/3d-fractal-generation/kaleidoscopic-%28escape-uGlobalTime-ifs%29/
float DE(in vec3 z)
{   
	// Folding 'tiling' of 3D or 2D space;
	if (uSpaceFolding == 0)z.xy = abs(1.0-mod(z.xy,2.0))+0.2;
	if (uSpaceFolding == 1) z  = abs(1.0-mod(z,2.0))+0.2;
	
	float d = 1000.0;
	float r;
	for (int n = 0; n < Iterations; n++) {
		z.xz = rotate(z.xz, uGlobalTime/18.0);
		
		// This is octahedral symmetry,
		// with some 'abs' functions thrown in for good measure.
		if (z.x+z.y<0.0) z.xy = -z.yx;
		z = abs(z);
		if (z.x+z.z<0.0) z.xz = -z.zx;
		z = abs(z);
		if (z.x-z.y<0.0) z.xy = z.yx;
		z = abs(z);
		if (z.x-z.z<0.0) z.xz = z.zx;
		z = z*Scale - offset*(Scale-1.0);
		z.yz = rotate(z.yz, -uGlobalTime/18.0);
		
		d = min(d, trap(z) * pow(Scale, -float(n+1)));
	}
	return d;
}

// Finite difference normal
vec3 getNormal(in vec3 pos) {
	vec3 e = vec3(0.0,uNormalDistance,0.0);
	
	return normalize(vec3(
			DE(pos+e.yxx)-DE(pos-e.yxx),
			DE(pos+e.xyx)-DE(pos-e.xyx),
			DE(pos+e.xxy)-DE(pos-e.xxy)));
}

// Solid color with a little bit of normal :-)
vec3 getColor(vec3 normal) {
	return mix(vec3(1.0),abs(normal),ColorInterpolateStep); 
}

// Filmic tone mapping:
// http://filmicgames.com/archives/75
vec3 toneMap(in vec3 c) {
	c = pow(c,vec3(2.0));
	vec3 x = max(vec3(0.0),c-vec3(0.004));
	c = (x*(6.2*x+.5))/(x*(6.2*x+1.7)+0.06);
	return c;
}


// Pseudo-random number
// From: lumina.sourceforge.net/Tutorials/Noise.html
float rand(vec2 co){
	return fract(cos(dot(co,vec2(4.898,7.23))) * 23421.631);
}

vec4 rayMarch(in vec3 from, in vec3 dir, in vec2 pix) {
	// Add some noise to prevent banding
	float totalDistance = Jitter*rand(pix+vec2(uGlobalTime));
	
	float distance = 0.0;
	int steps = 0;
	vec3 pos;
	for (int i=0; i < MaxSteps; i++) {
		pos = from + totalDistance * dir;
		distance = DE(pos)*FudgeFactor;
		totalDistance += distance;
		if (distance < uMinimumDistance){ break; }
		steps = i;
	}
	
	// 'AO' is based on number of steps.
	// Try to smooth the count, to combat banding.
	float smoothStep = float(steps) + float(distance/uMinimumDistance);
	float temp = (smoothStep/float(MaxSteps));
	//float ao = 1.0 - abs(temp);
	float ao = 1.0 - clamp(temp, 0.0, 1.0);
	

	// Since our distance field is not signed,
	// backstep when calc'ing normal
	vec3 normal = getNormal(pos-dir*uNormalDistance*3.0);
	vec3 color = getColor(normal);
	vec3 light = getLight(color, normal, dir);
	
	
	
	
	return vec4(toneMap((color*Ambient+light)*ao),1.0);
}







void main(void)
{
	
	// first texture row is frequency data
	//float fft  = texture2D( iChannel1, vec2(vPos.x,0.25) ).x; 
	
	// second texture row is the sound wave
	//float wave = texture2D( iChannel1, vec2(vPos.x,0.75) ).x;

	vec2 coord = uv;
	coord.x *= uResolution.x / uResolution.y;
	
	bool isCyan;
	if(uAnaglyph == 1){
		isCyan = 0.5<mod(gl_FragCoord.xy.x,2.0);
		if(.5<mod(gl_FragCoord.xy.y,2.0)){ isCyan = !isCyan; }
	}
	
	
	// Camera position (eye), and camera target
	vec3 camPos = vec3(uCamPosition.x,uCamPosition.y,uCamPosition.z);
	if(uAnaglyph == 1){
		if(isCyan)camPos = vec3(uCamPosition.x + 0.05,uCamPosition.y,uCamPosition.z);
	}
	vec3 target = camPos+vec3(uCamDir.x,uCamDir.y,uCamDir.z);
	vec3 camUp  = vec3(uCamUp.x,uCamUp.y,uCamUp.z);
	
	// Calculate orthonormal camera reference system
	vec3 camDir   = normalize(target-camPos); // direction for center ray
	camUp = normalize(camUp-dot(camDir,camUp)*camDir); // orthogonalize
	vec3 camRight = normalize(cross(camDir,camUp));
	
	
	// Get direction for this pixel
	vec3 rayDir = normalize(camDir + (coord.x*camRight + coord.y*camUp)*FieldOfView);
	
	vec4 col = rayMarch(camPos, rayDir, gl_FragCoord.xy );
	
	gl_FragColor = col;
	if(uAnaglyph == 1){
		if(isCyan)
			gl_FragColor=vec4(0.0,col.gb,1.0);
		else
			gl_FragColor=vec4(sqrt(col.r),0.0,0.0,1.0);
	}
	
}