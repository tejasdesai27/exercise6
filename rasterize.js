/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://raw.githubusercontent.com/NCSUCGClassPrivate/exercise5/async/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://raw.githubusercontent.com/NCSUCGClassPrivate/exercise5/async/ellipsoids.json"; // ellipsoids file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* input globals */
var inputTriangles; // the triangles read in from json
var numTriangleSets = 0; // the number of sets of triangles
var triSetSizes = []; // the number of triangles in each set

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffers = []; // this contains vertex coordinates in triples, organized by tri set
var triangleBuffers = []; // this contains indices into vertexBuffers in triples, organized by tri set
var vertexPositionAttrib; // where to put position for vertex shader
var modelMatrixULoc; // where to put the model matrix for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file


// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try
    
    catch(e) {
        console.log(e);
    } // end catch
 
} // end setupWebGL


// read triangles in, load them into webgl buffers
function loadTriangles() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd; // vtx coords to add to the coord array
        var triToAdd; // tri indices to add to the index array

        // for each set of tris in the input file
        numTriangleSets = inputTriangles.length;

        for (var whichSet=0; whichSet<numTriangleSets; whichSet++) {
            
            // set up the vertex coord array
            inputTriangles[whichSet].coordArray = [];

            for (whichSetVert=0;
                 whichSetVert<inputTriangles[whichSet].vertices.length;
                 whichSetVert++) {

                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];

                inputTriangles[whichSet].coordArray.push(
                    vtxToAdd[0],
                    vtxToAdd[1],
                    vtxToAdd[2]
                );
            }

            // send the vertex coords to webGL
            vertexBuffers[whichSet] = gl.createBuffer();

            gl.bindBuffer(
                gl.ARRAY_BUFFER,
                vertexBuffers[whichSet]
            );

            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array(inputTriangles[whichSet].coordArray),
                gl.STATIC_DRAW
            );
            
            // set up the triangle index array
            inputTriangles[whichSet].indexArray = [];

            triSetSizes[whichSet] =
                inputTriangles[whichSet].triangles.length;

            for (whichSetTri=0;
                 whichSetTri<triSetSizes[whichSet];
                 whichSetTri++) {

                triToAdd =
                    inputTriangles[whichSet].triangles[whichSetTri];

                inputTriangles[whichSet].indexArray.push(
                    triToAdd[0],
                    triToAdd[1],
                    triToAdd[2]
                );
            }

            // send the triangle indices to webGL
            triangleBuffers[whichSet] =
                gl.createBuffer();

            gl.bindBuffer(
                gl.ELEMENT_ARRAY_BUFFER,
                triangleBuffers[whichSet]
            );

            gl.bufferData(
                gl.ELEMENT_ARRAY_BUFFER,
                new Uint16Array(inputTriangles[whichSet].indexArray),
                gl.STATIC_DRAW
            );
        }
    }
} // end load triangles


// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        void main(void) {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        uniform mat4 uModelMatrix;

        void main(void) {
            gl_Position = uModelMatrix * vec4(vertexPosition, 1.0);
        }
    `;
    
    try {

        var fShader =
            gl.createShader(gl.FRAGMENT_SHADER);

        gl.shaderSource(
            fShader,
            fShaderCode
        );

        gl.compileShader(fShader);


        var vShader =
            gl.createShader(gl.VERTEX_SHADER);

        gl.shaderSource(
            vShader,
            vShaderCode
        );

        gl.compileShader(vShader);
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {

            throw "error during fragment shader compile: "
                + gl.getShaderInfoLog(fShader);

            gl.deleteShader(fShader);

        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {

            throw "error during vertex shader compile: "
                + gl.getShaderInfoLog(vShader);

            gl.deleteShader(vShader);

        } else {

            var shaderProgram =
                gl.createProgram();

            gl.attachShader(
                shaderProgram,
                fShader
            );

            gl.attachShader(
                shaderProgram,
                vShader
            );

            gl.linkProgram(
                shaderProgram
            );


            if (!gl.getProgramParameter(
                    shaderProgram,
                    gl.LINK_STATUS)) {

                throw "error during shader program linking: "
                    + gl.getProgramInfoLog(shaderProgram);

            } else {

                gl.useProgram(shaderProgram);

                vertexPositionAttrib =
                    gl.getAttribLocation(
                        shaderProgram,
                        "vertexPosition"
                    );

                modelMatrixULoc =
                    gl.getUniformLocation(
                        shaderProgram,
                        "uModelMatrix"
                    );

                gl.enableVertexAttribArray(
                    vertexPositionAttrib
                );
            }
        }
    }
    
    catch(e) {
        console.log(e);
    }

} // end setup shaders


// render the loaded model
function renderTriangles() {

    gl.clear(
        gl.COLOR_BUFFER_BIT |
        gl.DEPTH_BUFFER_BIT
    );


    // =====================================================
    // FIRST TRIANGLE SET
    // =====================================================

    inputTriangles[0].mMatrix = mat4.create();

    var triCenter =
        vec3.fromValues(
            0.25,
            0.70,
            0
        );

    var triTarget =
        vec3.fromValues(
            -0.725,
            -0.205,
            0
        );


    // move triangle to target position
    mat4.translate(
        inputTriangles[0].mMatrix,
        inputTriangles[0].mMatrix,
        triTarget
    );


    // rotate triangle to match target
    mat4.rotateZ(
        inputTriangles[0].mMatrix,
        inputTriangles[0].mMatrix,
        -Math.PI / 4
    );


    // target triangle size
    mat4.scale(
        inputTriangles[0].mMatrix,
        inputTriangles[0].mMatrix,
        vec3.fromValues(
            1.0,
            1.0,
            1.0
        )
    );


    // move original triangle center to origin
    mat4.translate(
        inputTriangles[0].mMatrix,
        inputTriangles[0].mMatrix,
        vec3.fromValues(
            -triCenter[0],
            -triCenter[1],
            0
        )
    );


    // =====================================================
    // SECOND TRIANGLE SET — DIAMOND
    // =====================================================

    inputTriangles[1].mMatrix = mat4.create();

    var squareCenter =
        vec3.fromValues(
            0.25,
            0.25,
            0
        );

    var squareTarget =
        vec3.fromValues(
            -0.25,
            -0.50,
            0
        );


    // move square to target position
    mat4.translate(
        inputTriangles[1].mMatrix,
        inputTriangles[1].mMatrix,
        squareTarget
    );


    // rotate square 45 degrees
    mat4.rotateZ(
        inputTriangles[1].mMatrix,
        inputTriangles[1].mMatrix,
        Math.PI / 4
    );


    // enlarge square
    mat4.scale(
        inputTriangles[1].mMatrix,
        inputTriangles[1].mMatrix,
        vec3.fromValues(
            2.0,
            2.0,
            1.0
        )
    );


    // move original square center to origin
    mat4.translate(
        inputTriangles[1].mMatrix,
        inputTriangles[1].mMatrix,
        vec3.fromValues(
            -squareCenter[0],
            -squareCenter[1],
            0
        )
    );


    // =====================================================
    // RENDER
    // =====================================================

    for (var whichTriSet=0;
         whichTriSet<numTriangleSets;
         whichTriSet++) { 
        
        // pass modeling matrix for set to shader
        gl.uniformMatrix4fv(
            modelMatrixULoc,
            false,
            inputTriangles[whichTriSet].mMatrix
        );

        // vertex buffer
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            vertexBuffers[whichTriSet]
        );

        gl.vertexAttribPointer(
            vertexPositionAttrib,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );

        // triangle buffer
        gl.bindBuffer(
            gl.ELEMENT_ARRAY_BUFFER,
            triangleBuffers[whichTriSet]
        );

        gl.drawElements(
            gl.TRIANGLES,
            3 * triSetSizes[whichTriSet],
            gl.UNSIGNED_SHORT,
            0
        );
    }

} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
    setupWebGL(); // set up the webGL environment

    loadTriangles(); // load in the triangles from tri file

    setupShaders(); // setup the webGL shaders

    renderTriangles(); // draw the triangles using webGL
  
} // end main
