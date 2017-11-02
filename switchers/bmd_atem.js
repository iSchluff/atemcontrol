const Atem = require('atem');

class AtemSwitcher extends Switcher {
    constructor(host, options) {
        super(host, options);
        this.state = {
            multiViewSources: [],
            transitionReverse: 0,
            transitionPreview: 0
        }

        this.mixer = new Atem();

        this.mixer.on('Warn', (data) => {
            console.log("Warning, your ATEM doesn't feel well: " + data.toString());
        })

        this.mixer.on('connectionStateChange', (state) => {
            this.emit('state', state);
            // console.log('Atem State:', state.description);
        });

        // Tally by Index
        this.mixer.on('TlIn', (data) => {
            const count = data.readUInt16BE(0);
            this.emitUpdate('tallyByIndex', count, data.slice(2))
        });

        // Tally by Source
        this.mixer.on('TlSr', (data) => {
            const count = data.readUInt16BE(0),
                sources= [],
                tally = [];
            for (let i = 0; i < count; i++) {
                sources.push(data.readUInt16BE(i*3 + 2));
                tally.push(data[i*3 + 4]);
            }
            this.emitUpdate('tallyBySource', count, sources, tally)
        });

        // Transition Preview
        this.mixer.on('TrPr', (data) => {
            this.state.transitionPreview = data[1];
            this.emitUpdate('transitionPreview', data[1]);
        })

        // Transition
        this.mixer.on('TrSS', (data) => {
            this.emitUpdate('nextTransitionChange', data[1], data[2]);
        });

        // Transition Mix
        this.mixer.on('TMxP', (data) => {
            this.emitUpdate('transitionMixRate', data[1]);
        });

        // Input Properties
        this.mixer.on('InPr', (data) => {
            // console.log("INPUT properties", data.readUInt16BE(0), data.slice(22, 26).toString(),
            // data[29], data[30], data[32])
        })

        // Multi Viewer Input
        this.mixer.on('MvIn', (data) => {
            if (data[0] == 0 && data[1] > 1) {
                this.state.multiViewSources[data[1] - 2] = data.readUInt16BE(2);
            }
        });
    }

    connect() {
        this.mixer.ip = this.host;
        this.mixer.connect();
    }

    disconnect() {
        this.api.disconnect();
    }

    setProgram() {
        this.mixer.setProgram();
    }

    setPreview() {
        this.mixer.setPreview();
    }

    cut() {
        this.mixer.cut();
    }

    auto() {
        const data = new Buffer(4);
        data.fill(0);
        this.mixer.sendCommand(new Atem.Command('DAut', data));
    }

    // Set transition position in percent from 0 to 1
    setTransitionPosition(pos) {
        const data = new Buffer(4);
        var val;
        if (this.state.transitionReverse) {
            val = (1 - pos) * 10000;
        } else {
            val = pos * 10000;
        }

        if (val == 10000) {
            this.state.transitionReverse = !this.state.transitionReverse;
        }

        data.fill(0);
        data.writeUInt16BE(val, 2);
        this.mixer.sendCommand(new Atem.Command('CTPs', data));
    }

    // Set transition type (0-9)
    setTransitionType(value) {
        console.log("set transition type", value);
        const data = new Buffer(4);
        data.fill(0);
        data[0] = 1;
        data[2] = value;
        this.mixer.sendCommand(new Atem.Command('CTTp', data));
    }

    toggleTransitionPreview() {
        const data = new Buffer(4);
        data.fill(0);
        data[1] = this.state.transitionPreview ? 0 : 1;
        this.mixer.sendCommand(new Atem.Command('CTPr', data));
    }

    setTransitionMixRate(value) {
        const data = new Buffer(4);
        data.fill(0);
        data[1] = value;
        mixer.sendCommand(new Atem.Command('CTMx', data));
    }
}

module.exports = AtemSwitcher;