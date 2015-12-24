var Atem = require('./atemLib');
var mixer = new Atem();
var EventEmitter = require('events');
var events = new EventEmitter();
var state = {
    multiViewSources: [],
};

/* Event helper */
var emitUpdate = events.emit.bind(events, 'update');

mixer.on('Warn', function(data){
    console.log("Warning, your ATEM doesn't feel well: " + data.toString());
})

mixer.on('connectionStateChange', function(state){
    events.emit('state', state);
    // console.log('Atem State:', state.description);
});

// Tally by Index
mixer.on('TlIn', function(data){
    var count = data.readUInt16BE(0);
    emitUpdate('tallyByIndex', count, data.slice(2))
});

// Tally by Source
mixer.on('TlSr', function(data){
    var count = data.readUInt16BE(0),
        sources= [],
        tally = [];
    for(var i=0; i<count; i++){
        sources.push(data.readUInt16BE(i*3 + 2));
        tally.push(data[i*3 + 4]);
    }
    emitUpdate('tallyBySource', count, sources, tally)
});

// Transition Preview
mixer.on('TrPr', function(data){
    state.transitionPreview = data[1];
    emitUpdate('transitionPreview', data[1]);
})

// Transition
mixer.on('TrSS', function(data){
    emitUpdate('nextTransitionChange', data[1], data[2]);
});

// Transition Mix
mixer.on('TMxP', function(data){
    emitUpdate('transitionMixRate', data[1]);
});

// Input Properties
mixer.on('InPr', function(data){
    // console.log("INPUT properties", data.readUInt16BE(0), data.slice(22, 26).toString(),
    // data[29], data[30], data[32])
})

// Multi Viewer Input
mixer.on('MvIn', function(data){
    if(data[0] == 0 && data[1] > 1){
        state.multiViewSources[data[1] - 2] = data.readUInt16BE(2);
    }
});

exports.auto = function(){
    const data = new Buffer(4);
	data.fill(0);
	mixer.sendCommand(new Atem.Command('DAut', data));
}

/* set transition position in percent from 0 to 1 */
var transitionReverse;
exports.setTransitionPosition = function(pos){
    const data = new Buffer(4);
    var val;
    if(transitionReverse){
        val = (1 - pos) * 10000;
    }else{
        val = pos * 10000;
    }

    if(val == 10000){
        transitionReverse = !transitionReverse
    }

    data.fill(0);
    data.writeUInt16BE(val, 2);
    mixer.sendCommand(new Atem.Command('CTPs', data));
}

exports.setTransitionType = function(value){
    console.log("set transition type", value);
    const data = new Buffer(4);
	data.fill(0);
    data[0] = 1;
    data[2] = value;
	mixer.sendCommand(new Atem.Command('CTTp', data));
}

exports.toggleTransitionPreview = function(){
    const data = new Buffer(4);
    data.fill(0);
    data[1] = state.transitionPreview ? 0 : 1;
    mixer.sendCommand(new Atem.Command('CTPr', data));
}

exports.setTransitionMixRate = function(val){
    const data = new Buffer(4);
    data.fill(0);
    data[1] = val;
    mixer.sendCommand(new Atem.Command('CTMx', data));
}

exports.setProgram = mixer.setProgram;
exports.setPreview = mixer.setPreview;
exports.cut = mixer.cut;
exports.on = events.on.bind(events);
exports.connect = function(ip){
    mixer.ip = ip;
    mixer.connect();
}
