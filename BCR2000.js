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
      playposition: { step: 0.001, minimum: 0, maximum: 1, accellerationLimit: 50 }
    };
    
    return withDefaults(keyInfo[key], {
        step: 0.01,
        accelleration: 1.2,
        accellerationLimit: 10,
        minimum: -1,
        maximum: 1
    });
}

// This wraps the handling code for a BCR2000 encoder set to "Rel2" mode
// @param key Mixxx control key to bind to, required
// @param cfg Optional additional settings. See below.
function Encoder(key) {
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
        var v = engine.getValue(group, key) + delta * accel;
        script.midiDebug(channel, control, value, status, group + " v=" + v + " m=" + cfg.minimum);
        if (v < cfg.minimum) v = cfg.minimum;
        if (v > cfg.maximum) v = cfg.maximum;
        engine.setValue(group, key, v);
        return ;
    };
}

// Implements generic "shift" behaviour. A Shifter maintains an integer value,
// which can be affected by button presses or knob turns. In the simplest case,
// the Shifter will be "1" while a button is held down, and "0" otherwise.
//
// This closely models the generic shifting framework present in another 
// well-known German DJ package, which the author has used a lot.
function Shifter(cfg) {
    cfg = withDefaults(cfg, {
        count: 1
    });
    
    var currentValue = 0;
    var connected = {};
    
    function switchTo(v) {
      currentValue = v;
      for (group in connected[v]) {
        for (key in connected[v][group]) {
          engine.trigger(group, key);
        }
      }
    }
    
    // TODO write increment, decrement functions to bind to buttons to inc/dec the shifter value.
    
    // Should be bound to a button that emits >0 when held down, and 0 when released,
    // to make that button set the shifter to [targetValue] temporarily.
    // On the BCR2000, this should be "tOff" button mode.
    this.holdFor = function(targetValue) {
        var previousValue = undefined;
    
        return function (channel, control, value, status, group) {
            if (value > 0) {
                previousValue = currentValue;
                switchTo(targetValue);
            } else {
                if (previousValue !== undefined) {
                    switchTo(previousValue);
                }
                previousValue = undefined;
            }
        };  
    };
    
    // Shortcut for holdFor(1), for a default Shifter with count == 1
    this.hold = function() { return this.holdFor(1); }
    
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
    
    this.connectCC = function(cc, routes) {
      for (targetValue in routes) {
        var group = routes[targetValue].group;
        var key = routes[targetValue].key;
        var cfg = getCfg(key);
        if (connected[targetValue] === undefined) {
          connected[targetValue] = {};
        }
        if (connected[targetValue][group] === undefined) {
          connected[targetValue][group] = {};
        }
        if (connected[targetValue][group][key] === undefined) {
          connected[targetValue][group][key] = {};
        }
        engine.connectControl(group, key, function(value) {
          if (currentValue === targetValue) {
            midi.sendShortMsg(0xB0, cc, (value - cfg.minimum) / (cfg.maximum - cfg.minimum) * 127);
          }
        });
      }
    }
}

var BCR2000 = (function () {
    var shift1 = Shifter();
    shift1.connectCC(0x00, {
      0: { group: "[Channel1]", key:"rate"},
      1: { group: "[Channel1]", key:"playposition"}
    });

    return {
        init: function (id, debugging) {},
        shutdown: function() {},
        rate: shift1.map({
            0: Encoder("rate"),
            1: Encoder("playposition")
        }),
        shift1btn: shift1.hold()
    };
})();


