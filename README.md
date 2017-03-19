# AtemControl
Glue Program with different Interfaces to interact with BMD Atem Switchers.

Uses code from:
  - https://github.com/Dev1an/Atem
    - Atem Library for Node.js
  - https://github.com/mohayonao/launch-control
    - Novation Launchcontrol API for Node.js

### Interfaces
#### Keyboard
Simple Keyboard Switcher Interface to test interaction with the atem Library.

##### Controls
- '0'-'9' set Preview
- 'c' cut
- 'a' auto Transition

#### MIDI
Midi Switcher Interface for the Novation LaunchControl XL

#### Kayak
Control Atem Switcher with a Kayak-DD Panel. At the moment we still need the real
Kayak Switcher to talk to the Panel and just mirror its commands.

##### Network Setup
- Connect Switcher, Panel and PC to Managed Switch
- place Switcher and Panel in a separate VLAN
- add VLAN Network-Interface for VLAN-ID 600 with MAC and IP of Switcher to PC
- Mirror Traffic from Panel Port to PC Port

#### Raspberry GPIO-Tally
As the Raspberry Pi 1 can't currently handle the Initialization Packets of the
Atem and still answer in time, it can just used with a small TCP-Client (see
 tallyServer) to output Tally to the GPIO-Ports.

There have been efforts to speed-up the Atem-Library
on the Pi, mainly caching the initialization Packets for later Parsing after the
initial ACK. However, despite this it still only works occasionally.

##### Notes
- https://github.com/quick2wire/quick2wire-gpio-admin.git
- with patch https://github.com/rexington/quick2wire-gpio-admin/commit/e1974dd197573a0a846a9fbe35d9f3ff1cbb3884
- make sure to always close gpios

#### TCP-Tally Server
Outputs Atem Tally in JSON-Format to connected TCP-clients.

### Interface-API
Interfaces should export an object with either **on** and/or **trigger** members.

The **on**-member should interface with an EventEmitter or compatible
Event-Implementation. Emit the 'cmd' event to trigger an Atem Command.

The **trigger**-member should be a function, which can receive Atem events.

### TODOs
- Improve Kayak Interface to also allow sending state to the panel
- speed up atemLib even more to run reliably on RPI

## License
Apache-2.0

Copyright 2017 Anton Schubert
