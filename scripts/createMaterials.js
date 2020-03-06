const Materials = require('Materials');
const Reactive = require('Reactive');
const Shaders = require('Shaders');
const Textures = require('Textures');

const {buildShader} = require('./threeShader');

const texCoords = Shaders.vertexAttribute({'variableName': Shaders.VertexAttribute.TEX_COORDS});

const _shader = buildShader(
    Shaders.textureSampler(Textures.get('Body_SG1_baseColor').signal, texCoords), //baseColPx
    Shaders.textureSampler(Textures.get('Body_SG1_normal').signal, texCoords), //normalPx
    Shaders.textureSampler(Textures.get('Body_SG1_metallicRoughness').signal, texCoords), //ormPx
    Shaders.textureSampler(Textures.get('Body_SG1_emissive').signal, texCoords), //emissivePx
    Textures.get('forest_pmrem').signal, //pmremTexSignal
)

const carMat = Materials.get('Body');
carMat.setTextureSlot(Shaders.DefaultMaterialTextures.DIFFUSE, _shader);
const carWindowMat = Materials.get('Window');
carWindowMat.setTextureSlot(Shaders.DefaultMaterialTextures.DIFFUSE, _shader);

const interiorShader = buildShader(
    Shaders.textureSampler(Textures.get('Interior_SG_baseColor').signal, texCoords), //baseColPx
    Shaders.textureSampler(Textures.get('Interior_SG_normal').signal, texCoords), //normalPx
    Shaders.textureSampler(Textures.get('Interior_SG_metallicRoughness').signal, texCoords), //ormPx
    Reactive.pack4(0,0,0,0), //emissivePx
    Textures.get('forest_pmrem').signal, //pmremTexSignal
)

const carInteriorMat = Materials.get('Interior');
carInteriorMat.setTextureSlot(Shaders.DefaultMaterialTextures.DIFFUSE, interiorShader);
