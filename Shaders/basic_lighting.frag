#version 330 core
out vec4 FragColor;
in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gDepth;
uniform sampler2D depthMap;

uniform vec3 lightPos; 
uniform vec3 viewPos;
uniform vec3 lightColor;
uniform vec3 objectColor;
uniform mat4 lightSpaceMatrix;
uniform mat4 invView;
uniform mat4 invProjection;

#define STEPLEN  0.1
#define G_SCATTERING 0.3
#define PI 3.14159265358979
#define NUM_SAMPLES 512
#define NUM_SAMPLES_RCP 0.001953125
#define PI_RCP 0.31830988618379067
vec3 coneDirection = normalize( vec3(-2.2f, -2.0f, -2.0f) );
float coneAngle = 25.0f;


float ShadowCalculation(vec4 fragPosLightSpace, vec3 FragPos)
{
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    float closestDepth = texture(depthMap, projCoords.xy).r; 
    float currentDepth = projCoords.z;
    float shadow = 1.0;
    if(projCoords.z > closestDepth)
        shadow = 0.0;
        
    return shadow;
}

float ComputeScattering(float lightDotView)
{
	float result = 3*(1.0f - G_SCATTERING*G_SCATTERING);
	result /= (4.0f * PI * pow(1.0f + G_SCATTERING * G_SCATTERING - (2.0f * G_SCATTERING) *  ((lightDotView)), 1.5f));
	return result;
}

void iSphere(in vec3 ro, in vec3 rd, in vec3 sph, in float rad, out vec3 iP0, out vec3 iP1, out float iD0, out float iD1) {
	iP0 = vec3(0.0, 0.0, 0.0);
	iP1 = vec3(0.0, 0.0, 0.0);
 	vec3 oc = ro - sph;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - rad*rad;
    float t = sqrt(b*b - c);
    if( t > 0.0){ 
		iD0 = -b - t;
		iD1 = -b + t;
        iP0 = ro + iD0*rd;
		iP1 = ro + iD1*rd;
    }

}

vec3 evaluateLight(in vec3 pos)
{
    vec3 L = lightPos-pos;
    float distanceToL = length(L);
    return lightColor * 1.0/(distanceToL*distanceToL);
}
vec3 evaluateLight(in vec3 pos, in vec3 normal)
{
   // vec3 lightPos = LPOS;
    vec3 L = lightPos-pos;
    float distanceToL = length(L);
    vec3 Lnorm = L/distanceToL;
    return max(0.0,dot(normal,Lnorm)) * evaluateLight(pos);
}


vec3 evaluateSpotLight(in vec3 pos, in vec3 normal)
{
   // vec3 lightPos = LPOS;
    vec3 L = lightPos-pos;
	float distanceToL = length(L);
    vec3 Lnorm = L/distanceToL;
	vec3 rayDirection = -Lnorm;
	float lightToSurfaceAngle = degrees(acos(dot(rayDirection, coneDirection)));
	if(lightToSurfaceAngle < coneAngle)
		return max(0.0,dot(normal,Lnorm)) * evaluateLight(pos);
	return vec3(0,0,0);
}



float phaseFunction()
{
    return 1.0/(4.0*3.14);
}



void main()
{

	float Depth = texture(gDepth, TexCoords).r;
	vec4 clipSpacePosition = vec4(TexCoords* 2.0 - 1.0, Depth * 2.0 - 1.0, 1.0  );
	vec4 viewSpacePosition = invProjection * clipSpacePosition;
	viewSpacePosition /= viewSpacePosition.w;
	vec3 FragPos = (invView * viewSpacePosition).xyz;
    vec3 Normal = texture(gNormal, TexCoords).rgb;

	vec3 marchingRay = viewPos - FragPos ;
	float marchingRayLength = trunc( length(marchingRay) );
	float stepSize = marchingRayLength * NUM_SAMPLES_RCP;
	vec3 marchingRayDir = normalize(marchingRay);
	float VLI = 0.0;
	float transmittance = 1.0;
	vec3 curPos = FragPos;
	float muS = 0.01;
	for(float l = marchingRayLength; l > stepSize; l -= stepSize){
		curPos += stepSize * marchingRayDir;
		vec4 curPosLightSpace = lightSpaceMatrix * vec4(curPos, 1.0);
		float shadowTerm =  ShadowCalculation(curPosLightSpace, curPos) ;
		float d = length(curPos- lightPos);
		float dRcp = 1.0/d;
		vec3 rayDirection = (curPos-lightPos)*dRcp;
		float lightToSurfaceAngle = degrees(acos(dot(rayDirection, coneDirection)));
		if(lightToSurfaceAngle > coneAngle)
			shadowTerm = 0.0;
		float intens = 10000.0*muS*(shadowTerm* ( 0.25 * PI_RCP) * dRcp * dRcp ) * transmittance *stepSize;
		transmittance *= exp(-muS * stepSize);
		VLI += intens;
	}

	//if(intSphere0 != intSphere1)
		//FragColor = vec4(color + vec3(0.1,0.0,0.0),1.0);
	//else
	//vec3 SurfaceColor = evaluateLight(FragPos, Normal);
	vec3 SurfaceColor = evaluateSpotLight(FragPos, Normal);
	vec3 gammacolor =vec3(VLI,0,0) + SurfaceColor;
	FragColor = vec4(pow(gammacolor, vec3(1.0/2.2)) ,1.0); 


	//FragColor = vec4(Normalee.r,Normalee.r,Normalee.r,1.0);
	//FragColor = vec4(-dot(marchingRayDir, lightDir),-dot(marchingRayDir, lightDir),-dot(marchingRayDir, lightDir), 1.0);
} 
