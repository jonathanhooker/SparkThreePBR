const Reactive = require('Reactive');
const Shaders = require('Shaders');

// quicker calls for vertex attribues and transforms
// also stores previous lookups for reuse (not sure if that boosts performance)
const attributes = {};
function attribute(id){
    if(!attributes[id]) attributes[id] = Shaders.vertexAttribute({'variableName': Shaders.VertexAttribute[id]}); 
    return attributes[id];
}

const transforms = {};
function transform(id){
    if(!transforms[id])transforms[id] = Shaders.vertexTransform({'variableName': Shaders.BuiltinUniform[id] });
    return transforms[id];
}

function dFdx(val){
    return Shaders.derivative( val, {'derivativeType': Shaders.DerivativeType.DFDX} )
}

function dFdy(val){
    return Shaders.derivative( val, {'derivativeType': Shaders.DerivativeType.DFDY} )
}

function saturate(val){
    return Reactive.clamp(val, 0, 1);
}

function log2(val){
    return Reactive.log(val).div(Reactive.log(2));
}

function exp2(val){
    return Reactive.pow(2, val);
}

function fakeMat3(vA, vB, vC) {
    this.el = [
        vA.x, vA.y, vA.z,
        vB.x, vB.y, vB.z,
        vC.x, vC.y, vC.z
    ];

    this.mulV3 = function(v3){
        return Reactive.pack3(
            v3.x.mul(this.el[0]).add(v3.y.mul(this.el[3])).add(v3.z.mul(this.el[6])),
            v3.x.mul(this.el[1]).add(v3.y.mul(this.el[4])).add(v3.z.mul(this.el[7])),
            v3.x.mul(this.el[2]).add(v3.y.mul(this.el[5])).add(v3.z.mul(this.el[8]))
        );
    };
}

// why can't we have nice things?
function swizzle(obj, str){
    const getVar = function(char){
        switch(char){
            case 'r':
            case 'x':
                return obj.x;
            case 'g':
            case 'y':
                return obj.y;
            case 'b':
            case 'z':
                return obj.z;
            case 'a':
            case 'w':
                return obj.w;
            case '1':
                return 1;
            case '0':
            default:
                return 0;
        }
    }

    const vars = [];
    for(let i=0; i<str.length; i++){
        vars.push(getVar(str[i]));
    }
    if(str.length===2){
        return Reactive.pack2(getVar(str[0]), getVar(str[1]));
    } else if (str.length===3){
        return Reactive.pack3(getVar(str[0]), getVar(str[1]), getVar(str[2]));
    } else {
        return Reactive.pack4(getVar(str[0]), getVar(str[1]), getVar(str[2]), getVar(str[3]));
    }
}

const cubeUV_maxMipLevel = 8.0;
const cubeUV_minMipLevel = 4.0;
const cubeUV_maxTileSize = 256.0;
const cubeUV_minTileSize = 16.0;
const r0 = 1.0;
const v0 = 0.339;
const m0 = -2.0;
const r1 = 0.8;
const v1 = 0.276;
const m1 = -1.0;
const r4 = 0.4;
const v4 = 0.046;
const m4 = 2.0;
const r5 = 0.305;
const v5 = 0.016;
const m5 = 3.0;
const r6 = 0.21;
const v6 = 0.0038;
const m6 = 4.0;

function getFace(direction){
    const absDirection = Reactive.abs(direction);

    return Reactive.mix(
        Reactive.mix(
            Reactive.mix(4., 1., Reactive.step(direction.y, 0)), 
            Reactive.mix(5., 2., Reactive.step(direction.z, 0)), 
            Reactive.step(absDirection.z, absDirection.y)
        ),
        Reactive.mix(
            Reactive.mix(4., 1., Reactive.step(direction.y, 0.)), 
            Reactive.mix(3., 0., Reactive.step(direction.x, 0.)), 
            Reactive.step(absDirection.x, absDirection.y)
        ),
        Reactive.step(absDirection.x, absDirection.z)
    );
}
function getUV(direction, face){
    let uv = Reactive.mix(
        Reactive.pack2(direction.z.mul(-1), direction.y).div(Reactive.abs(direction.x)),
        Reactive.mix(
            Reactive.pack2(direction.x, direction.z.mul(-1)).div(Reactive.abs(direction.y)),
            Reactive.mix(
                Reactive.pack2(direction.x, direction.y).div(Reactive.abs(direction.z)),
                Reactive.mix(
                    Reactive.pack2(direction.z, direction.y).div(Reactive.abs(direction.x)),
                    Reactive.mix(
                        Reactive.pack2(direction.x, direction.z).div(Reactive.abs(direction.y)),
                        Reactive.pack2(direction.x.mul(-1), direction.y).div(Reactive.abs(direction.z)),
                        Reactive.step(face, 4.5)
                    ),
                    Reactive.step(face, 3.5)   
                ),
                Reactive.step(face, 2.5)
            ),
            Reactive.step(face, 1.5)
        ),
        Reactive.step(face, 0.5)
    )
    return uv.add(1).mul(0.5)
}
function bilinearCubeUV(envMap, direction, mipInt){
    let face = getFace(direction);
    const filterInt = Reactive.max(Reactive.sub(cubeUV_minMipLevel, mipInt), 0.0);
    const mipInt2 = Reactive.max(mipInt, cubeUV_minMipLevel);
    const faceSize = Reactive.pow(2, mipInt2);
    const texelSize = Reactive.div(1,  Reactive.mul(3.0, cubeUV_maxTileSize));

    let uv = getUV(direction, face).mul(Reactive.sub(faceSize, 1.0));
    
    const f = Reactive.pack2(Reactive.mod(uv.x, 1), Reactive.mod(uv.y, 1));
    uv = uv.add(0.5).sub(f);

    const ifCond1 =  Reactive.step(face, 2.1);
    face = Reactive.mix(face, face.sub(3), ifCond1);
    uv = Reactive.pack2(
        uv.x.add(face.mul(faceSize)),
        Reactive.mix(uv.y, uv.y.add(faceSize), ifCond1)
    );

    const ifCond2 =  Reactive.step(mipInt2, cubeUV_maxMipLevel);
    
    uv = Reactive.pack2(
        uv.x,
        Reactive.mix(uv.y.add(2*cubeUV_maxTileSize), uv.y, ifCond2)
    );
    
    uv = Reactive.pack2(
        uv.x.add(Reactive.mul(3, Reactive.max(0, Reactive.val(cubeUV_maxTileSize).sub(Reactive.mul(2, faceSize))))),
        uv.y.add(filterInt.mul(2).mul(cubeUV_minTileSize))
    ); 
        
    uv = uv.mul(texelSize);
    const tl = sRGBToLinear( Shaders.textureSampler(envMap, uv) );
    uv = Reactive.pack2(uv.x.add(texelSize), uv.y);
    const tr = sRGBToLinear( Shaders.textureSampler(envMap, uv) );
    uv = Reactive.pack2(uv.x, uv.y.add(texelSize));
    const br = sRGBToLinear( Shaders.textureSampler(envMap, uv) );
    uv = Reactive.pack2(uv.x.sub(texelSize), uv.y);
    const bl = sRGBToLinear( Shaders.textureSampler(envMap, uv) );
    const tm = Reactive.mix(tl, tr, f.x);
    const bm = Reactive.mix(bl, br, f.x);
    return swizzle(Reactive.mix(tm, bm, f.y), 'xyz');
}

function roughnessToMip(roughness) {
    return Reactive.mix(
        log2(Reactive.mul(roughness, 1.16)).mul(-2),        
        Reactive.mix(
            Reactive.sub(r5, roughness).mul(Reactive.sub(m6, m5)).div(Reactive.sub(r5, r6)).add(m5),
            Reactive.mix(
                Reactive.sub(r4, roughness).mul(Reactive.sub(m5, m4)).div(Reactive.sub(r4, r5)).add(m4),
                Reactive.mix(
                    Reactive.sub(r1, roughness).mul(Reactive.sub(m4, m1)).div(Reactive.sub(r1, r4)).add(m1),
                    Reactive.sub(r0, roughness).mul(Reactive.sub(m1, m0)).div(Reactive.sub(r0, r1)).add(m0),
                    Reactive.step(roughness, r1)
                ),
                Reactive.step(roughness, r4)
            ),
            Reactive.step(roughness, r5)
        ),
        Reactive.step(roughness, r6)
    )
}
function textureCubeUV(envMap, sampleDir, roughness) {
    const mip = Reactive.clamp(roughnessToMip(roughness), m0, cubeUV_maxMipLevel);
    const mipF = Reactive.mod(mip, 1);
    const mipInt = Reactive.floor(mip);
    const color0 = bilinearCubeUV(envMap, sampleDir, mipInt);
    const color1 = bilinearCubeUV(envMap, sampleDir, mipInt.add(1));

    return Reactive.pack2(Reactive.mix(color0, color1, mipF), 1);
    return Reactive.pack2(color0, 1);
}

function inverseTransformDirection( dir, matrix ) {
    return Reactive.normalize( swizzle( Reactive.pack2(dir, 0).mul(matrix), 'xyz') );
}

function getLightProbeIndirectIrradiance(geometry, maxMIPLevel, envMap){
    const worldNormal = inverseTransformDirection( geometry.normal, transform('V_MATRIX') );
    const queryVec = Reactive.pack3( worldNormal.x, worldNormal.y, worldNormal.z );
    const envMapColor = textureCubeUV( envMap, queryVec, 1.0 );

    return swizzle(envMapColor, 'rgb').mul(Math.PI).mul(1.3);
}

function getLightProbeIndirectRadiance(viewDir, normal, roughness, maxMIPLevel, envMap){
    let reflectVec = Reactive.reflect( swizzle(viewDir.mul(-1), 'xyz'), normal );
    reflectVec = Reactive.normalize( Reactive.mix( reflectVec, normal, roughness.mul(roughness)) );
    reflectVec = inverseTransformDirection( reflectVec, transform('V_MATRIX') );
    const queryReflectVec = Reactive.pack3( reflectVec.x, reflectVec.y, reflectVec.z );
    const envMapColor = textureCubeUV( envMap, queryReflectVec, roughness ); 
    return swizzle(envMapColor, 'rgb');
}

const RECIPROCAL_PI = 0.31830988618;
function integrateSpecularBRDF( dotNV, roughness ) {
	const c0 = Reactive.pack4( -1, -0.0275, -0.572, 0.022 );
	const c1 = Reactive.pack4( 1, 0.0425, 1.04, - 0.04 );
	const r = roughness.mul(c0).add(c1);
	const a004 = Reactive.min( r.x.mul(r.x), Reactive.pow(2, dotNV.mul(-9.28) ) ).mul(r.x).add(r.y);
	return Reactive.pack2( -1.04, 1.04 ).mul(a004).add(Reactive.pack2(r.z, r.w));
}

function BRDF_Diffuse_Lambert( diffuseColor ) {
	return diffuseColor.mul(RECIPROCAL_PI);
}

function F_Schlick_RoughnessDependent( F0, dotNV, roughness ) {
	const fresnel = exp2( ( Reactive.mul(-5.55473, dotNV).sub(6.98316) ).mul(dotNV) );
    const oneMinusRough = Reactive.sub(1, roughness);
	const Fr = Reactive.max( Reactive.pack3(oneMinusRough, oneMinusRough, oneMinusRough), F0 ).sub(F0);
	return Fr.mul(fresnel).add(F0);
}

function BRDF_Specular_Multiscattering_Environment(geometry, specularColor, roughness){
	const dotNV = saturate( Reactive.dot( geometry.normal, geometry.viewDir ) );
	const F = F_Schlick_RoughnessDependent( specularColor, dotNV, roughness );
	const brdf = integrateSpecularBRDF( dotNV, roughness );
	const FssEss = F.mul(brdf.x).add(brdf.y);
	const Ess = brdf.x.add(brdf.y);
	const Ems = Reactive.sub(1.0, Ess);
    const Favg = specularColor.add(Reactive.sub( 1.0, specularColor ).mul(0.047619));
    const Fms = FssEss.mul(Favg).div( Reactive.sub(1.0, Ems.mul(Favg) ));
    return {
        singleScattering: FssEss,
        multiScattering: Fms.mul(Ems)
    }
}

function RE_IndirectDiffuse_Physical(irradiance, geometry, material, reflectedLight){
    reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse.add(irradiance.mul(BRDF_Diffuse_Lambert( material.diffuseColor )));
}

function RE_IndirectSpecular_Physical(radiance, irradiance, geometry, material, reflectedLight){
    const clearcoatDHR = 0.0;
	const clearcoatInv = 1.0 - clearcoatDHR;
	const cosineWeightedIrradiance = irradiance.mul(RECIPROCAL_PI);
    const {singleScattering, multiScattering} = BRDF_Specular_Multiscattering_Environment( geometry, material.specularColor, material.specularRoughness );
    const diffuse = material.diffuseColor.mul( Reactive.sub(1.0, ( singleScattering.add( multiScattering ))));
	reflectedLight.indirectSpecular = reflectedLight.indirectSpecular.add(radiance.mul(clearcoatInv).mul(singleScattering));
	reflectedLight.indirectSpecular = reflectedLight.indirectSpecular.add(multiScattering.mul(cosineWeightedIrradiance));
	reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse.add(diffuse.mul(cosineWeightedIrradiance));
}


function vertShader(){
    const objectNormal = attribute('NORMAL');
    const objectTangent = attribute('TANGENT');

    const transformedNormal = swizzle(transform('NORMAL_MATRIX').mul(swizzle(objectNormal, 'xyz')), 'xyz');
    const transformedTangent = swizzle(transform('MV_MATRIX').mul(swizzle(attribute('TANGENT'), 'xyz0')), 'xyz');

    const vNormal = Reactive.normalize(transformedNormal.normalize());
    const vTangent = Reactive.normalize(transformedTangent);
    const vBitangent = Reactive.normalize(Reactive.cross(vNormal, vTangent).mul(objectTangent.w));

    const mvPosition = transform('MV_MATRIX').mul(swizzle(attribute('POSITION'), 'xyz1'));
    const vViewPosition = mvPosition.mul(-1);

    return {
        vNormal,
        vTangent,
        vBitangent,
        vViewPosition
    }
}

function sRGBToLinear(value){
    const val3 = swizzle(value, 'rgb');
    return Reactive.pack2(
        Reactive.mix(
            val3.mul(0.9478672986).add(0.0521327014).pow(2.4), 
            val3.mul(0.0773993808), 
            Reactive.step(0.04045, val3)),
        value.w
    );
}
function LinearTosRGB( value ) {
    const vRGB = swizzle(value, 'rgb');
	return Reactive.pack2( 
        Reactive.mix( 
            Reactive.pow( vRGB, Reactive.pack3( 0.41666, 0.41666, 0.41666 ) ).mul(1.055).sub( 0.055 ), 
            vRGB.mul(12.92),
            Reactive.step(0.0031308, vRGB)
        ), 
        value.w
    );
}

function buildShader(baseColPx, normalPx, ormPx, emissivePx, pmremTexSignal){
    const {vNormal, vTangent, vBitangent, vViewPosition} = vertShader();
    
    // fragment shader
    const diffuseColor = baseColPx;
    // const diffuseColor = sRGBToLinear(baseColPx);
    const roughnessFactor = ormPx.y;
    const metalnessFactor = ormPx.z;
    
    let normal = Reactive.normalize( Shaders.fragmentStage(vNormal) );
    const tangent = Reactive.normalize( Shaders.fragmentStage(vTangent) );
    const bitangent = Reactive.normalize( Shaders.fragmentStage(vBitangent) );

    // we can't create this matrix for real
    const vTBN = new fakeMat3( tangent, bitangent, normal ); 

    const geometryNormal = normal;
    // this is where normalScale would go if I added it
    const mapN = swizzle(normalPx, 'rgb').mul(2).sub(1);

    normal = Reactive.normalize( vTBN.mulV3(mapN) );
    
    let totalEmissiveRadiance = swizzle(sRGBToLinear(emissivePx), 'rgb');

    const dxy = Reactive.max( Reactive.abs(dFdx(geometryNormal)), Reactive.abs(dFdy(geometryNormal)));
    const geometryRoughness = Reactive.max( Reactive.max( dxy.x, dxy.y ), dxy.z );

    const material = {
        diffuseColor: swizzle(diffuseColor, 'rgb').mul(Reactive.val(1).sub(metalnessFactor)),
        specularRoughness: Reactive.min(Reactive.max(roughnessFactor, 0.0525).add(geometryRoughness), 1),
        specularColor: Reactive.mix( Reactive.pack3( 0.04, 0.04, 0.04 ), swizzle(diffuseColor, 'rgb'), metalnessFactor )
    }

    const geometry = {
        position: vViewPosition.mul(-1),
        normal: normal,
        viewDir: Reactive.normalize(swizzle(vViewPosition, 'xyz'))
    };

    const reflectedLight = {
        directDiffuse: Reactive.pack3(0,0,0),
        directSpecular: Reactive.pack3(0,0,0),
        indirectDiffuse: Reactive.pack3(0,0,0),
        indirectSpecular: Reactive.pack3(0,0,0)
    }

    const maxMipLevel = 11;

    const irradiance = Reactive.pack3(0,0,0);
    const iblIrradiance = getLightProbeIndirectIrradiance( geometry, maxMipLevel, pmremTexSignal );
    const radiance = getLightProbeIndirectRadiance( geometry.viewDir, geometry.normal, material.specularRoughness, maxMipLevel, pmremTexSignal );

    RE_IndirectDiffuse_Physical( irradiance, geometry, material, reflectedLight );
    RE_IndirectSpecular_Physical( radiance, iblIrradiance, geometry, material, reflectedLight );

    const outgoingLight = reflectedLight.directDiffuse
        .add(reflectedLight.indirectDiffuse)
        .add(reflectedLight.directSpecular)
        .add(reflectedLight.indirectSpecular)
        .add(totalEmissiveRadiance);
    

    return LinearTosRGB(
        Reactive.pack2(outgoingLight, diffuseColor.w)
        );
}

module.exports = {
    buildShader
}