/* 

OK fx
- Bitcrusher : Bitdepth, Samplerate
- Echo       : Send, Delay, Feedback, Pingpong
- Reverb     : Bandwidth, Damping
+ Mix (Reverb is full-on)

- All encoders are CC, REL2
- All buttons are Note, tOff
- All LED feedback is done by Mixxx, BCR2000 itself doesn't decide that.
- This JS introduces fake controls "scratch" and "scratch_enable" that work as expected,
  instead of having to do the explicit JS scratch stuff the wiki mentions.

Layout:

---- Globals   -----

  <>                  <>                  <>                  <>                  
0 Master              Cue vol             Cue / mix           Browse
A                                                             Seek preview
B  
C
D  
  []                  []                  []                  []                  
0                                                             Preview
A  
B  
C
D  

---- Each deck -----

  <>   
0     Pitch bend / output VU   
A     Rate
B     Position
C     Key
D     Move beatgrid (beats_translate) / beatgrid_active
  <> (press)  
0     Scratch
A     Reset rate
B     Cue
C     Reset key
D     Quantize on/off
  []                  []
0 FX1                 FX2
A Cue 1               Cue 2
B Load                Sync
C Jump <4             Jump >4
D Loop 4              Loop 16
  []                  []
0 FX3                 Loop act
A Cue 3               Cue 4
B Play                PFL
C Jump <16            Jump >16
D Jump <1             Jump >1
  <>                  <>
0 Volume              High
A Gain
B 
C
D Move loop           Size loop (/2, *2) 
  <>                  <>
0 Filter              Mid
A  
B  
C
D  
  <>                  <>
0                     Low
A  
B  
C
D  

- Consider A -> B to activate another shift level for cues 5..8
  and for sync master
- Blink VU meter (FAST), or all 4 buttons, or ... when nearing end of track
*/


function withDefaults(settings, defaults) {
    if (settings === undefined) settings = {};
    var result = {};
    for (key in defaults) {
        result[key] = (settings[key] !== undefined) ? settings[key] : defaults[key];
    }
    return result;
}

function getCfg(key) {
    var keyInfo = {
      rate: { minimum: -1, maximum: 1, step: 0.001 },
      jog: { minimum: -3, maximum: 3, step: 0.1, accellerationLimit: 30, accelleration: 1.1 },
      playposition: { step: 0.00003, accellerationLimit: 500 },
      beats_translate: { step: 1, accelleration: 2, up: "beats_translate_later", down: "beats_translate_earlier"},
      pitch: { minimum: -6, maximum: 6, step: 0.01, accelleration: 1.1 },
      scratch: { step: 1, accelleration: 2, accellerationLimit: 4 },
      super1: { accelleration: 1.1 },
      pregain: { maximum: 4 },
      parameter1: { maximum: 4 },
      parameter2: { maximum: 4 },
      parameter3: { maximum: 4 },
      loop_move: { minimum: -1, accelleration: 1.1 },
      loop_factor2: { step: 1, accelleration: 0, up: "loop_double", down: "loop_halve" }
    };
    
    return withDefaults(keyInfo[key], {
        step: 0.01,
        accelleration: 1.2,
        accellerationLimit: 10,
        minimum: 0,
        maximum: 1,
        up: undefined,
        down: undefined
    });
}

function eqForChannel(group) {
    return "[EqualizerRack1_" + group + "_Effect1]";
}

function filterForChannel(group) {
    return "[QuickEffectRack1_" + group + "]";
}

// This wraps the handling code for a BCR2000 encoder set to "Rel2" mode
// @param key Mixxx control key to bind to, required
// @param groupFn Transformation to apply to group string
function encoder(key, groupFn) {
    if (groupFn === undefined) groupFn = function(s) { return s; };

    var cfg = getCfg(key);
    var accel = 1.0;
    var lastMsg = 0;
    
    return function (channel, control, value, status, group) {
        if ((new Date().getTime()) - lastMsg < 100) {
            accel = accel * cfg.accelleration;
            if (accel > cfg.accellerationLimit) {
                accel = cfg.accellerationLimit;
            }
        } else {
            accel = 1.0;
        }
        
        lastMsg = new Date().getTime();
        var delta = (value > 64) ? cfg.step : -cfg.step;
        if (key == "scratch") { // scratch must be done through JS...for some reason
          var deck = group[8] - '1' + 1;
          script.midiDebug(0, 0, value, 0, "scratch: " + delta * accel);
          engine.scratchTick(deck, delta * accel);
        } else if (delta > 0 && cfg.up !== undefined) {
          group = groupFn(group);
          for (var i = 0; i < accel; i++) {
            engine.setValue(group, cfg.up, true);
            engine.setValue(group, cfg.up, false);                    
          }
        } else if (delta < 0 && cfg.down !== undefined) {
          group = groupFn(group);
          for (var i = 0; i < accel; i++) {
            engine.setValue(group, cfg.down, true);
            engine.setValue(group, cfg.down, false);
          }
        } else {
          group = groupFn(group);
          var v = engine.getValue(group, key) + delta * accel;
          if (v < cfg.minimum) v = cfg.minimum;
          if (v > cfg.maximum) v = cfg.maximum;
          script.midiDebug(0, 0, v, 0, "writing to " + group + ":" + key + "=" + v + " accel=" + accel);
          engine.setValue(group, key, v);
        }
        
        if (key == "loop_move") { // must be reset after each apply...
          engine.setValue(group, key, 0);
        }
    };
}

function buttonHold(key) {
    if (key == "scratch_enable") { // scratch has to be done through JS...for some reason
        return function (channel, control, value, status, group) {
            var deck = group[8] - '1' + 1;
            if (value > 0) {
              var alpha = 0.01;
              var beta = alpha/16;
              engine.setValue(group, "slip_enabled", true);
              engine.scratchEnable(deck, 64, 33+1/3, alpha, beta);
            } else {
              engine.scratchDisable(deck);        
              engine.setValue(group, "slip_enabled", false);
            }
        }
    } else {
        return function (channel, control, value, status, group) {
            engine.setValue(group, key, value > 0);
        };
    }
}

function buttonToggle(key) {
    return function (channel, control, value, status, group) {
         if (value > 0) {         
             engine.setValue(group, key, !engine.getValue(group, key));
         }
    };
}

function buttonSet(key, valueOnPress) {
    return function (channel, control, value, status, group) {
         if (value > 0) {
             engine.setValue(group, key, valueOnPress);         
         }
    };
}

// Implements generic "shift" behaviour. A Shifter maintains an integer value,
// which can be affected by button presses or knob turns. 
//
// @param levels Must be an array of strings, indicating the levels the shifter cycles 
// through. For a simple shift function, you can omit the array, which defaults to ["off", "on"].
//
// This closely models the generic shifting framework present in another 
// well-known German DJ package, which the author has used a lot.
function Shifter(levels) {
    if (levels === undefined) levels = [ "off", "on" ];

    var currentValue = levels[0];
    var connected = {};
    var pressed = []; // currently pressed values, which we'll return to when one is released.
    var keys = {};
    
    function switchTo(v) {
      script.midiDebug(0, 0, v, 0, "switching to " + v);
      currentValue = v;
      for (group in connected) {
        for (key in connected[group]) {
          if (connected[group][key][v] !== undefined) {
            engine.trigger(group, key);
          }
        }
      }
    }
    
    // TODO write increment, decrement functions to bind to buttons to inc/dec the shifter value.
    
    // Should be bound to a button that emits the given value when held down,
    // returning to levels[0] when released.
    // In other words, holding the button sets the shifter to [targetValue] temporarily.
    this.holdFor = function(targetValue) {
        return function (channel, control, value, status, group) {
            var i = pressed.indexOf(targetValue);
            if (i != -1) {
                pressed.splice(i, 1);
            }
            script.midiDebug(channel, control, value, status, "pressed=" + pressed + " i=" + i); 
            if (value > 0) {
                pressed.push(targetValue);
                switchTo(targetValue);
            } else {
                if (pressed.length > 0) {
                    switchTo(pressed[pressed.length - 1]);
                } else {
                    switchTo(levels[0]);
                }                
            }
        };  
    };
    
    // Shortcut for holdFor("on"), for a default Shifter with [ "off", "on" ]
    this.hold = function() { return this.holdFor("on"); }
    
    // Serves as a router that invok=es nested functions, depending on the current
    // value of the shift button.
    
    this.map = function(routes) {
        return function(channel, control, value, status, group) {
            var target = routes[currentValue];
            if (target !== undefined) {
                target.apply(null, arguments);

                // If releasing a button that has an output, re-trigger its value.
                var key = keys["" + currentValue + control + status];
                if (key !== undefined) {
                    engine.trigger(group, key);
                }
            }
        };
    };
    
    function createCallback(group, key) {
      var cfg = getCfg(key);
      engine.connectControl(group, key, function(value) {              
        var target = connected[group][key][currentValue];
        //script.midiDebug(0, 0, value, 0, "hit " + group + ":" + key + ", current=" + currentValue + " target=" + target + " p=" + connected[group][key]);
        
        if (target === undefined) return;
        midi.sendShortMsg(target.status, target.control, (value - cfg.minimum) / (cfg.maximum - cfg.minimum) * 127);
      });      
    }
    
    function connect(midi, routes) {
        for (targetValue in routes) {
            var group = routes[targetValue].group;
            var key = routes[targetValue].key;
            script.midiDebug(0, 0, targetValue, 0, "handling " + group + ":" + key);
            if (connected[group] === undefined) {
              connected[group] = {};
            }
            if (connected[group][key] === undefined) {
              connected[group][key] = {};
              script.midiDebug(0, 0, targetValue, 0, "binding " + group + ":" + key);
              createCallback(group, key);
            } else {
              script.midiDebug(0, 0, targetValue, 0, "already bound " + group + ":" + key);
            }
            connected[group][key][targetValue] = midi;
            keys["" + targetValue + midi.control + midi.status] = key;
            script.midiDebug(0, 0, targetValue, 0, "done " + group + ":" + key + " for " + targetValue);        
        }
    
    }
    
    this.connectCC = function(cc, routes) {
        connect({status: 0xB0, control: cc}, routes);
    }
    
    this.connectNote = function(note, routes) {
        connect({status: 0x90, control: note}, routes);
    }    
}


// Exposes reading an existing mixxx control in the same DSL as if it were a Shifter variable
function Control(key) {
    function getValue(group) {
        if (key == "scratch_enable") {
          var deck = group[8] - '1' + 1;
          return engine.isScratching(deck) ? "on" : "off";
        } else {
          return engine.getValue(group, key);
        }
    }

    // Serves as a router that invokes nested functions, depending on the current
    // value of the control for the group it's invoked on. That value
    // has to exist in [routes].
    this.map = function(routes) {
        return function(channel, control, value, status, group) {
            var v = getValue(group);
            var target = routes[v];
            if (target !== undefined) {
                target.apply(null, arguments);
            }
        };
    };
}

var BCR2000 = (function () {
    var shift1 = new Shifter(["o","a","b","c","d"]);
    var scratch_enable = new Control("scratch_enable");

    function pushEncoder1Out(group) {
        return {
            o: { group: group, key:"VuMeter"},
            a: { group: group, key:"rate"},
            b: { group: group, key:"playposition"},
            c: { group: group, key:"pitch"}
        };
    }
    
    function button1Out(group) {
        return {
            a: { group: group, key:"hotcue_1_enabled" }
        };
    }

    function button2Out(group) {
        return {
            a: { group: group, key:"hotcue_2_enabled" },
            b: { group: group, key:"beatsync" }        
        };
    }

    function button3Out(group) {
        return {
            a: { group: group, key:"hotcue_3_enabled" },        
            b: { group: group, key:"play_indicator" }                
        };
    }

    function button4Out(group) {
        return {
            o: { group: group, key:"loop_enabled" },                            
            a: { group: group, key:"hotcue_4_enabled" },        
            b: { group: group, key:"pfl" }                            
        };
    }

    function encoder1Out(group) {
        return {
            o: { group: group, key:"volume" },
            a: { group: group, key:"pregain" }
        };
    }

    function encoder2Out(group) {
        return {
            o: { group: eqForChannel(group), key:"parameter3" }
        };
    }

    function encoder3Out(group) {
        return {
            o: { group: filterForChannel(group), key:"super1" }
        };
    }

    function encoder4Out(group) {
        return {
            o: { group: eqForChannel(group), key:"parameter2" }
        };
    }

    function encoder6Out(group) {
        return {
            o: { group: eqForChannel(group), key:"parameter1" }
        };
    }

    return {
        init: function (id, debugging) {
          shift1.connectCC(0x27, pushEncoder1Out("[Channel1]"));
          shift1.connectCC(0x29, pushEncoder1Out("[Channel2]"));
          shift1.connectCC(0x2B, pushEncoder1Out("[Channel3]"));
          shift1.connectCC(0x2D, pushEncoder1Out("[Channel4]"));
          
          shift1.connectNote(0x00, button1Out("[Channel1]"));
          shift1.connectNote(0x01, button2Out("[Channel1]"));
          shift1.connectNote(0x02, button1Out("[Channel2]"));
          shift1.connectNote(0x03, button2Out("[Channel2]"));
          shift1.connectNote(0x04, button1Out("[Channel3]"));
          shift1.connectNote(0x05, button2Out("[Channel3]"));
          shift1.connectNote(0x06, button1Out("[Channel4]"));
          shift1.connectNote(0x07, button2Out("[Channel4]"));
          shift1.connectNote(0x08, button3Out("[Channel1]"));
          shift1.connectNote(0x09, button4Out("[Channel1]"));
          shift1.connectNote(0x0A, button3Out("[Channel2]"));
          shift1.connectNote(0x0B, button4Out("[Channel2]"));
          shift1.connectNote(0x0C, button3Out("[Channel3]"));
          shift1.connectNote(0x0D, button4Out("[Channel3]"));
          shift1.connectNote(0x0E, button3Out("[Channel4]"));
          shift1.connectNote(0x0F, button4Out("[Channel4]"));
          
          shift1.connectCC(0x00, encoder1Out("[Channel1]"));
          shift1.connectCC(0x02, encoder1Out("[Channel2]"));
          shift1.connectCC(0x04, encoder1Out("[Channel3]"));
          shift1.connectCC(0x06, encoder1Out("[Channel4]"));
          shift1.connectCC(0x01, encoder2Out("[Channel1]"));
          shift1.connectCC(0x03, encoder2Out("[Channel2]"));
          shift1.connectCC(0x05, encoder2Out("[Channel3]"));
          shift1.connectCC(0x07, encoder2Out("[Channel4]"));
          shift1.connectCC(0x08, encoder3Out("[Channel1]"));
          shift1.connectCC(0x0A, encoder3Out("[Channel2]"));
          shift1.connectCC(0x0C, encoder3Out("[Channel3]"));
          shift1.connectCC(0x0E, encoder3Out("[Channel4]"));
          shift1.connectCC(0x09, encoder4Out("[Channel1]"));
          shift1.connectCC(0x0B, encoder4Out("[Channel2]"));
          shift1.connectCC(0x0D, encoder4Out("[Channel3]"));
          shift1.connectCC(0x0F, encoder4Out("[Channel4]"));
          
          shift1.connectCC(0x11, encoder6Out("[Channel1]"));
          shift1.connectCC(0x13, encoder6Out("[Channel2]"));
          shift1.connectCC(0x15, encoder6Out("[Channel3]"));
          shift1.connectCC(0x17, encoder6Out("[Channel4]"));
        },
        shutdown: function() {},
        
        shiftA: shift1.holdFor("a"),
        shiftB: shift1.holdFor("b"),
        shiftC: shift1.holdFor("c"),
        shiftD: shift1.holdFor("d"),
        
        pushEncoder1: shift1.map({
            o: scratch_enable.map({
                off: encoder("jog"),
                 on: encoder("scratch")
            }),
            a: encoder("rate"),
            b: encoder("playposition"),
            c: encoder("pitch"),
            d: encoder("beats_translate")
        }),
        pushEncoder1Btn: shift1.map({
            o: buttonHold("scratch_enable"), 
            a: buttonSet("rate", 0.0),
            b: buttonHold("cue_default"),
            c: buttonSet("pitch", 0.0),
            d: buttonToggle("quantize")
        }),
        
        button1: shift1.map({
            //o: buttonToggle("fx1:enabled")
            a: buttonHold("hotcue_1_activate"),
            b: buttonToggle("LoadSelectedTrack"),
            c: buttonHold("beatjump_4_backward"),
            d: buttonHold("beatloop_4_activate")
        }),
        button2: shift1.map({
            //o: buttonToggle("fx2:enabled")
            a: buttonHold("hotcue_2_activate"),
            b: buttonToggle("beatsync"),
            c: buttonHold("beatjump_4_forward"),
            d: buttonHold("beatloop_16_activate")
        }),
        button3: shift1.map({
            //o: buttonToggle("fx3:enabled")
            a: buttonHold("hotcue_3_activate"),
            b: buttonToggle("play"),
            c: buttonHold("beatjump_16_backward"),
            d: buttonHold("beatjump_1_backward")
        }),
        button4: shift1.map({
            o: buttonHold("reloop_exit"), // TODO create new loop if not inside loop points
            a: buttonHold("hotcue_4_activate"),
            b: buttonToggle("pfl"),
            c: buttonHold("beatjump_16_forward"),
            d: buttonHold("beatjump_1_forward")
        }),
        
        encoder1: shift1.map({
            o: encoder("volume"),
            a: encoder("pregain"),
            d: encoder("loop_move")
        }),
        encoder2: shift1.map({
            o: encoder("parameter3", eqForChannel), // high
            d: encoder("loop_factor2")
        }),
        encoder3: shift1.map({
            o: encoder("super1", filterForChannel)
        }),
        encoder4: shift1.map({
            o: encoder("parameter2", eqForChannel) // mid
        }),
        encoder5: shift1.map({
        }),
        encoder6: shift1.map({
            o: encoder("parameter1", eqForChannel) // low
        })
        
    };
})();


