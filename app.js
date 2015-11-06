var midi = require('midi');
var atem = require('./atem.js');
var LaunchControl = require('./launchcontrol.js');
var input = new midi.input();
var output = new midi.output();

/******* Config *******/
var config = {
    midiIn: 1,
    midiOut: 1,
    atemIP: '10.0.2.9'
}

/*********************/

/* List Available MIDI Ports */
var portcount = input.getPortCount();
console.log('MIDI Ports - In:', input.getPortCount(), 'Out:', output.getPortCount());
for(var i=0; i<input.getPortCount(); i++){
    console.log('\tIN: \tPort', i, input.getPortName(i));
}
for(var i=0; i<output.getPortCount(); i++){
    console.log('\tOUT: \tPort', i, input.getPortName(i));
}
console.log();

/* Raspberry GPIO Tally */
(function(){
    // maps camera tally to raspberry gpio (electrical numbering)
    var GPIO_MAP = [11, 13, 15, 16, 18, 7, 12, 22, 29, 31];
    var enabled = [];
    var gpio;

    try{
        gpio = require('pi-gpio');
    }catch(err){
        console.log("PI-GPIO failed: This is Probably not a PI\n");
        return;
    }
    console.log("PI-GPIO enabled: This seems to be a PI\n");

    var markEnabled = function(pin, err){
        if(err){
            return console.error("Error - Initializing PIN", pin, "failed:", err.message)
        }
        enabled.push(pin);
    }

    for(var i=0; i < GPIO_MAP.length; i++){
        gpi.open(GPIO_MAP[i], "output", markEnabled.bind(this, GPIO_MAP[i]))
    }

    var handleWriteError = function(pin, err){
        if(err){
            console.error('Writing PIN', pin, 'Failed! - ' + err.message)
        }
    }

    atem.events.on('tallyBySource', function(count, sources, tally){
        console.log("------------", tally)
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

/* Connect to Atem, Setup MIDI */
atem.connect(config.atemIP);
input.openPort(config.midiIn);
output.openPort(config.midiOut);

// Order: (Sysex, Timing, Active Sensing)
input.ignoreTypes(false, false, false)

var sendMessages = function(messages){
    for(var i=0; i<messages.length; i++){
        output.sendMessage(messages[i]);
    }
}

/* LaunchControl Button Tally */
var TALLY_PROGRAM = 1;
var TALLY_PREVIEW = 2;
atem.events.on('tallyByIndex', function(count, tally){
    var messages = [];
    for (var i = 0; i<Math.min(count, 8); i++){
        var pad1col = (tally[i] & TALLY_PREVIEW) ? 'lightGreen' : 'off';
        var pad2col = (tally[i] & TALLY_PROGRAM) ? 'lightRed' : 'off';
        // console.log(i, tally[i], 'set 1', pad1col, 'set 2', pad2col)
        messages.push(LaunchControl.led('pad1', i, pad1col, 0));
        messages.push(LaunchControl.led('pad2', i, pad2col, 0));
    }
    sendMessages(messages);
});

/* Map atem events to launchControl leds */
atem.events.on('transitionPreview', function(enabled){
    var color = enabled ? "lightAmber"  : 'off'
    output.sendMessage(LaunchControl.led('misc', 0, color, 0));
});

atem.events.on('nextTransitionChange', function(style, map){
    var color = LaunchControl.colorWheel[style];
    console.log("fargl", style, color, LaunchControl.colorWheel);
    sendMessages(LaunchControl.led('knob1', 'all', color, 0));
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
            atem.setPreview(msg.track + 1);

        }else if(msg.name == 'pad2'){
            atem.setProgram(msg.track + 1)

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

process.on('exit', function(code){
    input.closePort();
    output.closePort();
});
