/* 

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
D     Move beatgrid (beats_translate) / output phase??
  <> (press)  
0     Gain
A     Reset rate
B     Scratch
C     Quantize on/off
D  
  []                  []
0 FX1                 FX2
A Cue 1               Cue 2
B Load                Sync
C Jump <1             Jump >1
D Loop *2             Loop /2
  []                  []
0 FX3                 Loop act / set 4 bars
A Cue 3               Cue 4
B Play                PFL
C Jump <4             Jump >4
D Jump <16            Jump >16            
  <>                  <>
0 High                Filter
A Move loop 
B  
C
D  
  <>                  <>
0 Mid                 Volume
A  
B  
C
D  
  <>                  <>
0 Low                 
A  
B  
C
D  

- Consider A -> B to activate another shift level for cues 5..8
  and for sync master
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
      rate: { minimum: -1, maximum: 1 },
      jog: { minimum: -3, maximum: 3, step: 0.1, accellerationLimit: 30 },
      playposition: { step: 0.0003, accellerationLimit: 50 },
      beats_translate: { step: 1, accelleration: 2, up: "beats_translate_later", down: "beats_translate_earlier"},
      pitch: { minimum: -6, maximum: 6, step: 0.01, accelleration: 1.1 }
    };
    
    return withDefaults(keyInfo[key], {
        step: 0.01,
        accelleration: 1.2,
        accellerationLimit: 10,
        minimum: 0,
        maximum: 1
    });
}

// This wraps the handling code for a BCR2000 encoder set to "Rel2" mode
// @param key Mixxx control key to bind to, required
// @param cfg Optional additional settings. See below.
function encoder(key) {
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
        if (delta > 0 && cfg.up !== undefined) {
          engine.setValue(group, cfg.up, true);
          engine.setValue(group, cfg.up, false);          
        } else if (delta < 0 && cfg.down !== undefined) {
          engine.setValue(group, cfg.down, true);
          engine.setValue(group, cfg.down, false);
        } else {
          var v = engine.getValue(group, key) + delta * accel;
          if (v < cfg.minimum) v = cfg.minimum;
          if (v > cfg.maximum) v = cfg.maximum;
          script.midiDebug(0, 0, v, 0, "writing to " + group + ":" + key + "=" + v + " accel=" + accel);
          engine.setValue(group, key, v);
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
    // On the BCR2000, this should be "tOff" button mode.
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
    
    // Serves as a router that invokes nested functions, depending on the current
    // value of the shift button.
    this.map = function(routes) {
        return function() {
            var target = routes[currentValue];
            if (target !== undefined) {
                target.apply(null, arguments);
            }
        };
    };
    
    function mkConnect(group, key) {
      var cfg = getCfg(key);
      engine.connectControl(group, key, function(value) {              
        var target = connected[group][key][currentValue];
        //script.midiDebug(0, 0, value, 0, "hit " + group + ":" + key + ", current=" + currentValue + " target=" + target + " p=" + connected[group][key]);
        
        if (target === undefined) return;
        if (target.cc !== undefined) {
          //script.midiDebug(0, 0, value, 0, "updating " + group + ":" + key);
          midi.sendShortMsg(0xB0, target.cc, (value - cfg.minimum) / (cfg.maximum - cfg.minimum) * 127);              
        }
      });      
    }
    
    this.connectCC = function(cc, routes) {
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
          mkConnect(group, key);
        } else {
          script.midiDebug(0, 0, targetValue, 0, "already bound " + group + ":" + key);
        }
        connected[group][key][targetValue] = { cc: cc };
        script.midiDebug(0, 0, targetValue, 0, "done " + group + ":" + key + " for " + targetValue);        
      }
    }
}

var BCR2000 = (function () {
    var shift1 = new Shifter(["o","a","b","c","d"]);

    function pushEncoder1Out(group) {
        return {
            o: { group: group, key:"VuMeter"},
            a: { group: group, key:"rate"},
            b: { group: group, key:"playposition"},
            c: { group: group, key:"pitch"}
        };
    }

    return {
        init: function (id, debugging) {
          shift1.connectCC(0x27, pushEncoder1Out("[Channel1]"));
        },
        shutdown: function() {},
        pushEncoder1: shift1.map({
            o: encoder("jog"),
            a: encoder("rate"),
            b: encoder("playposition"),
            c: encoder("pitch"),
            d: encoder("beats_translate")
        }),
        shiftA: shift1.holdFor("a"),
        shiftB: shift1.holdFor("b"),
        shiftC: shift1.holdFor("c"),
        shiftD: shift1.holdFor("d")
    };
})();


