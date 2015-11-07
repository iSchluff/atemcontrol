var midi = require('midi');
var atem = require('./atem.js');
var LaunchControl = require('./launchcontrol.js');

/******* Config *******/
var config = {
    atemIP: '10.0.2.9',
    keyboard: true,
    midi: true,
    gpio: false,
    tallyPi: '10.0.2.114'
}
/*********************/

// var stdin = process.stdin;
// require('tty').setRawMode(true);
var log= {
    midi: console.log.bind(this, 'MIDI -'),
    atem: console.log.bind(this, 'ATEM -'),
    gpio: console.log.bind(this, 'GPIO -'),
    tally: console.log.bind(this, 'TALLY -')
};

/* Keyboard Mode */
var enableKeyboard = function(){
    process.stdin.setRawMode(true);
    process.stdin.on('data', function (buffer) {
        var s= "";
        for(var i=0; i<buffer.length; i++){
            s+=  String(buffer[i]) + " ";
        }
        console.log(s);
        if(buffer.length == 1){
            if(buffer[0] == 3)
                process.exit(0);
            else if(buffer[0] > 48 && buffer[0] < 58)
                atem.setPreview(buffer[0] - 48)
            else if(buffer[0] == 99)
                atem.cut();
            else if(buffer[0] == 97)
                atem.auto();
        }

        // process.stdout.write('Get Chunk: ' + buffer.toString() + '\n');
        // if (key && key.ctrl && key.name == 'c') process.exit();
    });
}

if(config.keyboard && process.stdin.setRawMode)
    enableKeyboard();

/* MIDI connection */
var input = new midi.input();
var output = new midi.output();

// Order: (Sysex, Timing, Active Sensing)
input.ignoreTypes(false, false, false)

var probeMidi = function(print){
    var ports = {};
    for(var i=0; i<input.getPortCount(); i++){
        var portname = input.getPortName(i);
        if(print)
            log.midi('\tIN: \tPort', i, portname);
        if(portname.match(/Launch Control XL/))
            ports.in = i;
    }
    for(var i=0; i<output.getPortCount(); i++){
        var portname = input.getPortName(i);
        if(print)
            log.midi('\tOUT: \tPort', i, portname);
        if(portname.match(/Launch Control XL/))
            ports.out = i;
    }
    return ports;
}

var midiStatus = {
    connected: false
}

var sendMidiMessage = function(message){
    if(midiStatus.connected)
        output.sendMessage(message);
}

var sendMidiMessages = function(messages){
    for(var i=0; i<messages.length; i++){
        sendMidiMessage(messages[i]);
    }
}

var first = true;
var tryMidi = function(){
    if(first)
        log.midi('Ports In:', input.getPortCount(), 'Out:', output.getPortCount());
    var ports = probeMidi(first);
    if(ports.in && ports.out){
        midiStatus.connected = true;
        log.midi('Connected');
        input.openPort(ports.in);
        output.openPort(ports.out);
    }else{
        if(first)
            log.midi('Launchpad not found, will keep searching for it');
        setTimeout(tryMidi, 5000);
    }
    first = false;
}
if(config.midi)
    tryMidi();

process.on('exit', function(code){
    if(midiStatus.connected){
        input.closePort();
        output.closePort();
    }
});

/* Raspberry GPIO Tally */
(function(){
    if(!config.gpio)
        return;

    // maps camera tally to raspberry gpio (electrical numbering)
    var GPIO_MAP = [11, 13, 15, 16, 18, 7, 12, 22, 29, 31];
    var enabled = [];
    var gpio;

    try{
        gpio = require('pi-gpio');
    }catch(err){
        log.gpio('Failed: This is Probably not a PI');
        return;
    }
    log.gpio('Enabled: This seems to be a PI');

    var markEnabled = function(pin, err){
        if(err){
            return log.gpio('Error, Initializing PIN', pin, 'Failed:', err.message)
        }
        enabled.push(pin);
    }

    for(var i=0; i < GPIO_MAP.length; i++){
        gpio.open(GPIO_MAP[i], 'output', markEnabled.bind(this, GPIO_MAP[i]))
    }

    var handleWriteError = function(pin, err){
        if(err){
            log.pgio('Error, Writing PIN', pin, 'Failed:' + err.message)
        }
    }

    atem.events.on('tallyBySource', function(count, sources, tally){
        for (var i = 0; i < Math.min(count, GPIO_MAP.length); i++){
            var src = sources[i + 1];
            var pin = GPIO_MAP[i];
            if(enabled.indexOf(pin) !== -1)
                gpio.write(pin, tally[i + 1] & 0x1, handleWriteError.bind(pin));
        }
    });

    process.on('exit', function(code){
        for (var i=0; i<enabled.length; i++){
            gpio.close(enabled[i]);
        }
    });
}());


var connectTally = function(){
    var connected = false;
    var net = require('net');
    var socket = new net.Socket();

    var connectSocket = function(){
        socket.connect({port: 8124, host: config.tallyPi});
    }
    var connectionInterval = setInterval(connectSocket, 1000);

    socket.on('connect', function(){
        clearInterval(connectionInterval);
        log.tally('Connected to PI');
        connected = true;
    })

    socket.on('error', function(err){
        log.tally('Error:', err);
    })

    socket.on('end', function(){
        log.tally('Disconnected');
    })

    socket.on('close', function(had_error){
        clearInterval(connectSocket);
        setInterval(connectSocket, 1000);
    })

    atem.events.on('tallyBySource', function(count, sources, tally){
        if(connected){
            socket.write(JSON.stringify({
                count: count,
                sources: sources,
                tally: tally
            }));
        }
    });
};
if(config.tallyPi)
    connectTally();

/* Connect to Atem */
atem.connect(config.atemIP);

/* LaunchControl Button Tally */
var TALLY_PROGRAM = 1;
var TALLY_PREVIEW = 2;
atem.events.on('tallyByIndex', function(count, tally){
    var messages = [];
    for (var i = 0; i<Math.min(count, 8); i++){
        var pad1col = (tally[i] & TALLY_PROGRAM) ? 'lightRed' : 'off';
        var pad2col = (tally[i] & TALLY_PREVIEW) ? 'lightGreen' : 'off';
        // console.log(i, tally[i], 'set 1', pad1col, 'set 2', pad2col)
        messages.push(LaunchControl.led('pad1', i, pad1col, 0));
        messages.push(LaunchControl.led('pad2', i, pad2col, 0));
    }
    sendMidiMessages(messages);
});

/* Map atem events to launchControl leds */
atem.events.on('transitionPreview', function(enabled){
    var color = enabled ? 'lightAmber'  : 'off'
    sendMidiMessage(LaunchControl.led('misc', 0, color, 0));
});

atem.events.on('nextTransitionChange', function(style, map){
    var color = LaunchControl.colorWheel[style];
    // console.log('fargl', style, color, LaunchControl.colorWheel);
    sendMidiMessages(LaunchControl.led('knob1', 'all', color, 0));
});

atem.events.on('transitionMixRate', function(value){
    var color = LaunchControl.colorWheel[Math.floor(value/250 * LaunchControl.colorWheel.length)]
});

/* LaunchControl MIDI Handler */
var transitionReverse = false;
input.on('message', function(deltaTime, message) {
    var msg = LaunchControl.parseMessage(message);
    if(!msg){
        return;
    }

    console.log('m:', msg);

    if(msg.type == 'on'){
        if(msg.name == 'pad1'){
            atem.setProgram(msg.track + 1);

        }else if(msg.name == 'pad2'){
            atem.setPreview(msg.track + 1)

        }else if(msg.name == 'misc' && msg.track == 0){
            atem.toggleTransitionPreview();

        }else if(msg.name == 'misc' && msg.track == 1){
            atem.auto();

        }else if(msg.name == 'misc' && msg.track == 2){
            atem.cut();
        }
    }else if(msg.type == 'change'){
        if(msg.name == 'knob3' && msg.track == 0){
            var val = Math.round(msg.value / 127 * 4)
            atem.setTransitionType(val);

        }else if(msg.name == 'knob3' && msg.track == 1){
            var val = Math.round(msg.value / 127 * 125)
            atem.setTransitionMixRate(val);

        }else if(msg.name == 'slider' && msg.track == 7){
            var val;
            if(transitionReverse){
                val = (1 - msg.value / 127) * 10000;
            }else{
                val = msg.value / 127 * 10000;
            }
            if(val == 10000){
                transitionReverse = !transitionReverse
            }
            atem.setTransitionPosition(val);
        }
    }
});
