#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform vec2 screenSpaceLightPos;
uniform sampler2D screenTexture;

void main()
{ 
	
	float density = 1.0;
	float weight = 0.01;
	float decay = 1.0;
	float exposure = 1.0;
	int numSamples = 100;
	float illuminationDecay = 1.0;

	vec3 fragColor = vec3(0.0,0.0,0.0);
	vec2 deltaTextCoord = vec2( TexCoords - screenSpaceLightPos.xy );
	vec2 textCoo = TexCoords.xy ;
	deltaTextCoord *= (1.0 /  float(numSamples)) * density;

	for(int i=0; i < 100 ; i++){

		textCoo -= deltaTextCoord;
		vec3 samp = texture(screenTexture, textCoo).xyz;
		samp *= illuminationDecay * weight;
		fragColor += samp;
		illuminationDecay *= decay;

	}
	fragColor *= exposure;
	color = vec4(fragColor,1.0);
    //vec4 colora = texture(screenTexture, TexCoords);
	//color = colora;
}