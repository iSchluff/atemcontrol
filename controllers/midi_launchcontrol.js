/*
 * Novation Launchcontrol Midi Controller
 *
 * Features:
 */
const log = require('../libs/log')('MIDI');
const EventEmitter = require('events');
const MidiDevice = require('../libs/midi');

/* ATEM command helper */
const events = new EventEmitter();
const cmd = events.emit.bind(events, 'cmd');

const buttons = [{
    name: "pad1",
    type: "button",
    start: 0x0,
    count: 8
},
{
    name: "pad2",
    type: "button",
    start: 0xc,
    count: 8
},
{
    name: "misc",
    type: "button",
    start: 0x6a,
    count: 3
}]

const variables = [{
    name: "knob1",
    start: 0x14,
    count: 8
},
{
    name: "knob2",
    start: 0x1e,
    count: 8
},
{
    name: "knob3",
    start: 0x28,
    count: 8
},
{
    name: "slider",
    start: 0x32,
    count: 8
}];

const colors = {
    off: 0,
    darkRed: 1,
    red: 2,
    lightRed: 3,
    darkGreen: 4,
    darkAmber: 5,
    green: 8,
    amber: 10,
    lightGreen: 12,
    lightAmber: 15
};

const colorWheel = [colors.lightRed, colors.lightGreen, colors.lightAmber, colors.red, colors.green, colors.amber];

const device = new MidiDevice('Launch Control XL', {buttons, variables});

/* LaunchControl MIDI Handler */
let transitionReverse = false;
device.on('message', function (delta, msg) {
    // console.log('m:', msg);

    if (msg.type == 'on') {
        if (msg.name == 'pad1') {
            cmd('setProgram', msg.track + 1);

        } else if (msg.name == 'pad2') {
            cmd('setPreview', msg.track + 1);

        } else if (msg.name == 'misc' && msg.track == 0) {
            cmd('toggleTransitionPreview');

        } else if (msg.name == 'misc' && msg.track == 1) {
            cmd('auto');

        } else if (msg.name == 'misc' && msg.track == 2) {
            cmd('cut');
        }
    } else if (msg.type == 'change') {
        if(msg.name == 'knob3' && msg.track == 0){
            var val = Math.round(msg.value / 127 * 4)
            cmd('setTransitionType', val);

        } else if (msg.name == 'knob3' && msg.track == 1) {
            var val = Math.round(msg.value / 127 * 125)
            cmd('setTransitionMixRate', val);

        } else if (msg.name == 'slider' && msg.track == 7) {
            var val;
            if(transitionReverse){
                val = (1 - msg.value / 127) * 10000;
            }else{
                val = msg.value / 127 * 10000;
            }
            if(val == 10000){
                transitionReverse = !transitionReverse
            }
            cmd('setTransitionPosition', val/10000 * 0.999);
        }
    }
});

device.connect();

const TRACK_SELECTOR = {
    all: function(){
      return true
    },
    even: function(_, i){
      return i % 2 === 0;
    },
    odd: function(_, i){
      return i % 2 === 1;
    }
};

const led = function(name, track, color, channel){
    var control;
    var type = 0x90;
    for(var i=0; i<buttons.length; i++){
        if(buttons[i].name == name){
            control = buttons[i];
        }
    }

    if(!control){
        type = 0xb0;
        for(var i=0; i<variables.length; i++){
            if(variables[i].name == name){
                control = variables[i];
            }
        }
    }

    if(!control){
        console.error("led control not found");
        return null;
    }
    //console.log("led control", control);

    var pad = []
    for(var i=0; i<control.count; i++){
        pad.push(control.start + i);
    }

    if (typeof color === "string") {
      color = colors[color];
    }
    color = (color|0) % 16;

    var st = type + ((channel|0) % 16);
    var d2 = ((color & 0x0c) << 2) + 0x0c + (color & 0x03);

    if (TRACK_SELECTOR.hasOwnProperty(track)) {
        return pad.filter(TRACK_SELECTOR[track]).map(function(d1){
            return [st, d1, d2]
        });
    }

    if (/^[-o]+$/.test(track)) {
      var data = [];

      for (var i = 0; i < 8; i++) {
        if (track[i % track.length] === "o") {
          data.push([st, pad[i], d2]);
        }
      }

      return data;
    }

    const d1 = pad[(track|0) % 8];
    return [st, d1, d2];
};


/* LaunchControl Button Tally */
const TALLY_PROGRAM = 1;
const TALLY_PREVIEW = 2;
const atemHandlers = {
    singleTally: function(index, tally) {
        if (index > 7)
            return;

        const pad1col = (tally & TALLY_PROGRAM) ? 'lightRed' : 'off';
        const pad2col = (tally & TALLY_PREVIEW) ? 'lightGreen' : 'off';

        device.send(led('pad1', index, pad1col, 0), led('pad2', index, pad2col, 0));
    },

    tallyByIndex: function (count, tally) {
        const messages = [];
        for (let i = 0; i<Math.min(count, 8); i++){
            const pad1col = (tally[i] & TALLY_PROGRAM) ? 'lightRed' : 'off';
            const pad2col = (tally[i] & TALLY_PREVIEW) ? 'lightGreen' : 'off';
            // console.log(i, tally[i], 'set 1', pad1col, 'set 2', pad2col)
            messages.push(led('pad1', i, pad1col, 0));
            messages.push(led('pad2', i, pad2col, 0));
        }
        device.send(...messages);
    },

    /* Map atem events to launchControl leds */
    transitionPreview: function (enabled) {
        const color = enabled ? 'lightAmber' : 'off'
        sendMidiMessage(led('misc', 0, color, 0));
    },

    nextTransitionChange: function (style, map) {
        const color = LaunchControl.colorWheel[style];
        device.send(...led('knob1', 'all', color, 0));
    },

    transitionMixRate: function (value) {
        const color = LaunchControl.colorWheel[Math.floor(value/250 * LaunchControl.colorWheel.length)]
    }
}

module.exports = {
  on: events.on.bind(events),
  trigger: function(name, ...rest) {
    if (atemHandlers[name])
      atemHandlers[name].apply(null, rest);
  }
}