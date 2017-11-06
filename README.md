# AtemControl
Glue Program to control video switchers with different interfaces

### Current Switcher Implementations: ###
 - Blackmagic Atem
 - Panasonic HS6000 (with ExtIP Plugin)

### Interfaces
#### Keyboard Interface
Simple Keyboard Switcher Interface to test interaction with the atem Library.

**Controls:**
 - '0'-'9' set Preview/Program
 - 'c' cut
 - 'a' auto Transition
 - 'd' to switch between Preview/Program mixing mode

#### MIDI Interface
Generic Midi Device class with hardware-specific handlers

**Currently supports:**
  - Novation LaunchControl XL
  - Akai LPD8

#### Kayak Interface
Control Atem Switcher with a Kayak-DD Panel. At the moment we still need the real
Kayak Switcher to talk to the Panel and just mirror its commands.

**Network Setup:**
- Connect Switcher, Panel and PC to Managed Switch
- place Switcher and Panel in a separate VLAN
- add VLAN Network-Interface for VLAN-ID 600 with MAC and IP of Switcher to PC
- Mirror Traffic from Panel Port to PC Port

#### TallyServer Interface
TCP Tallyserver for sending Tally to GPIO-enabled Hardware, for example Raspberry Pis

### Interface-API
Interfaces should export an object with either **on** and/or **trigger** members.

The **on**-member should interface with an EventEmitter or compatible
Event-Implementation. Emit the 'cmd' event to trigger a Switcher command.

The **trigger**-member should be a function, which can receive Atem events.

### TODOs
- Improve Kayak Interface to also allow sending state to the panel

## License
Apache-2.0

Copyright 2017 Anton Schubert
