# AtemControl
Glue Program with different Interfaces to interact with BMD Atem Switchers.

### Controllers
#### Keyboard
Simple Keyboard Switcher Interface to test interaction with the atem Library.

##### Controls
- '0'-'9' set Preview
- 'c' cut
- 'a' auto Transition

#### MIDI
Midi Switcher Interface for Novation LaunchControl XL

#### Kayak
Control Atem Switcher with Kayak-DD Panel. At the moment we still need the real Kayak Switcher to talk to the Panel and just mirror its comands.

##### Network Setup
- Connect Switcher, Panel and PC to Managed Switch
- place Switcher and Panel in seperate VLAN
- add VLAN Interface for ID 600 with MAC and IP of Switcher to PC
- Mirror Traffic from Panel Port to PC Port

#### GPIO-Tally
Outputs Atem Tally on GPIO-Ports of the Raspberry PI

The node atemLib is currently too slow on the RPI to answer the ATEM-Protocol init in time. The patched version in this repo does slightly better
##### Notes
- https://github.com/quick2wire/quick2wire-gpio-admin.git
- with patch https://github.com/rexington/quick2wire-gpio-admin/commit/e1974dd197573a0a846a9fbe35d9f3ff1cbb3884
- make sure to always close gpios

#### TCP-Tally
TCP Tally Server. Workaround for the slow atemLib by using a thin tcp client on the RPI and executing

## TODOs
- add Controller config
- pull patched atemLib into seperate repository again
- Improve Kayak Interface to also allow sending state to the panel
- speed up atemLib even more to run reliably on RPI
