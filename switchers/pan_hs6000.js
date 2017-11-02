const _ = require('underscore');
const Promise = require('bluebird');
const Switcher = require('./switcher');
const SwitcherApi = require('../libs/hs6000_api');

class HS6000Switcher extends Switcher {
    constructor(host, options) {
        super(host, options);
        this.options = _.extend({
            layer: 1,

            // tallyGroups
            tallyPreview: null,
            tallyProgram: 3
        }, options);

        this.api = new SwitcherApi(host, {
            receiver: true,
            port: 62000
        });

        this.offset = (this.options.layer - 1) * 12;
        this.bus = {
            program: this.offset + 1,
            preview: this.offset + 2
        }

        // Tally by Index
        this.api.on('tally', (index, ...groups) => {
            const {tallyPreview, tallyProgram} = this.options;
            let val = 0;

            if (tallyProgram && groups[tallyProgram - 1])
                val |= 1;

            if (tallyPreview && groups[tallyPreview - 1])
                val |= 2;

            this.emitUpdate('singleTally', index, val);
        });
    }

    // Connect as needed on commands
    connect() {}

    disconnect() {
        this.api.disconnect();
    }

    setProgram(source) {
        this.api.setBus(this.bus.program, 33 - source);
    }

    setPreview(source) {
        this.api.setBus(this.bus.preview, 33 - source);
    }

    cut() {
        Promise.props({
            program: this.api.getBus(this.bus.program),
            preview: this.api.getBus(this.bus.preview)
        }).then((sources) => {
            this.api.setBus(this.bus.program, sources.preview[1]);
            this.api.setBus(this.bus.preview, sources.program[1]);
        })
    }
}

module.exports = HS6000Switcher;