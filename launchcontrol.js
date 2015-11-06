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

var colors = exports.color = {
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

exports.colorWheel = [colors.lightRed, colors.lightGreen, colors.lightAmber, colors.red, colors.green, colors.amber];

exports.parseMessage = function(message){
    var d1 = message[1];
    var d2 = message[2];
    var messageType = message[0] & 0xf0;
    var value = Math.max(0, Math.min(d2, 127));
    var channel = Math.max(0, Math.min(message[0] & 0x0f, 15));
    var track;

    // note on
    if (messageType === 0x90 && value !== 0) {
        for(var i=0; i<buttons.length; i++){
            var button = buttons[i];
            if(button.start <= d1 && d1 < button.start + button.count){
                track = d1 - button.start;
                return { type: "on", name: button.name, track: track, value: value, channel: channel };
            }
        }

    // note off
    }else if(messageType == 0x80 && value == 0){
        for(var i=0; i<buttons.length; i++){
            var button = buttons[i];
            if(button.start <= d1 && d1 < button.start + button.count){
                track = d1 - button.start;
                return { type: "off", name: button.name, track: track, value: value, channel: channel };
            }
        }

    // control change
    }else if(messageType == 0xb0){
        for(var i=0; i<variables.length; i++){
            var variable = variables[i];
            if(variable.start <= d1 && d1 < variable.start + variable.count){
                track = d1 - variable.start;
                return { type: "change", name: variable.name, track: track, value: value, channel: channel };
            }
        }
    }
    console.log("notfound", messageType.toString(16), channel, d1.toString(16), value);
    return null;
};

var TRACK_SELECTOR = {
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

exports.led = function(name, track, color, channel){
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
      color = exports.color[color];
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

    var d1 = pad[(track|0) % 8];
    return [st, d1, d2];
};
