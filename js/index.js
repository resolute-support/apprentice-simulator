import * as THREE from 'three';
import {OrbitControls} from 'OrbitControls';
import {DRACOLoader} from 'DRACOLoader';
import {GLTFLoader} from 'GLTFLoader';

let renderer, scene, camera
let walls, floor, line, Obstacles, ApprenticeBot;

let currentEnv = "Blank"
let currentCam = "Orbit"

let UltrasonicRay = new THREE.Raycaster();
let leftObstacleRay = new THREE.Raycaster();
let rightObstacleRay = new THREE.Raycaster();
let leftLineRay = new THREE.Raycaster();
let rightLineRay = new THREE.Raycaster();

let ultradir = new THREE.Vector3(0, 0, 1.5).normalize();
let rightdir = new THREE.Vector3(-0.7, 0, 1.5).normalize();
let leftdir = new THREE.Vector3(0.7, 0, 1.5).normalize();

let rightObsPos = new THREE.Vector3()
let leftObsPos = new THREE.Vector3()
let rightLSPos = new THREE.Vector3()
let leftLSPos = new THREE.Vector3()
let ultrapos = new THREE.Vector3()

let arrowHelper1;
let arrowHelper2;
let arrowHelper3;

let run = true;
let debug = false;
let originalColor = new THREE.Color(0.8631572134510892, 0.8631572134510892, 0.8631572134510892);
let RgbColors = ["red", "green", "blue", "white", "black"]

let apprenticeCHildren = {
    inputs: {},
    outputs: {},
    cameras: {}
}
let sensorData = {
    ultrasonicDistance: 0,
    leftIRObstacleSensor: 0,
    rightIRObstacleSensor: 0,
    leftIRLineSensor: 0,
    rightIRLineSensor: 0,
}
let move = {
    type: "",
    state: false,
    direction: "",
    power: 0
}

start()

//----------------- THREEJS -----------------------------
async function start() {

    let container = document.getElementById("sim")

    //setup GLB / GLTF loader
    const loader = new GLTFLoader().setPath('./media/models');
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('../../node_modules/three/examples/jsm/libs/draco/');
    loader.setDRACOLoader(dracoLoader);

    //Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#6699cc")

    //dynamic window scaling
    window.addEventListener('resize', onWindowResize)

    await loader.load('/Apprentice Bot/Apprentice_v2.2.1.1.glb', function (gltf) {
        document.getElementById('loadProgress').innerHTML = "Starting Simulator..."
        ApprenticeBot = gltf.scene
        ApprenticeBot.position.y += 0.011;
        apprenticeCHildren.outputs.leftWheel = ApprenticeBot.children[11]
        apprenticeCHildren.outputs.rightWheel = ApprenticeBot.children[10]
        apprenticeCHildren.inputs.leftLineIR = ApprenticeBot.children[0].children[10]
        apprenticeCHildren.inputs.rightLineIR = ApprenticeBot.children[0].children[11]
        apprenticeCHildren.inputs.leftObstacleSensor = ApprenticeBot.children[5].children[0]
        apprenticeCHildren.inputs.rightObstacleSensor = ApprenticeBot.children[4].children[0]
        apprenticeCHildren.outputs.leftRGB = ApprenticeBot.children[5].children[2]
        apprenticeCHildren.outputs.rightRGB = ApprenticeBot.children[4].children[2]
        apprenticeCHildren.inputs.ultrasonicSensor = ApprenticeBot.children[9].children[1].children[26]
        apprenticeCHildren.cameras.shoulder = ApprenticeBot.children[13]
        apprenticeCHildren.cameras.pov = ApprenticeBot.children[14]
        apprenticeCHildren.cameras.top = ApprenticeBot.children[12]

        apprenticeCHildren.inputs.rightObstacleSensor.getWorldPosition(rightObsPos)
        apprenticeCHildren.inputs.leftObstacleSensor.getWorldPosition(leftObsPos)
        apprenticeCHildren.inputs.ultrasonicSensor.getWorldPosition(ultrapos)

        if(debug) {
            arrowHelper1 = new THREE.ArrowHelper(ultradir, ultrapos, 0.1, 0x0000ff);
            arrowHelper2 = new THREE.ArrowHelper(leftdir, leftObsPos, 0.1, 0x0000ff);
            arrowHelper3 = new THREE.ArrowHelper(rightdir, rightObsPos, 0.1, 0x0000ff);
            scene.add(arrowHelper1);
            scene.add(arrowHelper2);
            scene.add(arrowHelper3);
        }

        console.log("VS: LOADED -> APPRENTICE.GLB")
        scene.add(ApprenticeBot)
        console.log("apprentice Meshes: ", apprenticeCHildren)
    
    }, function (xhr) {
        let percentage = Math.floor((xhr.loaded / xhr.total * 100)) + '%'
        document.getElementById('loadProgress').innerHTML = percentage
        document.getElementById('myBar').style.width = percentage
    },)

    loader.load('/environment/Floor.glb', function (gltf) {
        floor = gltf.scene;
        scene.add(floor);
        console.log("VS: LOADED -> Floor.glb")
    });
    
    loader.load('/environment/line_path.glb', function (gltf) {
        line = gltf.scene;
        line.traverse( ( object ) => {
            if ( object.isMesh ) {
                object.position.y = 0.0015;
                object.material.color.set(0x000000);
            }
        });
        console.log("VS: LOADED -> Line.glb")
    });

    loader.load('/environment/Walls.glb', function (gltf) {
        walls = gltf.scene;
        let ext = walls.clone()
        ext.position.y += 0.02;
        ext.visible = false;
        scene.add(ext)
        scene.add(walls);
        console.log("VS: LOADED -> Walls_V2.glb")
    });
    
    loader.load('/environment/Obstacles_v1.2.glb', function ( gltf ) {
        Obstacles = gltf.scene;
        //obstacleMeshes = obstacles.children[0].children
        console.log("VS: LOADED -> Obstacles.glb")
    });

    //setup camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 3);

    //setup renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;             //without landscape skybox
    //renderer.toneMappingExposure = 0.8;           //with landscape skbox
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.domElement.classList.add("renderer")

    //Orbit controls for main external camera
    let controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', () => {
        if (!run) render();
    });
    controls.minDistance = 0.1;
    camera.position.set(-10, 4, 10);
    controls.maxDistance = 2;
    controls.target.set(0, 0, 0);
    controls.update();

    const light = new THREE.PointLight(0xFFFFFF, 0.3, 1000);
    light.position.set(-50, 50, 50);
    scene.add(light);

    const light2 = new THREE.PointLight(0xFFFFFF, 0.3, 1000);
    light2.position.set(50, 50, -50);
    scene.add(light2);

    const light3 = new THREE.PointLight(0xFFFFFF, 0.1, 1000);
    light3.position.set(50, 0, 0);
    scene.add(light3);

    while (ApprenticeBot == null) await delay(20);
    document.getElementById("loadingscreen").classList.add("loadingHidden")
    await delay(400);
    document.getElementById("loadingscreen").style.display = "none"
    document.getElementById("button-section").style.display = "flex"
    document.getElementById("sim").style.display = "block";
    setListeners()
    startConnection()
    setBot()
    animate()
}

async function animate() {
    requestAnimationFrame(animate);
    if (run) render()
    await getSensorData();
    if (move.state) {
        if (move.type == "linear") {
            if (move.direction == 'forward') {
                ApprenticeBot.position.z += (Math.cos(ApprenticeBot.rotation.y).toFixed(3)) * (move.power / 80000)
                ApprenticeBot.position.x += (Math.sin(ApprenticeBot.rotation.y).toFixed(3)) * (move.power / 80000)
                apprenticeCHildren.outputs.leftWheel.rotation.x += move.power / 3187
                apprenticeCHildren.outputs.rightWheel.rotation.x += move.power / 3187
            } else if (move.direction == 'back') {
                ApprenticeBot.position.z -= (Math.cos(ApprenticeBot.rotation.y).toFixed(3)) * (move.power / 80000)
                ApprenticeBot.position.x -= (Math.sin(ApprenticeBot.rotation.y).toFixed(3)) * (move.power / 80000)
                apprenticeCHildren.outputs.leftWheel.rotation.x -= move.power / 3187
                apprenticeCHildren.outputs.rightWheel.rotation.x -= move.power / 3187
            } else if (move.direction == 'left') {
                ApprenticeBot.rotation.y += move.power / 4000
                apprenticeCHildren.outputs.leftWheel.rotation.x += move.power / 3187
                apprenticeCHildren.outputs.rightWheel.rotation.x -= move.power / 3187
            } else if (move.direction == 'right') {
                ApprenticeBot.rotation.y -= move.power / 4000
                apprenticeCHildren.outputs.leftWheel.rotation.x -= move.power / 3187
                apprenticeCHildren.outputs.rightWheel.rotation.x += move.power / 3187
            }
        } else if (move.type == "differential") {
            //?
        }
        boundries();
    }
    interfaceFunctions()
}

function interfaceFunctions() {
    document.getElementById("DistancesensVal").innerHTML = sensorData.ultrasonicDistance
    document.getElementById("LOsensVal").innerHTML = sensorData.leftIRObstacleSensor  
    document.getElementById("ROsensVal").innerHTML = sensorData.rightIRObstacleSensor 
    document.getElementById("LLsensVal").innerHTML = sensorData.leftIRLineSensor     
    document.getElementById("RLsensVal").innerHTML = sensorData.rightIRLineSensor
    document.getElementById("XsensVal").innerHTML = (ApprenticeBot.position.x*100).toFixed(2)
    document.getElementById("YsensVal").innerHTML = (ApprenticeBot.position.z*100).toFixed(2)
}

function boundries() {
    if (ApprenticeBot.position.x >= 0.53) ApprenticeBot.position.x = 0.56
    if (ApprenticeBot.position.x <= -0.56) ApprenticeBot.position.x = -0.56
    if (ApprenticeBot.position.z >= 0.50) ApprenticeBot.position.z = 0.50
    if (ApprenticeBot.position.z <= -0.56) ApprenticeBot.position.z = -0.56
}

function setBot() {
    apprenticeCHildren.outputs.leftRGB.material.color = originalColor;
    apprenticeCHildren.outputs.rightRGB.material.color = originalColor;
    
    move.state = false;
    if (currentEnv == "Line" || currentEnv == "Combo") {
        ApprenticeBot.position.z = 0.2;
        ApprenticeBot.position.x = 0;
        ApprenticeBot.rotation.y = degToRad(90);
    }
    else {
        ApprenticeBot.position.z = 0;
        ApprenticeBot.position.x = 0;
        ApprenticeBot.rotation.y = 0;
    }
}

function render() {
    if (currentCam == "Orbit") {
        renderer.render(scene, camera)
    }
    else if (currentCam == "Shoulder") {
        renderer.render(scene, apprenticeCHildren.cameras.shoulder)
    }
    else if (currentCam == "Top") {
        renderer.render(scene, apprenticeCHildren.cameras.top)
    }
    else if (currentCam == "Pov") {
        renderer.render(scene, apprenticeCHildren.cameras.pov)
    }
}


//----------------- SENSOR -----------------------------
function getSensorData() {

    apprenticeCHildren.inputs.leftLineIR.getWorldPosition(leftLSPos)    
    apprenticeCHildren.inputs.rightLineIR.getWorldPosition(rightLSPos)
    apprenticeCHildren.inputs.rightObstacleSensor.getWorldPosition(rightObsPos)
    apprenticeCHildren.inputs.leftObstacleSensor.getWorldPosition(leftObsPos)
    apprenticeCHildren.inputs.ultrasonicSensor.getWorldPosition(ultrapos)

    sensorData.ultrasonicDistance = ultraReading();                 //ultrasonic Sensor Reading
    sensorData.leftIRObstacleSensor = obstacleReading("left");      //left obstacle Sensor Reading
    sensorData.rightIRObstacleSensor = obstacleReading("right");    //right obstacle Sensor Reading
    sensorData.leftIRLineSensor = lineReading("left");              //left line Sensor Reading
    sensorData.rightIRLineSensor = lineReading("right");            //right line Sensor Reading
    
    
    //ARROW HELPERS
    if(!debug) return;
    
    apprenticeCHildren.inputs.ultrasonicSensor.getWorldPosition(arrowHelper1.position)          //ultrasonic
    arrowHelper1.rotation.z = -(ApprenticeBot.rotation.y)

    apprenticeCHildren.inputs.rightObstacleSensor.getWorldPosition(arrowHelper3.position)
    apprenticeCHildren.inputs.leftObstacleSensor.getWorldPosition(arrowHelper2.position)

    //arrowHelper2.rotation.z = -(ApprenticeBot.rotation.y + 0.7)
    //arrowHelper3.rotation.z = -(ApprenticeBot.rotation.y - 0.7)
}

function obstacleReading(side) {
    return "-"
}

function lineReading(side) {
    let Intersects
    if (side == "right") {
        rightLineRay.set(rightLSPos, new THREE.Vector3(0,-1,0));
        Intersects = rightLineRay.intersectObjects(scene.children)
    }
    else if (side == "left") {
        leftLineRay.set(leftLSPos, new THREE.Vector3(0,-1,0));
        Intersects = leftLineRay.intersectObjects(scene.children)
    }
    let rgb = Intersects[0].object.material.color
    let val = (rgb.r+rgb.g+rgb.b)/3
    return (val == 1)
}

function ultraReading() {
    let ultraPos = new THREE.Vector3()
    apprenticeCHildren.inputs.ultrasonicSensor.getWorldPosition(ultraPos)
    UltrasonicRay.set(ultraPos, new THREE.Vector3(Math.sin(ApprenticeBot.rotation.y), 0.01, Math.cos(ApprenticeBot.rotation.y)));
    let intersects = UltrasonicRay.intersectObjects(scene.children);
    if (!intersects[1]) return 0.00.toFixed(2)
    let distance = (intersects[1].distance * 100).toFixed(2)
    return distance
}


//----------------- MAKECODE -----------------------------
function startConnection() {
    console.log("VS: Starting connection")
    window.addEventListener("message", function (ev) {
        switch (ev.data.type) {
            case "messagepacket":
                setSim(uint8ArrayToString(ev.data.data))
                break;
            case "stop":
                console.log("VS: RECV -> stop")
                setBot()
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
                setBot()
                break;
            default:
            //console.log("unknown event type!!   -> "+ev.type)
            //console.log(ev)
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
            move.type = data.command.method
            move.state = true;
            move.direction = data.command.direction
            move.power = (data.command.power / 4095) * 255
        } else if (data.command.type == "move" && data.command.state == "false") {
            move.state = false;
        }
        //RGB Light Operations
        else if (data.command.type == "led") {
            if (data.command.assignment == "color") {
                apprenticeCHildren.outputs.leftRGB.material.color = new THREE.Color(RgbColors[data.command.value])
                apprenticeCHildren.outputs.rightRGB.material.color = new THREE.Color(RgbColors[data.command.value])
            } else if (data.command.assignment == "RGB") {
                apprenticeCHildren.outputs.leftRGB.material.color = new THREE.Color(data.command.value.R / 255, data.command.value.G / 255, data.command.value.B / 255);
                apprenticeCHildren.outputs.rightRGB.material.color = new THREE.Color(data.command.value.R / 255, data.command.value.G / 255, data.command.value.B / 255);
            }
        } else {
            console.log("VS: ERROR -> Unknown Assignment")
        }
    } else if (data.input) {
        if (data.input.type == "button") {
            if (data.input.id == "A") {
                if (data.input.state == "down") {
                    console.log("VS:  button A DOWN")
                } else if (data.input.state == "up") {
                    console.log("VS:  button A UP")
                }
            } else if (data.input.id == "B") {
                if (data.input.state == "down") {
                    console.log("VS:  button B DOWN")
                } else if (data.input.state == "up") {
                    console.log("VS:  button B UP")
                }
            } else if (data.input.id == "AB") {
                if (data.input.state == "down") {
                    console.log("VS:  buttons AB DOWN")
                } else if (data.input.state == "up") {
                    console.log("VS:  button AB UP")
                }
            }
        }
    }
}


//----------------- UTILITY -----------------------------
function onWindowResize() {
    switch(currentCam) {
        case "Orbit":
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            break;
        case "Top":
            apprenticeCHildren.cameras.top.aspect = window.innerWidth / window.innerHeight;
            apprenticeCHildren.cameras.top.updateProjectionMatrix();
            break;
        case "Shoulder":
            apprenticeCHildren.cameras.shoulder.aspect = window.innerWidth / window.innerHeight;
            apprenticeCHildren.cameras.shoulder.updateProjectionMatrix();
            break;
        case "Pov":
            apprenticeCHildren.cameras.pov.aspect = window.innerWidth / window.innerHeight;
            apprenticeCHildren.cameras.pov.updateProjectionMatrix();
            break;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
    
    /*
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
    */
}

function radToDeg(radians) {
    var pi = Math.PI;
    return radians * (180/pi);
}

function degToRad(degrees) {
    var pi = Math.PI;
    return degrees * (pi/180);
}

function delay(millisec) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('')
        }, millisec);
    })
}

function setListeners() {
    document.getElementById("telemBtn").addEventListener('click', ()=> {
        if (document.getElementById("data-section").style.display == "block") {
            document.getElementById("data-section").style.display = "none"
        }
        else {
            document.getElementById("data-section").style.display = "block"
        }
    })
    
    //ENV BUTTONS
    document.getElementById("envBlankBtn").addEventListener('click', ()=> {
        if (currentEnv == "Blank") return;
        currentEnv = "Blank"
        scene.remove( line )
        scene.remove( Obstacles )
        document.getElementById("envComboBtn").classList.remove("buttons-active")
        document.getElementById("envLineBtn").classList.remove("buttons-active")
        document.getElementById("envObstacleBtn").classList.remove("buttons-active")
        document.getElementById("envBlankBtn").classList.add("buttons-active")
        document.getElementById("envOps").style.display = "none"
    })
    document.getElementById("envLineBtn").addEventListener('click', ()=> {
        if (currentEnv == "Line") return;
        currentEnv = "Line"
        scene.remove( line )
        scene.remove( Obstacles )
        document.getElementById("envBlankBtn").classList.remove("buttons-active")
        document.getElementById("envComboBtn").classList.remove("buttons-active")
        document.getElementById("envObstacleBtn").classList.remove("buttons-active")
        document.getElementById("envLineBtn").classList.add("buttons-active")
        scene.add( line )
        document.getElementById("envOps").style.display = "none"
    })
    document.getElementById("envObstacleBtn").addEventListener('click', ()=> {
        if (currentEnv == "Obstacle") return;
        currentEnv = "Obstacle"
        scene.remove( line )
        scene.remove( Obstacles )
        document.getElementById("envBlankBtn").classList.remove("buttons-active")
        document.getElementById("envLineBtn").classList.remove("buttons-active")
        document.getElementById("envComboBtn").classList.remove("buttons-active")
        document.getElementById("envObstacleBtn").classList.add("buttons-active")
        scene.add( Obstacles )
        document.getElementById("envOps").style.display = "none"
    })
    
    
    document.getElementById("envComboBtn").addEventListener('click', ()=> {
        if (currentEnv == "Combo") return;
        currentEnv = "Combo"
        scene.remove( line )
        scene.remove( Obstacles )
        document.getElementById("envBlankBtn").classList.remove("buttons-active")
        document.getElementById("envLineBtn").classList.remove("buttons-active")
        document.getElementById("envObstacleBtn").classList.remove("buttons-active")
        document.getElementById("envComboBtn").classList.add("buttons-active")
        scene.add( line )
        scene.add( Obstacles )
        document.getElementById("envOps").style.display = "none"
    })
    
    document.getElementById("envToggleBtn").addEventListener('click', ()=> {
        if (document.getElementById("envOps").style.display == "flex") {
            document.getElementById("envOps").style.display = "none"
        }
        else {
            document.getElementById("envOps").style.display = "flex"
        }
    })
    
    document.getElementById("frontCamBtn").addEventListener('click', ()=> { currentCam = "Pov"; onWindowResize() })
    document.getElementById("overHeadCamBtn").addEventListener('click', ()=> { currentCam = "Top"; onWindowResize() })
    document.getElementById("shoulderCamBtn").addEventListener('click', ()=> { currentCam = "Shoulder"; onWindowResize() })
    document.getElementById("orbitCamBtn").addEventListener('click', ()=> { currentCam = "Orbit"; onWindowResize() })
    
}
