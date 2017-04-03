#version 330 core
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;

in vec3 FragPos;
in vec3 Normal;


void main(){

	gPosition = FragPos;
	gNormal = normalize(Normal);
	gl_FragDepth = gl_FragCoord.z;
}