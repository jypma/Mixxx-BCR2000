/*

TODO:
  - Stopping an FX resets it, can't reenable again

New buttons:
  - Switch BitCrusher to metronome:  [EqualizerRack1_[ChannelI]]chain_selector switch EQ to metronome?
  - OR change to a preset with Metronome instead of Echo:   [EffectRack1_EffectUnitN]chain_selector  , OR  [EqualizerRack1_[ChannelI]]chain_selector
  - OR move Echo down 1 effect: [EffectRack1_EffectUnitN_EffectM]effect_selector

  - Cue points 5 and 6
  - Move over Beat jump 1 (perhaps)
  - Move Quantize there (no good under the push encoder for gridding, that' setup)

*/

function withDefaults(settings, defaults) {
    if (settings === undefined) settings = {};
    var result = {};
    for (key in defaults) {
        result[key] = (settings[key] !== undefined) ? settings[key] : defaults[key];
    }
    return result;
}

function getCfg(key, group) {
  var keyInfo = {
    rate: { minimum: -1, maximum: 1, step: 0.001 },
    jog: { minimum: -3, maximum: 3, step: 0.1, accellerationLimit: 30, accelleration: 1.5 },
    playposition: { step: 0.00003, accellerationLimit: 500, accelleration: 1.4 },
    beats_translate: { step: 0.2, accelleration: 1, up: "beats_translate_later", down: "beats_translate_earlier"},
    pitch: { minimum: -6, maximum: 6, step: 0.01, accelleration: 1.1 },
    scratch: { step: 1, accelleration: 2, accellerationLimit: 4 },
    super1: { accelleration: 1.1, stopAtMiddle: true },
    pregain: { maximum: 4 },
    loop_move: { minimum: -1, accelleration: 1.1, reset: true },
    loop_factor2: { step: 1, accelleration: 0, up: "loop_double", down: "loop_halve" },
    headVolume: { maximum: 5 },
    headMix: { minimum: -1, maximum: 1, step: 0.03 },
    SelectTrackKnob: { minimum: -25, maximum: 25, step: 1, accelleration: 1.3, accellerationLimit: 16, reset: true },
  };

  var groupInfo = {
    "[EqualizerRack1_X_Effect1]": { stopAtMiddle: true }
  };
    
  return withDefaults(groupInfo[group], withDefaults(keyInfo[key], {
    stopAtMiddle: false,
    step: 0.01,
    accelleration: 1.2,
    accellerationLimit: 10,
    minimum: 0,
    maximum: 1,
    up: undefined,
    down: undefined,
    reset: false
  }));
}

function resolveGroupFn(groupFn) {
    return (typeof groupFn === "function") ? groupFn :
            (typeof groupFn === "string") ? function(s) { return groupFn; } :
             function(s) { return s; };
}

// This wraps the handling code for a BCR2000 encoder set to "Rel2" mode
// @param key Mixxx control key to bind to, required
// @param groupFn Transformation to apply to group string
function encoder(key, groupFn) {
    groupFn = resolveGroupFn(groupFn);

    var cfg = getCfg(key, groupFn("X"));
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
        group = groupFn(group);
        if (key == "scratch") { // scratch must be done through JS...for some reason
          var deck = group[8] - '1' + 1;
          script.midiDebug(0, 0, value, 0, "scratch: " + delta * accel);
          engine.scratchTick(deck, delta * accel);
        } else if (delta > 0 && cfg.up !== undefined) {
          for (var i = 0; i < accel; i++) {
            engine.setValue(group, cfg.up, true);
            engine.setValue(group, cfg.up, false);                    
          }
        } else if (delta < 0 && cfg.down !== undefined) {
          for (var i = 0; i < accel; i++) {
            engine.setValue(group, cfg.down, true);
            engine.setValue(group, cfg.down, false);
          }
        } else if (cfg.minimum != 0 || cfg.maximum != 1) {
          var v = engine.getValue(group, key) + delta * accel;
          if (v < cfg.minimum) v = cfg.minimum;
          if (v > cfg.maximum) v = cfg.maximum;
          script.midiDebug(0, 0, v, 0, "writing value to " + group + ":" + key + "=" + v + " accel=" + accel);
          engine.setValue(group, key, v);
        } else {
          var vOld = engine.getParameter(group, key);
          var v = vOld + delta * accel;
          if (cfg.stopAtMiddle) {
            print("m")
            if (vOld < 0.5 && v > 0.5) {
              print("<")
              v = 0.5;
              accel = 0;
            } else if (vOld > 0.5 && v < 0.5) {
              print(">")
              v = 0.5;
              accel = 0;
            }
          }
          if (v < 0) v = 0;
          if (v > 1) v = 1;
          script.midiDebug(0, 0, v, 0, "writing param to " + group + ":" + key + "=" + v + " accel=" + accel);
          engine.setParameter(group, key, v);
        }
        
        if (cfg.reset) { // must be reset after each apply...
          engine.setParameter(group, key, 0);
        }
    };
}

function buttonHold(key, groupFn) {
    groupFn = resolveGroupFn(groupFn);
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
            engine.setValue(groupFn(group), key, value > 0);
        };
    }
}

function buttonReset(values, groupFn) {
  groupFn = resolveGroupFn(groupFn);
  return function (channel, control, value, status, group) {
    group = groupFn(group);
    if (value > 0) {
      print("TODO");
    } else {
      for (key in values) {
        print("Reset " + group + " / " + key + " to " + values[key]);
        engine.setParameter(group, key, values[key]);
      }
    }
  };
}

function buttonToggle(key, groupFn) {
    groupFn = resolveGroupFn(groupFn);
    return function (channel, control, value, status, group) {
        var g = groupFn(group); 
        if (value > 0) {         
            var v = engine.getValue(g, key);
            script.midiDebug(channel, control, value, status, "v=" + v + " g=" + g); 
            engine.setValue(g, key, !engine.getValue(g, key));
        }
        script.midiDebug(channel, control, value, status, "exiting"); 
    };
}

function buttonSet(key, valueOnPress, groupFn) {
    groupFn = resolveGroupFn(groupFn);
    return function (channel, control, value, status, group) {
        group = groupFn(group); 
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

  function connectControl(group, key, targetValue, callback) {
    if (connected[group] === undefined) {
      connected[group] = {};
    }
    if (connected[group][key] === undefined) {
      connected[group][key] = {};
      engine.connectControl(group, key, function(value) {
        var callbacks = connected[group][key][currentValue];
        //print(group + " / " + key + " calling " + callbacks);
        if (callbacks != undefined) {
          for (i in callbacks) {
            callbacks[i].apply(null, arguments);
          }
        }
      });
    }
    if (connected[group][key][targetValue] === undefined) {
      connected[group][key][targetValue] = [ callback ];
    } else {
      connected[group][key][targetValue].push(callback);
    }
  }

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
        if (key != undefined) {
          for (i in key) {
            print("retrigger")
            engine.trigger(key[i].group, key[i].key);
          }
        }
      }
    };
  };

  var sumAll = function() {
    return Array.prototype.reduce.call(arguments, function(a, b) {
        return a + b;
    }, 0);
  };

  function onControlChange(mididata, route) {
    return function() {
      print("onControlChange")
      var values = [];
      for (i in route.multi) {
        var group = route.multi[i].group;
        var key = route.multi[i].key;
        var v = engine.getParameter(group, key);
        print("  " + group + " / " + key + " = " + v);
        values.push(v);
      }

      var value = route.compose.apply(null, values);
      if (value > 1.0) {
        value = 1.0;
      } else if (value < 0) {
        value = 0.0;
      }
      midi.sendShortMsg(mididata.status, mididata.control, value * 127);
    };
  }

  function connect(mididata, routes) {
    for (targetValue in routes) {
      var route = routes[targetValue];
      if (!route.multi) {
        route.multi = [{group: route.group, key: route.key}];
      }
      if (!route.compose) {
        route.compose = sumAll;
      }

      var callback = onControlChange(mididata, route);

      for (i in route.multi) {
        var control = route.multi[i];

        // add to keys so we can reset pushbutton LEDs when they're released
        var k = keys["" + targetValue + mididata.control + mididata.status];
        if (k === undefined) {
          k = [];
          keys["" + targetValue + mididata.control + mididata.status] = k;
        }
        k.push(control);

        connectControl(control.group, control.key, targetValue, callback);
      }
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
  // We use this as mapping for button LEDs in shift states that don't have output,
  // so the button is always OFF there (since we don't use mute)
  function alwaysOff(group) { return { group: group, key:"mute" } };

    function eqForChannel(group) { return "[EqualizerRack1_" + group + "_Effect1]"; }
    function filterForChannel(group) { return "[QuickEffectRack1_" + group + "]"; }
    function fxChainForChannel(group) { 
        var deck = group[8] - '1' + 1;
        return "[EffectRack1_EffectUnit" + deck + "]";
    }
    
    function channelFx(fxNum) {
        return function(group) {
            var deck = group[8] - '1' + 1;
            return "[EffectRack1_EffectUnit" + deck + "_Effect" + fxNum + "]";            
        };
    }

    function selectFX(group, num) {
        engine.setValue(group, "clear", true);
        engine.setValue(group, "clear", false);
        for (var i = 0; i < num; i++){ 
            engine.setValue(group, "next_effect", true);
            engine.setValue(group, "next_effect", false);
        }
    }

    var shift1 = new Shifter(["o","a","b","c","d"]);
    var scratch_enable = new Control("scratch_enable");

    function pushEncoder1Out(group) {
        return {
            o: { group: group, key:"VuMeter"},
            a: { group: group, key:"rate"},
            b: { group: group, key:"playposition"},
            c: { group: group, key:"pitch"},
            d: { group: group, key:"beat_distance"}
        };
    }
    
  function button1Out(group) {
    return {
      o: { multi: [
        { group: channelFx(1)(group), key: "parameter1" },
        { group: channelFx(1)(group), key: "parameter2" }
      ], compose: function(a,b) {
        return (a < 1) || (b < 1) ? 1.0 : 0.0;
      } },
      a: { group: group, key:"hotcue_1_enabled" },
      b: alwaysOff(group),
      c: alwaysOff(group),
      d: alwaysOff(group)
    };
  }

  function button2Out(group) {
    return {
      o: { group: channelFx(2)(group), key: "parameter4", compose: function(v) {
        return (v > 0) ? 1.0 : 0.0;
      } },
      a: { group: group, key:"hotcue_2_enabled" },
      b: { group: group, key:"beatsync" },
      c: alwaysOff(group),
      d: alwaysOff(group)
    };
  }

  function button3Out(group) {
    return {
      o: { group: channelFx(3)(group), key: "parameter4", compose: function(v) {
        return (v > 0) ? 1.0 : 0.0;
      } },
      a: { group: group, key:"hotcue_3_enabled" },
      b: { group: group, key:"play_indicator" },
      c: alwaysOff(group),
      d: alwaysOff(group)
    };
  }

    function button4Out(group) {
        return {
          o: { group: group, key:"loop_enabled" },
          a: { group: group, key:"hotcue_4_enabled" },
          b: { group: group, key:"pfl" },
          c: alwaysOff(group),
          d: alwaysOff(group)
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
            o: { group: eqForChannel(group), key:"parameter3" }, // TODO map these into two ranges
            a: { group: channelFx(1)(group), key:"parameter1" },
            b: { group: channelFx(2)(group), key:"parameter4" },
            c: { group: channelFx(3)(group), key:"parameter4" }
        };
    }

    function encoder3Out(group) {
        return {
            o: { group: filterForChannel(group), key:"super1" }
        };
    }

    function encoder4Out(group) {
        return {
            o: { group: eqForChannel(group), key:"parameter2" },
            a: { group: channelFx(1)(group), key:"parameter2" },
            b: { group: channelFx(2)(group), key:"parameter1" },
            c: { group: channelFx(3)(group), key:"parameter1" }
        };
    }

    function encoder5Out(group) {
        return {
            o: { group: fxChainForChannel(group), key:"mix" },
            a: { group: fxChainForChannel(group), key:"mix" },
            b: { group: fxChainForChannel(group), key:"mix" },
            c: { group: fxChainForChannel(group), key:"mix" },
            d: { group: fxChainForChannel(group), key:"mix" }
        };
    }

    function encoder6Out(group) {
        return {
            o: { group: eqForChannel(group), key:"parameter1" },
            b: { group: channelFx(2)(group), key:"parameter2" }
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
          shift1.connectCC(0x10, encoder5Out("[Channel1]"));
          shift1.connectCC(0x12, encoder5Out("[Channel2]"));
          shift1.connectCC(0x14, encoder5Out("[Channel3]"));
          shift1.connectCC(0x16, encoder5Out("[Channel4]"));          
          shift1.connectCC(0x11, encoder6Out("[Channel1]"));
          shift1.connectCC(0x13, encoder6Out("[Channel2]"));
          shift1.connectCC(0x15, encoder6Out("[Channel3]"));
          shift1.connectCC(0x17, encoder6Out("[Channel4]"));
          
          shift1.connectCC(0x28, {
              o: { group: "[Master]", key: "volume" }
          });
          shift1.connectCC(0x2A, {
              o: { group: "[Master]", key: "headVolume" }
          });
          shift1.connectCC(0x2C, {
              o: { group: "[Master]", key: "headMix" }
          });
          shift1.connectCC(0x2E, {
              o: { group: "[PreviewDeck1]", key: "VuMeter" },
              a: { group: "[PreviewDeck1]", key: "playposition" }
          });
          
          // Set up one effect chain for each deck, with fixed BC->Echo->Reverb
          for (var i = 1; i <= 4; i++) {
              engine.setValue("[EffectRack1_EffectUnit" + i + "]", "group_[Channel" + i + "]_enable", true);
              engine.setValue("[EffectRack1_EffectUnit" + i + "_Effect1]", "enabled", true);
              engine.setValue("[EffectRack1_EffectUnit" + i + "_Effect2]", "enabled", true);
              engine.setValue("[EffectRack1_EffectUnit" + i + "_Effect3]", "enabled", true);
              selectFX("[EffectRack1_EffectUnit" + i + "_Effect1]", 5);
              selectFX("[EffectRack1_EffectUnit" + i + "_Effect2]", 8);
              selectFX("[EffectRack1_EffectUnit" + i + "_Effect3]", 18);
          }
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
        o: buttonReset({ "parameter1": 1.0, "parameter2": 1.0 }, channelFx(1)),
        a: buttonHold("hotcue_1_activate"),
        b: buttonHold("LoadSelectedTrack"),
        c: buttonHold("beatjump_4_backward"),
        d: buttonHold("beatloop_4_activate")
      }),
      button2: shift1.map({
        o: buttonReset({ "parameter4": 0.0 }, channelFx(2)),
        a: buttonHold("hotcue_2_activate"),
        b: buttonToggle("beatsync"),
        c: buttonHold("beatjump_4_forward"),
        d: buttonHold("beatloop_16_activate")
      }),
      button3: shift1.map({
        o: buttonReset({ "parameter4": 0.0 }, channelFx(3)),
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
          a: encoder("parameter1", channelFx(1)), // bc depth
          b: encoder("parameter4", channelFx(2)), // echo send
          c: encoder("parameter4", channelFx(3))   // reverb send
        }),
        encoder3: shift1.map({
            o: encoder("super1", filterForChannel),
            d: encoder("loop_factor2")
        }),
        encoder4: shift1.map({
          o: encoder("parameter2", eqForChannel), // mid
          a: encoder("parameter2", channelFx(1)), // bc sample rate
          b: encoder("parameter1", channelFx(2)), // echo time/delay
          c: encoder("parameter1", channelFx(3))  // reverb decay
        }),
        encoder5: encoder("mix", fxChainForChannel),
        encoder6: shift1.map({
            o: encoder("parameter1", eqForChannel), // low
            b: encoder("parameter2", channelFx(2))  // echo feedback
        }),
        
        globalPushEncoder1: shift1.map({
            o: encoder("volume", "[Master]")
        }),
        globalPushEncoder2: shift1.map({
            o: encoder("headVolume", "[Master]")        
        }),
        globalPushEncoder3: shift1.map({
            o: encoder("headMix", "[Master]")                
        }),
        globalPushEncoder3Btn: shift1.map({
            o: buttonHold("stop", "[PreviewDeck1]")
        }),
        globalPushEncoder4: shift1.map({
            o: encoder("SelectTrackKnob", "[Playlist]"),
            b: encoder("playposition", "[PreviewDeck1]")
        }),
        globalPushEncoder4Btn: shift1.map({
            o: buttonToggle("LoadSelectedTrackAndPlay", "[PreviewDeck1]") // TODO stop if playing same
        })
        
    };
})();


