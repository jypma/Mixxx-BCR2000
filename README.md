# BCR2000 Advanced Mixxx preset

This repository contains a [Mixxx](https://mixxx.org) preset for using the Behringer [BCR2000](https://www.behringer.com/product.html?modelCode=P0245) MIDI controller for DJ'ing. It contains an XML mapping and Javascript file, that combine to provide control over 4 decks and effects. A custom preset should be loaded into the BCR2000. An overlay is provided to provide a reference to all buttons.

# Setting up

## Save the preset to your BCR2000

- Connect the BCR2000 to your computer.
- Open up the BCEdit controller editor software from [behringer](https://www.behringer.com/product.html?modelCode=P0245) (or, if you're on linux, try the [patched](http://linux-sound.org/bcedit-unofficial/) version).
- Make sure BCEdit discovers your controller.
- Import the [`Mixxx.syx`](Mixxx.syx) preset from this repository as a sysex file.
- Save the preset to your BCR2000 under a number of your choice.

## Print and apply the overlay

- Print the [`bcr2000_mixxx.svg`](bcr2000_mixxx.svg) and [`bcr2000_mixxx_2.svg`](bcr2000_mixxx_2.svg) files on two pieces of paper, e.g. using [Inkscape](https://inkscape.org/). The colors have been picked so they come out somewhat legible on my color laser printer; feel free to tweak the SVG's if needed.
- Cut the overlays out a knife (also cutting the holes for the buttons and encoders)
- Apply the 3 overlay pieces to the top encoders, main encoders, and bottom-right 4-button section.

## Install the preset in Mixxx

- Place the [`BCR2000.js`](BCR2000.js) and [`BCR2000_MIDI_1.midi.xml`](BCR2000_MIDI_1.midi.xml) files into your Mixxx's `controllers` directory. Depending on your operating system, this is:

  * Linux: `/home/<username>/.mixxx/controllers`
  * macOS: `/Users/<username>/Library/ApplicationSupport/Mixxx/controllers`
  * Windows: `%LOCALAPPDATA%\Mixxx\controllers`

- Open up Mixxx preferences, and select the new mapping for the "BCR2000 MIDI 1" interface.

## Prepare the Mixxx configuration

(this is right now manual, a future version might automate this from Javascript)

The preset is created with a fixed effect configuration in mind. Set up Mixxx as follows:

- Configure 4 decks and 4 effect sections.
- Route deck 1 to effect 1, 2 to effect 2, 3 to effect 3, and 4 to effect 4.
- In each effects unit, set the first effect to *"Bitcrusher"*, the second to *"Reverb"*, and the third to *"Echo"*.
- Show the preview deck.
- Hide the samplers (we're not using them).
- Turn on key lock for each deck (subjectively, it sounds better when mixing by ear)
- Turn on quantization for each deck (if you primarily play constant-tempo songs)
- Make sure your songs are analyzed for key and BPM, and for constant-tempo songs, align the beat grid.

You're now good to go!

# Usage overview

As you can glance from the overlay, control is divided into four sections, one for each deck, with decks 1 through 4 going from left to right in blue, brown, lila and dark green. The four "black" zoned encoders at the top (*Master*, *Cue*, *Cue/Mix* and *Browse*) are not tied to a deck and are master controls.

## Shift layers

In addition, four colors are assigned to four shift layers. The shift functions are accessed from the lower-right buttons, in colors pink, light green, yellow and blue.

In white, next to or above each button and encoder, is described what the control does without using a shift button. Below each control is shown, in the color of each shift layer, what the control does in that layer. The relative position of that text matches the relative position of the shift buttons, to make things a little easier to spot.

## LED Feedback

Almost all controls have been configured to provide LED feedback. This includes shift layers as well. For example, if you hold down the yellow shift layer, the LEDs underneath the *Play* and *PFL* functions will show whether these are active (but only while holding down the yellow shift button).

## Global controls

These are accessed using the 4 black encoders outside the top-right of each deck section.

- **Master** - controls the master volume
- **Cue** - controls the headphone volume
- **Cue mix** - controls how much of *master* you hear in your headphones. Press this encoder to **Stop preview**, stopping the preview deck.
- **Browse** - browses up and down through songs in your library. Press this encoder to **Preview**, loading the selected song in the preview deck. With yellow shift, this encoder can **Seek** the preview deck.

## Upper deck controls

There's one push encoder and four buttons assigned to each deck. The description below applies to each of the 4 decks. Refer to the SVG overlay for specific positions of controls.

### Push encoder

- **Bend** temporarily adjusts the tempo down or up. This can be used to allow the song to "slide" into place next to another song (when their tempos already are close).
- Push the encoder to **Scratch**. While you hold it down, rotate to scratch backwards or forwards. You can make a backspin this way.
- Pink shift: Adjust the **Rate** down or up. If you find you have to repeatedly *Bend* to keep the song in sync, adjust the *Rate* in the same direction, lowering the tempo.
- Yellow shift: **Seek** in the deck (both while playing or stopped).
- Yellow shift: Push the encoder to **Cue** the deck at the current position.
- Green shift: Adjust the **Key** of the song up and down.
- Blue shift: Adjust the beat **Grid** of the song left or right.

### Button 1

- Its LED shows whether **Bitcrusher** is active. Press it to deactivate the effect. In order to activate or reactivate the effect, use the lower deck encoders instead.
- Pink shift: Load cue point **Cue 1** (if active), or save to the cue point if inactive. The LED will show whether the cue point is active.
- Yellow shift: Load the currently selected song into the deck (use **Browse** from the global controls to select songs).
- Green shift: Jump back 4 beats (1 bar).
- Blue shift: Set a 16-beat (1 bar) loop from the current position.

### Button 2

- Its LED shows whether **Echo** is active. Press it to deactivate the effect. In order to activate or reactivate the effect, use the lower deck encoders instead.
- Pink shift: Load cue point **Cue 2** (if active), or save to the cue point if inactive. The LED will show whether the cue point is active.
- Yellow shift: Activate **Sync** for the deck, matching its tempo to other playing decks (and aligning phase if *Quantize* is on).
- Green shift: Jump forward 4 beats (1 bar).
- Blue shift: Set a 16-beat (4 bar) loop from the current position.

### Button 3

- Its LED shows whether **Delay** is active. Press it to deactivate the effect. In order to activate or reactivate the effect, use the lower deck encoders instead.
- Pink shift: Load cue point **Cue 3** (if active), or save to the cue point if inactive. The LED will show whether the cue point is active.
- Yellow shift: Start or stop **Play** for the current deck. The LED will show whether playback is active.
- Green shift: Jump back 16 beats (4 bars).
- Blue shift: Jump back 1 beat.

### Button 4

- Its LED shows whether the **Loop** is active. Press it to de-active or reactive the current loop.
- Pink shift: Load cue point **Cue 4** (if active), or save to the cue point if inactive. The LED will show whether the cue point is active.
- Yellow shift: Route the deck through the **PFL** (pre-fade listen) headphones. The LED will show whether PFL is active.
- Green shift: Jump forward 16 beats (4 bars).
- Blue shift: Jump forward 1 beat.

## Lower deck controls

Six encoders are available to each deck in the lower section. Refer to the SVG overlay for specific positions of controls.

The *Filter* and all EQ knobs will automatically stop in the middle if quickly turned towards the middle. This allows the DJ to easily bring back the bass, or reset the filter, with one gesture.

### Encoder 1

- **Volume** controls the volume slider of the deck
- Pink shift: controls the **Gain** of the deck
- Blue shift: makes the **Loop move** along the track (useful to reposition a loop while you're inside it)

### Encoder 2

- **High** controls the high part of the EQ. Once it's adjusted left or right, a rotation in the opposite direction will automatically stop at the center.
- Pink shift: controls the **Depth** of the **Bitcrusher** effect, disabling the effect if the depth is zero.
- Yellow shift: controls the **Send** of the **Delay** effect, disabling the effect if the send is zero.
- Green shift: controls the **Send** of the **Reverb** effect, disabling the effect if the send is zero.

### Encoder 3

- **Filter** contains the cutoff of the high- or low-pass filter in the "Quick effect" slot. Once it's adjusted left or right, a rotation in the opposite direction will automatically stop at the center.
- Blue shift: controls the **Loop size**, doubling or halving the loop it as you turn the encoder.

### Encoder 4

- **Mid** controls the mid part of the EQ. Once it's adjusted left or right, a rotation in the opposite direction will automatically stop at the center.
- Pink shift: controls the **Sample rate** of the **Bitcrusher** effect.
- Yellow shift: controls the **Time** of the **Delay** effect.
- Green shift: controls the **Decay** of the **Reverb** effect.

### Encoder 5

This encoder does not have any assignments. Let us know if you have any ideas for it!

### Encoder 6

- **Low** controls the low part of the EQ. Once it's adjusted left or right, a rotation in the opposite direction will automatically stop at the center.
- Yellow shift: controls the **Feedback** of the **Delay** effect, disabling the effect if the send is zero.
