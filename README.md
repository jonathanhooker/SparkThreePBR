
# SparkThreePBR
![PBR Car](https://raw.githubusercontent.com/jonathanhooker/SparkThreePBR/master/textures/preview.jpg)
This is a port of the [THREE.JS](https://github.com/mrdoob/three.js/) standard shader to Spark AR. I created this as a proof of concept on how you could build fully custom shaders just like you would with THREE. I don't intend to maintain or support this but hope it inspires others in the community to create custom shaders via scripting. Currently it only supports IBL lighting with a PMREM texture and models with tangent space normal maps. The shader inside of the THREE supports a huge amount of different configurations so you can reference the original code if you'd like to extend this.

The 3d model in the project is [Pony Cartoon](https://sketchfab.com/3d-models/pony-cartoon-885d9f60b3a9429bb4077cfac5653cf9) by [Slava Z.](https://sketchfab.com/slava) from [Sketchfab](https://sketchfab.com/)

The environment texture is [Ninomaru Teien](https://hdrihaven.com/hdri/?h=ninomaru_teien) by [Greg Zaal](https://hdrihaven.com/hdris/category/?a=Greg%20Zaal) from [HDRIHaven](https://hdrihaven.com/)

## Usage

It's relatively straight forward if you look at the project, but you attach this shader to the diffuse channel of a flat material. In this project there are two scripts:

 - **threeShader.js** - This script is the port of the shader from three. It exports a buildShader function that returns a shader signal.
 - **createMaterials.js** - This script imports the buildShader function from threeShader.js and uses it to create and attach the shaders to the objects in the scene.

## Create a custom PMREM texture

The texture in this repo was created with the [PMREMGenerator](https://github.com/mrdoob/three.js/blob/dev/src/extras/PMREMGenerator.js) class that is included in the THREE library.  Here is the basic gist of how to do that:

    import {
      WebGLRenderer,
      TextureLoader,
      PMREMGenerator
    } from  'three';
    
    const  renderer = new  WebGLRenderer({ antialias:  true });
    
    function  createPMREM ( path ) {
      new  TextureLoader().load( path, ( texture ) => {
        // read data from WebGL Texture
        const  pmremGenerator = new  PMREMGenerator( renderer );
        pmremGenerator.compileEquirectangularShader();
        const  pmrem = pmremGenerator.fromEquirectangular( texture );
          
        // read data from WebGL Texture
        const  data = new  Uint8ClampedArray(pmrem.width*pmrem.height*4);    
        renderer.readRenderTargetPixels(pmrem, 0, 0, pmrem.width, pmrem.height, data); 
           
        // set the alpha to full
        for(let  i=0; i<data.length; i += 4)
          data[i+3] = 255;	
        
        // create canvas
        const  canvas = document.createElement('canvas');
        canvas.width = pmrem.width;
        canvas.height = pmrem.height;
        document.body.appendChild(canvas);
        
        // draw data to canvas
        var  iData = new  ImageData(data, pmrem.width, pmrem.height);
        canvas.getContext('2d').putImageData(iData, 0, 0);		    
        
        pmremGenerator.dispose();
      });
    };
    
    createPMREM('assets/forest.png');
