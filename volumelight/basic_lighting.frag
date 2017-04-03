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

float ShadowCalculation(vec4 fragPosLightSpace, vec3 Normal, vec3 FragPos)
{
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // Transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;
    // Get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(depthMap, projCoords.xy).r; 
    // Get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // Calculate bias (based on depth map resolution and slope)

    float shadow = 0.0;
    
    // Keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if(projCoords.z > closestDepth)
        shadow = 1.0;
        
    return shadow;
}

float ComputeScattering(float lightDotView)
{
	float result = 3*(1.0f - G_SCATTERING*G_SCATTERING);
	result /= (4.0f * PI * pow(1.0f + G_SCATTERING * G_SCATTERING - (2.0f * G_SCATTERING) *  ((lightDotView)), 1.5f));
	return result;
}





void iSphere(in vec3 ro, in vec3 rd, in vec3 sph, in float rad, out vec3 iP0, out vec3 iP1, out float iD0, out float iD1) {
	// This is relating directly to parametric equation
    // where we define a function xyz = ro + t*rd
    // solving the quadradic equation below
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


float phaseFunction()
{
    return 1.0/(4.0*3.14);
}

 void traceScene(in vec3 rO, in vec3 rD, in float startDepth, in float endDepth,  inout vec4 scatTrans)
{
	
	
    float muS = 0.7;
    float muE = 0.07;
    
    
    // Initialise volumetric scattering integration (to view)
    float transmittance = 1.0;
    vec3 scatteredLight = vec3(0.0, 0.0, 0.0);
    
	float d = 1.0; // hack: always have a first step of 1 unit to go further
	vec3 p = vec3(0.0, 0.0, 0.0);
    float dd = 0.05;
	int numIter = int((endDepth - startDepth)/dd);

	for(int i=0; i<numIter; ++i)
	{
		vec3 p = rO + (startDepth + i*dd)*rD;


		vec4 curPosLightSpace = lightSpaceMatrix * vec4(p, 1.0);
		float curshadow =  ShadowCalculation(curPosLightSpace, vec3(0.0,0.0,0.0), p) ;
		 if(curshadow < 1.0){
 //       vec3 S = evaluateLight(p) * muS * phaseFunction();// incoming light
 //       vec3 Sint = (S - S * exp(-muE * dd)) / muE; // integrate along the current step segment
//        scatteredLight += transmittance * Sint; // accumulate and also take into account the transmittance from previous steps
        scatteredLight += muS * evaluateLight(p) * phaseFunction()  * transmittance * dd;
        
        // Evaluate transmittance to view independentely
        transmittance *= exp(-muE * dd);}
		else{
			scatteredLight = vec3(0.0,0.0,0.0);
			transmittance = 1.0;
			//break;
		}
		//if(length())
		//d += dd;
	}
    
    scatTrans = vec4(scatteredLight, transmittance);
}



void main()
{
	//vec3 FragPos = texture(gPosition, TexCoords).rgb;
	float Depth = texture(gDepth, TexCoords).r;
	vec4 clipSpacePosition = vec4(TexCoords* 2.0 - 1.0, Depth * 2.0 - 1.0, 1.0  );
	vec4 viewSpacePosition = invProjection * clipSpacePosition;
	viewSpacePosition /= viewSpacePosition.w;
	vec3 FragPos = (invView * viewSpacePosition).xyz;

    vec3 Normal = texture(gNormal, TexCoords).rgb;
	//vec3 Normale = texture(depthMap, TexCoords).rgb;
	//vec3 Normalee = texture(gDepth, TexCoords).rgb;
    
    //float shadow =  ShadowCalculation(FragPosLightSpace, Normal, FragPos) ;    
    //vec3 SurfaceColor = (1.0 - shadow) * ( diffuse + specular) * objectColor;
	vec3 marchingRay = FragPos - viewPos;
	float marchingRayLength = length(marchingRay);
	vec3 marchingRayDir = marchingRay / marchingRayLength;

	vec3 curPos;
	vec3 accumFog = vec3(0.0f, 0.0f, 0.0f);
	float sayi = 0;
	vec4 scatTrans = vec4( 0.0, 0.0, 0.0, 0.0 );

	
	
	vec3 intSphere0, intSphere1;
	float intDepth0, intDepth1;
	iSphere(viewPos, marchingRayDir, lightPos, 5.5, intSphere0, intSphere1, intDepth0, intDepth1);
	float startDepth = max(0.0, intDepth0);
	startDepth = min(marchingRayLength, startDepth);
	float endDepth = max(0.0, intDepth1);
	endDepth = min(marchingRayLength, endDepth);
	
	traceScene(viewPos, marchingRayDir, startDepth, endDepth, scatTrans);
	vec3 SurfaceColor = evaluateLight(FragPos, Normal);
	vec3 color = SurfaceColor*scatTrans.w+ scatTrans.xyz;
	color = pow(color, vec3(1.0/2.2));
	float bug = (endDepth - startDepth)/7.0;
	//if(intSphere0 != intSphere1)
		//FragColor = vec4(color + vec3(0.1,0.0,0.0),1.0);
	//else
	FragColor = vec4(color ,1.0); 


	//FragColor = vec4(Normalee.r,Normalee.r,Normalee.r,1.0);
	//FragColor = vec4(-dot(marchingRayDir, lightDir),-dot(marchingRayDir, lightDir),-dot(marchingRayDir, lightDir), 1.0);
} 




















//varying float2 uv;
//varying float3 viewRay;

//uniform mat4 invVP;
//uniform float3 viewPos;
//uniform float2 linearDepthParam;
//uniform float4 lightPosRad;
//uniform float4 lightColor;
//uniform float2 cubeShadowProjParam;

//uniform sampler2D viewDepthTex;
//uniform sampler2D halfDepthTex;

//uniform samplerCube shadowCubeMapIndirectionTex;
//uniform sampler2D virtualShadowCubeMapTex;

//uniform sampler3D noise3dTex;
//uniform sampler2D noise2dTex;
//uniform float4 noiseTexturesSize;
//uniform float2 noiseOffset;

//uniform float4 rtResolutionAndInv;


//// ad-hoc Attenuation
//float lighting(float4 sphereLight, float3 p)
//{
//    float3 L        = sphereLight.xyz - p.xyz;
//    float  Ldist    = length(sphereLight.xyz - p.xyz);
//    float3 Lnorm    = L / Ldist;

//    float linearAtenuation = min( 1.0, max(0.0, (sphereLight.w-Ldist)/sphereLight.w));
//    float attenuation = linearAtenuation ;//* min( 1.0, 1.0 / (Ldist*Ldist));
    
//    return attenuation;
//}

//// Simple sphere intersection
//void intersectSphere(float3 dO, float3 dV, out float3 i0, out float3 i1, out float iDepth0, out float iDepth1)
//{
//    float3 center = float3(0.0,0.0,0.0);
//    float r = 4.75;

//    float3 Q = lightPosRad.xyz - dO;
//    float c = length(Q);
//    float v = dot(Q,dV);
//    float d = (lightPosRad.w*lightPosRad.w) - ( c*c - v*v );

//    if(d<0.0f)
//    {
//        iDepth0 = iDepth1 = 0.0;
//    }
//    else
//    {
//        d = sqrt(d);
//        iDepth0 = v-d;
//        iDepth1 = v+d;
//        i0 = dO + dV*iDepth0;
//        i1 = dO + dV*iDepth1;
//    }
//}




//void main()
//{
//    float2 uv2 = (uv*rtResolutionAndInv.xy + noiseOffset) / noiseTexturesSize.xx;
//    float pixelRayMarchNoise = texture2D(noise2dTex,uv2).r;

//    // Sample the half res min depth
//    float depth = DecodeFloatRGBA(texture2D(halfDepthTex,uv).rgba);

//    // Reconstruct linear distance (0..1 mapping to 0..far)
//    float linearDepth01 = linearDepthParam.y / (depth - linearDepthParam.x);
    
//    // Reconstruct world space position
//    float3 worldPos = viewPos + viewRay*linearDepth01;
    
//    // Parameters
//    float3 viewVec = worldPos.xyz-viewPos;
//    float worldPosDist = length(viewVec);
//    float3 viewVecNorm = viewVec/worldPosDist;


//    // Compute start and end of sphere light
//    float3 dO = viewPos;
//    float3 dV = viewVecNorm;
//    float3 i0;
//    float3 i1;
//    float  iDepth0;
//    float  iDepth1;
//    intersectSphere(dO, dV, i0, i1, iDepth0, iDepth1);
//    //
//    float startDepth = max(0.0, iDepth0);
//    startDepth = min(worldPosDist, startDepth);
//    float endDepth = max(0.0, iDepth1);
//    endDepth = min(worldPosDist, endDepth);


//// Some options
//#define D_DEPTH_RAY_DITHER
////#define D_3D_VOLUME_NOISE
////#define D_TRAPEZIUM_INTEGRAL
////#define D_SIMPSON_INTEGRAL

//    // Ray march
//    const float tScat = 0.08;
//    const float tAbs = 0.0;
//    const float tExt = 0.0;//tScat + tAbs;
//    float3 curPos = viewPos + viewVecNorm*startDepth;
//#if 0
//    const float stepLen = 0.005; // 200 steps
//#else
//    #ifdef D_SIMPSON_INTEGRAL
//    // I am using Simpson second's rules as the first one was giving some artefact...
//    const float stepLen = 1.0/11.0; // 17-2 samples = 15 a multiple of 3 (required)
//    #else
//    const float stepLen = 1.0/11.0;
//    #endif
//#endif

//    float stepLenWorld = stepLen * (endDepth-startDepth);
//    float curOpticalDepth = exp(-tExt * stepLenWorld); // we have a first step into the volume as sampling at the edge is not interesting
//    float scatteredLightAmount = 0.0f;
//#ifdef D_DEPTH_RAY_DITHER
//    curPos += stepLenWorld * viewVecNorm * (2.0*pixelRayMarchNoise-1.0);
//#endif
//#if defined(D_TRAPEZIUM_INTEGRAL)
//    int numStep = int(1.0/stepLen)-2; // -2 as first and last are skiped 
//    int stepId = 0;
//#elif defined(D_SIMPSON_INTEGRAL)
//    int numStep = 17-2; // -2 as first and last are skiped
//    int stepId = 0;
//#endif

//    for(float l=stepLen; l<0.99999; l+=stepLen) // Do not do the first and last steps
//    {
//        curPos += stepLenWorld * viewVecNorm;
        
//        float density = 1.0;
//#ifdef D_3D_VOLUME_NOISE
//        density = texture3D(noise3dTex, curPos*0.08).r;
//#endif
        
//        float l1 = lighting(lightPosRad, curPos) * stepLenWorld * tScat * density;    // Scattered light at p, TODO: phase function
//        curOpticalDepth *= exp(-tExt * stepLenWorld * density);                       // Atenuate light from p to view (should be half the length at first for center of considered marched segment?)

//        // Sample the virtual depth cubemap
//        float3 lightDir = (lightPosRad.xyz - curPos);
//        float3 lightDirNorm = -normalize(lightDir); // I should not have to normalise here...
//        vec2 indirection = textureCube(shadowCubeMapIndirectionTex, lightDirNorm).ra;
//        float lightPointDepth = texture2D(virtualShadowCubeMapTex, indirection).r;
        
//        // Compute the depth map value for the current position
//        float3 lightDirAbs = abs(lightDir.xyz);
//        float lightDirDepth = max(lightDirAbs.x, max(lightDirAbs.y, lightDirAbs.z));
//        float curPosDepth = (-1.0 / lightDirDepth) * cubeShadowProjParam.x + cubeShadowProjParam.y;
//        float shadow = (lightPointDepth>curPosDepth) ? 1.0 : 0.0;

//#ifdef D_TRAPEZIUM_INTEGRAL
//        float tWeight = (stepId==0 || stepId==(numStep-1)) ? 1.0 : 2.0;
//        scatteredLightAmount += curOpticalDepth * l1 * shadow * tWeight;
//        stepId++;
//#elif defined(D_SIMPSON_INTEGRAL)
//        // Simpson's composite rule (quadratic)
//        float sWeight = (mod(stepId-1,3) == 2) ? 2 : 3;
//        sWeight = (stepId==0 || stepId==(numStep-1)) ? 1.0 : sWeight;
//        scatteredLightAmount += curOpticalDepth * l1 * shadow * sWeight;
//        stepId++;
//#else
//        scatteredLightAmount += curOpticalDepth * l1 * shadow;
//#endif
//    }
    
//#ifdef D_TRAPEZIUM_INTEGRAL
//    scatteredLightAmount *= 0.5;
//#elif defined(D_SIMPSON_INTEGRAL)
//    scatteredLightAmount *= 3.0/8.0;
//#endif

//    gl_FragColor = float4(scatteredLightAmount*lightColor.rgb , curOpticalDepth);
//}






