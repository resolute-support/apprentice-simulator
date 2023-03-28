import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';
import { DRACOLoader } from 'DRACOLoader';
//import { AmmoPhysics } from 'three/addons/physics/AmmoPhysics.js';

let renderer, scene, camera
let walls, floor, ApprenticeBot;
//let physics, position;


let run = true;
let RgbColors = ["red","green","blue","white","black"]

let move = {
    type : "",
    state : false,
    direction : "",
    power : 0
}

let apprenticeCHildren = {
    inputs : {},
    outputs : {}
}

//Setup of simulator, loading models and setting meshes etc
start()

async function start() {

    let container = document.getElementById("sim")

    //physics = await AmmoPhysics();
	//position = new THREE.Vector3();

    //setup GLB / GLTF loader
    const loader = new GLTFLoader().setPath('./media/models');
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath( '../../node_modules/three/examples/jsm/libs/draco/' );
    loader.setDRACOLoader( dracoLoader );

    //Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#6699cc")

    //dynamic window scaling
    window.addEventListener('resize', onWindowResize)

    await loader.load('/Apprentice Bot/Apprentice_v2.2.3.glb',
    
    function ( gltf ) {
        document.getElementById('loadProgress').innerHTML = "Starting Simulator..."
        ApprenticeBot = gltf.scene
        ApprenticeBot.position.y += 0.01;
        apprenticeCHildren.outputs.leftWheel = ApprenticeBot.children[11]
        apprenticeCHildren.outputs.rightWheel = ApprenticeBot.children[10]
        apprenticeCHildren.inputs.leftLineIR = ApprenticeBot.children[0].children[10]
        apprenticeCHildren.inputs.rightLineIR = ApprenticeBot.children[0].children[11]
        apprenticeCHildren.inputs.leftObstacleSensor = ApprenticeBot.children[5].children[0]
        apprenticeCHildren.inputs.rightObstacleSensor = ApprenticeBot.children[4].children[0]
        apprenticeCHildren.outputs.leftRGB = ApprenticeBot.children[5].children[2]
        apprenticeCHildren.outputs.rightRGB = ApprenticeBot.children[4].children[2]
        apprenticeCHildren.inputs.ultrasonicSensor = ApprenticeBot.children[9].children[1]
        console.log("VS: LOADED -> APPRENTICE.GLB")
        scene.add(ApprenticeBot)
        console.log("apprentice Meshes: ", apprenticeCHildren)
    },
    
    function ( xhr ) {
        let percentage = Math.floor(( xhr.loaded / xhr.total * 100 )) + '%'
		document.getElementById('loadProgress').innerHTML = percentage
        document.getElementById('myBar').style.width = percentage
	},)

    loader.load('/environment/Floor.glb', function ( gltf ) {
        floor = gltf.scene;
        scene.add(floor);
        console.log("VS: LOADED -> Floor.glb")
      }
    );
    
    loader.load('/environment/Walls.glb', function ( gltf ) {
        walls = gltf.scene;
        scene.add(walls);
        console.log("VS: LOADED -> Walls.glb")
      },
    );

    //setup camera
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 3 );

    //setup renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;			 //without landscape skybox
    //renderer.toneMappingExposure = 0.8;  //with landscape skbox
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild( renderer.domElement );
    renderer.domElement.classList.add("renderer")

    //Orbit controls for main external camera
    let controls = new OrbitControls( camera, renderer.domElement );
    controls.addEventListener( 'change', () => {  if (!run) render();} ); // use if there is no animation loop
    controls.minDistance = 0.1;
    camera.position.set( -10, 4, 10 );
    controls.maxDistance = 2;
    controls.target.set( 0, 0, 0 );
    controls.update();

    const light = new THREE.PointLight( 0xFFFFFF, 0.3, 1000 );
    light.position.set( -50, 50, 50 );
    scene.add( light );

    const light2 = new THREE.PointLight( 0xFFFFFF, 0.3, 1000 );
    light2.position.set( 50, 50, -50 );
    scene.add( light2 );

    const light3 = new THREE.PointLight( 0xFFFFFF, 0.1, 1000 );
    light3.position.set( 50, 0, 0 );
    scene.add( light3 );

    while (ApprenticeBot == null) {
        await delay(20);
    }
    document.getElementById("loadingscreen").classList.add("loadingHidden")
    await delay(400);
    document.getElementById("loadingscreen").style.display = "none"
    render()
    animate()
    startConnection()
}

function animate() {
    requestAnimationFrame( animate );
    if (run) renderer.render( scene, camera );
    if (move.state) {
        if (move.type == "linear") {
            if (move.direction == 'forward') {
                ApprenticeBot.position.z += (Math.cos(ApprenticeBot.rotation.y).toFixed(3))*(move.power/80000)
                ApprenticeBot.position.x += (Math.sin(ApprenticeBot.rotation.y).toFixed(3))*(move.power/80000)
                apprenticeCHildren.outputs.leftWheel.rotation.x += move.power/3187
                apprenticeCHildren.outputs.rightWheel.rotation.x += move.power/3187
              }
              else if (move.direction == 'back') {
                ApprenticeBot.position.z -= (Math.cos(ApprenticeBot.rotation.y).toFixed(3))*(move.power/80000)
                ApprenticeBot.position.x -= (Math.sin(ApprenticeBot.rotation.y).toFixed(3))*(move.power/80000)
                apprenticeCHildren.outputs.leftWheel.rotation.x -= move.power/3187
                apprenticeCHildren.outputs.rightWheel.rotation.x -= move.power/3187
              }
              else if (move.direction == 'left') {
                ApprenticeBot.rotation.y += move.power/4000
                apprenticeCHildren.outputs.leftWheel.rotation.x += move.power/3187
                apprenticeCHildren.outputs.rightWheel.rotation.x -= move.power/3187
              }
              else if (move.direction == 'right') {
                ApprenticeBot.rotation.y -= move.power/4000
                apprenticeCHildren.outputs.leftWheel.rotation.x -= move.power/3187
                apprenticeCHildren.outputs.rightWheel.rotation.x += move.power/3187 
              }
        }
        else if (move.type == "combo") {

        }

    boundries();

    }
};

function boundries() {
    if (ApprenticeBot.position.x >= 0.53) ApprenticeBot.position.x = 0.56
    if (ApprenticeBot.position.x <= -0.56) ApprenticeBot.position.x = -0.56
    if (ApprenticeBot.position.z >= 0.50) ApprenticeBot.position.z = 0.50
    if (ApprenticeBot.position.z <= -0.56) ApprenticeBot.position.z = -0.56
}

function resetBot() {
    ApprenticeBot.position.z = 0;
    ApprenticeBot.position.x = 0;
    ApprenticeBot.rotation.y = 0;
    move.state = false;
}

function render() {
    renderer.render( scene, camera );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();
}

function delay(millisec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, millisec);
    })
}

function startConnection() {
    document.getElementById("sim").style.display = "block";
    window.addEventListener("message", function(ev) {
        switch(ev.data.type) {
            case "messagepacket":
                const buf = ev.data.data
                setSim(uint8ArrayToString(buf))
                break;
            case "stop":
                console.log("VS: RECV -> stop")
                resetBot()
                break;
            case "stopsound":
                console.log("VS: RECV -> stopsound")
                break;
            case "message":
                console.log("VS: RECV -> message")
                break;
            case "debugger":
                console.log("VS: RECV -> debugger")
                break;
            case "mute":
                console.log("VS: RECV -> mute")
                break;
            case "run":
                console.log("VS: RECV -> run")
                resetBot()
                break;
            default:
                console.log("unknown event type!!   -> "+ev.type)
                console.log(ev)
        }
    })
    //window.parent.postMessage("run");
}

function uint8ArrayToString(input) {
    let len = input.length
    let res = ""
    for (let i = 0; i < len; ++i) res += String.fromCharCode(input[i])
    return res
}

async function setSim(jsonStr) {
    let data = await JSON.parse(jsonStr);
    if (data.command) {

        //Movement Operations
        if (data.command.type == "move" && data.command.state == "true") {
            move.state = true;
            move.direction = data.command.direction
            move.power = (data.command.power/4095)*255
        }
        else if (data.command.type == "move" && data.command.state == "false"){
            move.state = false;
        }

         //RGB Light Operations
        else if (data.command.type == "led") {
            if (data.command.assignment == "color") {
                apprenticeCHildren.outputs.leftRGB.material.color = new THREE.Color(RgbColors[data.command.value])
                apprenticeCHildren.outputs.rightRGB.material.color = new THREE.Color(RgbColors[data.command.value])
            }
            else if (data.command.assignment == "RGB") {
                apprenticeCHildren.outputs.leftRGB.material.color = new THREE.Color( data.command.value.R/255, data.command.value.G/255, data.command.value.B/255 );
                apprenticeCHildren.outputs.rightRGB.material.color = new THREE.Color( data.command.value.R/255, data.command.value.G/255, data.command.value.B/255 );
            }
        }
        else {
            console.log("VS: ERROR -> Unknown Assignment")
        }
    }
    //console.log(move)
}


