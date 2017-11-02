const _ = require('underscore');
const log = require('./log')('MIDI');
const midi = require('midi');
const EventEmitter = require('events');


class MidiDevice extends EventEmitter {
    constructor(deviceMatch, options) {
        super();
        this.deviceMatch = deviceMatch;
        this.options = _.extend({
            output: false,
            variables: [],
            buttons: [],

            // (Sysex, Timing, Active Sensing)
            ignoreMask: [false, false, false]
        }, options);

        // Setup midi ports
        this.input = new midi.input();
        this.output = new midi.output();
        this.input.on('message', this._handleMessage.bind(this));
        this.input.ignoreTypes(...this.options.ignoreMask);

        // State variables
        this.connected = false;
        this.ports = null;
        this.probeInterval = null;

        process.on('exit', (code) => {
            this.disconnect();
        });
    }

    _probePorts() {
        const ports = {};
        for (let i = 0; i < this.input.getPortCount(); i++) {
            const portname = this.input.getPortName(i);

            if (!this.listed)
                log('\tIN: \tPort', i, portname);

            if (portname.match(this.deviceMatch))
                ports.in = i;
        }

        for (let i = 0; i < this.output.getPortCount(); i++) {
            const portname = this.output.getPortName(i);

            if (!this.listed)
                log('\tOUT: \tPort', i, portname);

            if (portname.match(this.deviceMatch))
                ports.out = i;
        }

        this.listed = true;

        if (!ports.in || this.options.output && !ports.out)
            return null;

        return ports;
    }

    _handleMessage(delta, message) {
        const {buttons, variables} = this.options;

        const d1 = message[1];
        const d2 = message[2];
        const messageType = message[0] & 0xf0;
        const value = Math.max(0, Math.min(d2, 127));
        const channel = Math.max(0, Math.min(message[0] & 0x0f, 15));
        let track;

        let data = null;

        // note on
        if (messageType === 0x90 && value !== 0) {
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i];
                if (button.start <= d1 && d1 < button.start + button.count) {
                    track = d1 - button.start;
                    data = { type: "on", name: button.name, track: track, value: value, channel: channel };
                }
            }

        // note off
        } else if(messageType == 0x80 && value == 0 || value == 127) {
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i];
                if (button.start <= d1 && d1 < button.start + button.count) {
                    track = d1 - button.start;
                    data = { type: "off", name: button.name, track: track, value: value, channel: channel };
                }
            }

        // control change
        } else if(messageType == 0xb0) {
            for (let i = 0; i < variables.length; i++) {
                const variable = variables[i];
                if (variable.start <= d1 && d1 < variable.start + variable.count) {
                    track = d1 - variable.start;
                    data = { type: "change", name: variable.name, track: track, value: value, channel: channel };
                }
            }
        }

        if (data)
            this.emit("message", delta, data);
        else
            log(`unknown msg - type: 0x${messageType.toString(16)}, chan: ${channel}, id: 0x${d1.toString(16)}, val: ${value}`);
    };

    send(...messages) {
        if (!this.connected || !this.ports.out)
            return;

        messages.forEach((msg) => this.output.sendMessage(msg));
    }

    connect() {
        const ports = this._probePorts();
        if (!this.connected && ports) {
            log("Connected");
            this.connected = true
            this.input.openPort(ports.in);
            this.output.openPort(ports.out);
            this.ports = ports;

        } else if (this.connected && !ports) {
            log("Connection lost");
            this.connected = false;
            this.ports = null;
            this.input.closePort();
            this.output.closePort();
        }

        if (!this.probeInterval)
            this.probeInterval = setInterval(this.connect.bind(this), 3000);
    }

    disconnect() {
        if (this.connected) {
            this.connected = false;
            this.ports = null;
            this.input.closePort();
            this.output.closePort();
        }

        if (this.probeInterval) {
            clearInterval(this.probeInterval);
            this.probeInterval = null;
        }
    }
}

module.exports = MidiDevice;