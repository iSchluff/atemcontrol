#!/usr/bin/env node
const _ = require('underscore');
const fs = require('fs');
const log = console.log.bind(console, 'Control -');

let fileConfig = {};
let envConfig = {};

// Parse configs
if (process.argv.length > 2) {
    fileConfig = JSON.parse(fs.readFileSync(process.argv[2]));
}

try {
    envConfig = JSON.parse(process.env.config)
} catch(foo) {
    console.log("Running with default config")
}

const config = _.extend({
    switcherOptions: {},
    controllers: ['keyboard'],
}, fileConfig, envConfig);

if (!config.host || !config.switcher) {
    console.log(`Switcher host or model unset\nUsage: ${process.argv0} <config.json>`)
    process.exit(1);
}

const Switcher = require('./switchers/' + config.switcher);
const switcher = new Switcher(config.host, config.switcherOptions);

const controllers = config.controllers.map(function(controller) {
    return require('./controllers/' + controller);
});

/* Trigger a response to all controllers */
const trigger = function () {
    for (let i = 0; i < controllers.length; i++) {
        if (controllers[i].trigger)
            controllers[i].trigger.apply(null, arguments);
    }
}

/* Atem Comand Handler */
const commandHandler = function(name) {
    if (switcher[name]) {
        var rest = Array.prototype.slice.call(arguments, 1)
        log('command', name, 'parameters', rest);
        switcher[name](rest);
    } else {
        log('Error: unknown command', name, 'parameters', rest);
    }
}

const sendParent = function(message) {
    if (process.connected)
        process.send(message);
}

/* Listen to controllers */
for (var i = 0; i < controllers.length; i++) {
    if (controllers[i].on)
        controllers[i].on('cmd', commandHandler)
}

switcher.on('update', function () {
    trigger.apply(null, arguments);
    sendParent({
        type: 'update',
        data: arguments
    })
});

switcher.on('state', function (state) {
    log('state:', state.toString(), '-', state.description);
    sendParent({
        type: 'state',
        data: {
            state: state.toString()
        }
    });
})


/* Setup Child Interface */
if (process.connected) {
    log('Child Interface enabled!');

    process.on('message', function (message) {
        log('received message', message);
        if (message.type == 'command'){
            commandHandler.apply(null, message.data);
        }
    });

    process.send({
        type: 'init'
    });
}

/* Connect to Switcher */
switcher.connect(config.host);

/* Exit handling */
function exitHandler(options, err) {
    switcher.disconnect();

    if (err)
        console.log(err.stack);

    if (options.exit)
        process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));


process.stdin.resume(); //so the program will not close instantly