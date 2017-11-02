/*
 * Akai LPD8 Midi Controller
 *
 * Features:
 *   8-channel program mixing
 *   K1: transition type
 *   K2: transition duration
 *   K5: transition
 */
const log = require('../libs/log')('MIDI');
const EventEmitter = require('events');
const MidiDevice = require('../libs/midi');

/* ATEM command helper */
const events = new EventEmitter();
const cmd = events.emit.bind(events, 'cmd');

const variables = [{
    name: 'dial',
    start: 0x1,
    count: 8
}];

const buttons = [{
    name: 'pad',
    type: 'button',
    start: 0x24,
    count: 8
}]

const device = new MidiDevice('LPD8', {buttons, variables});

device.on('message', (delta, msg) => {
    log('m:', delta, msg);

    if (msg.type == 'on') {
        if (msg.name == 'pad') {
            cmd('setProgram', msg.track + 1);
        }
    } else if (msg.type == 'change') {
        if (msg.name == 'dial') {
            const val = Math.round(msg.value / 127 * 4)
            cmd('setTransitionType', val);
        }
    }
})

device.connect();

module.exports = {
  on: events.on.bind(events),
  trigger: function(name, ...rest) {
    if (atemHandlers[name])
      atemHandlers[name].apply(null, rest);
  }
}
