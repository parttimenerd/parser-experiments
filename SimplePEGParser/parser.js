 /* Simple JavaScript Inheritance
  * By John Resig http://ejohn.org/
  * MIT Licensed.
  */
  // Inspired by base2 and Prototype
  (function(){
      var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
     
      // The base Class implementation (does nothing)
      this.Class = function(){};
     
      // Create a new Class that inherits from this class
      Class.extend = function(prop) {
        var _super = this.prototype;
       
        // Instantiate a base class (but only create the instance,
        // don't run the init constructor)
        initializing = true;
        var prototype = new this();
        initializing = false;
       
        // Copy the properties over onto the new prototype
        for (var name in prop) {
          // Check if we're overwriting an existing function
          prototype[name] = typeof prop[name] == "function" &&
            typeof _super[name] == "function" && fnTest.test(prop[name]) ?
            (function(name, fn){
              return function() {
                var tmp = this._super;
               
                // Add a new ._super() method that is the same method
                // but on the super-class
                this._super = _super[name];
               
                // The method only need to be bound temporarily, so we
                // remove it when we're done executing
                var ret = fn.apply(this, arguments);        
                this._super = tmp;
               
                return ret;
              };
            })(name, prop[name]) :
            prop[name];
        }
       
        // The dummy class constructor
        function Class() {
          // All construction is actually done in the init method
          if ( !initializing && this.init )
            this.init.apply(this, arguments);
        }
       
        // Populate our constructed prototype object
        Class.prototype = prototype;
       
        // Enforce the constructor to be what we expect
        Class.prototype.constructor = Class;
     
        // And make this class extendable
        Class.extend = arguments.callee;
       
        return Class;
      };
    })();

function Parser(){
  
  this.p = function(obj){
    if (arguments.length === 1){
      return Rule.ruleByObj(obj);
    } else {
      return Rule.ruleByObj(Array.prototype.slice.call(arguments));
    }
  };
  
  this.combine = this.p;
  
  this.fork = function(){
    var rule = new ForkRule(Array.prototype.slice.call(arguments));
    return rule;
  };
  
  this.range = function(obj, min, max){
    var rule = new RangeRule(Rule.ruleByObj(obj), min, max);
    return rule;
  };
  
  this.any = function(obj){
    return this.range(obj, 0, -1);
  }
  
  this.some = function(obj){
    return this.range(obj, 1, -1);
  }
  
  this.wo = function(obj){
    var rule = new WithoutRule(Rule.ruleByObj(obj));
    return rule;
  }
  
  this.start = new Rule("");
  
  this.parse = function(str){
    var input = new Input(str);
    var result = this.start.match(input);
    if (!input.finished()){
        //throw "failed to parser the whole string";
    }
    return result;
  };
}

Rule = Class.extend({
  on_function: null,
  as_str: null,
  data: null,
  match: function(input){
      throw "Not yet implemented";
  }
});

Rule.ruleByObj = function(obj){
    var rule = null;
    if (obj instanceof Rule){
      return obj;
    } else if (typeof obj === "string" || typeof obj === "number"){
      rule = new StringRule();
      rule.init(obj);
      return rule;
    } else if (obj instanceof RegExp){
      rule = new RegExpRule();
      rule.init(obj);
      return rule;
    } else if (obj instanceof Array){
      if (obj.length === 1){
        return Rule.ruleByObj(obj[0]);
      } else {
        rule = new CombineRule(obj.map(function(rule) {
            return Rule.ruleByObj(rule); 
        }));
        return rule;
      }
    }
  throw "can't create rule out of '" + obj.toSource() + "'";
};

SimpleRule = Rule.extend({
    init: function(rule){
      if (rule instanceof Array){
        this.data = Rule.ruleByObj(rule);
      } else {
        this.data = rule;
      }
  },
    match: function(input){
        var result = new Result();        
          var res = this._match(input);
          if (res.match){
            result.add(res.got);
          } else {
            throw new ParseException(res.got, res.expected, input);
          }
        return result;
    },
  _match: function(input){
  return {got: "", expected: "", match: false};
  }
});

RegExpRule = SimpleRule.extend({
  _match: function(input){
        var curRule = this.data;
          var got = "";
          var match = true;
            got = input.get();
            match = curRule.exec(got) !== null;
            if (match){
              do {
                got += input.get();
                match = curRule.exec(got) !== null;
              } while(match);
              input.rewind(input.index() - 1);
              got = got.substring(0, got.length - 1);
              match = true;
            }
    return {got: got, expected: curRule + "", match: match};
  }
});
  
StringRule = SimpleRule.extend({
  _match: function(input){
    var curRule = this.data + "";
        var    got = input.getString(curRule.length);
        var    match = curRule == got;
      return {got: got, expected: curRule, match: match};
  }
});

WithoutRule = Rule.extend({
    init: function(obj){
        this.data = Rule.ruleByObj(obj);
    },
  match: function(input){
    var startIndex = input.index();
    var length = 0;
    var result = new Result();
    var matchOnce = true;
    var match = true;
    var indexBefore = input.index();
    while ((!match || matchOnce == true) && !input.finished()){
    try {
      indexBefore = input.index();
      result = this.data.match(input);
      input.rewind(indexBefore);
    } catch (e){
      if (e instanceof ParseException){
        if (match === true && matchOnce == true){
          matchOnce = false;
        }
        match = false;
        input.rewind(indexBefore + 1);
        length += 1;
      } else {
        throw e;
      }
     }
    }
    if (!matchOnce){
        result = new Result();
        result.add(input.getString(startIndex, length));
        return result;
    } else {
        throw new ParseException(result.toString(), "<not '" + result.toString() + "'>", input);
    }
  }
});

RangeRule = Rule.extend({
    min: 0,
    max: -1,
    init: function(rules, min, max){
        this.data = Rule.ruleByObj(rules);
        this.min = min !== undefined ? min : 0;
        this.max = max !== undefined ? max : -1;
    },
    match: function(input){
        var result = new Result();
        for (var i = 0; i < this.min; i++){
            try {
            var res = this.data.match(input);
            } catch (e){
                console.info("failed in iteration " + (i + 1) + " of " + this.min);
                throw e;
            }
            result.add(res);
        }
        var lastIndex = input.index();
        var lastMatched = false;
        if (this.max == -1){
            while (true){
                try {
                    lastIndex = input.index();
                    var res = this.data.match(input);
                    //console.error(res.toSource());
                    result.add(res);
                    lastMatched = true;
                } catch (e){
                    break;
                }
            }
        } else {
            for (var i = this.min; i < this.max && !input.finished(); i++){
                try {
                    lastIndex = input.index();
                    result.add(this.data.match(input));
                    lastMatched = true;
                } catch (e){
                    break;
                }
            }
        }
        //console.error(input.index(), lastIndex, result.toSource());
        if (!lastMatched){
            input.rewind(lastIndex);
        }
        return result;
    }
});

ExRule = Rule.extend({
  init: function(rule){
      if (rule instanceof Array){
        this.data = rule.map(function(obj){ return Rule.ruleByObj(obj); });
      } else {
        throw "this rule has to have an array of subrules instead of '" + (typeof rule) + "'";
      }
  }
});

CombineRule = ExRule.extend({
  match: function(input){
     var result = new Result();
     for (var i = 0; i < this.data.length; i++){
       result.add(this.data[i].match(input));
     }
     return result;
  } 
});

ForkRule = ExRule.extend({
    match: function(input){
     var indexBefore = input.index();
     var lastException = null;
     for (var i = 0; i < this.data.length; i++){
       try {
         result = this.data[i].match(input);
         return result;
       } catch (e){
         if (e instanceof ParseException){
            console.info("fork error: " + e.toString() + " - rewind");
            lastException = e;
            input.rewind(indexBefore);
         } else {
            throw e;
         }
       }
     }
     if (lastException === null){
       return new Result();
     } else {
       throw lastException;
     }
  }
});
  
function Result(){
  this.matchedStrs = []; 
  
  this.add = function(match){
    if (match instanceof Result){ 
        this.matchedStrs = this.matchedStrs.concat(match.matchedStrs);
    } else {
      this.matchedStrs.push(match);
    }
  };
  
  this.toString = function(){
    return this.matchedStrs + "";
  };
}


function Input(string){
  this.chars = string.split("");
  var index = 0;
  this.line = 0;
  this.column = 0;
  
  this.get = function(){
    if (arguments.length == 1){
      var i = arguments[0];
      if (this.chars.length > i && i > 0){
        return this.chars[i];
      } else { 
        return "";
      }
    } else {
      if (index + 1 < this.chars.length){
      index++;
      this.updateLineColumnNumber();
      return this.chars[index - 1];
      } else {
      return "";
      }
    }
  };
  
  this.getString = function(start, length){
     var str = "";
     if (arguments.length == 1){
        var s = start;
        start = index;
        length = s;
     }
     for (var i = start; i < index + length && i < this.chars.length; i++){
       str += this.chars[i];
     }
     if (arguments.length == 1){
        index += length;
        this.updateLineColumnNumber();
     }
     return str;
  };
  
  this.rewind = function(_index){
    index = _index;
    this.updateLineColumnNumber();
  };
  
  this.finished = function(){
    return this.chars.length <= index;
  };
  
  this.index = function(){
     return index;
  };

  this.updateLineColumnNumber = function(){
    var currentLine = 0;
    var lastLineBreakIndex = 0;
    var len = this.chars.length;
    for (var i = 0; i < index; i++){
      var char = this.chars[i];
      if (char == "\n" && i != len - 1){
        currentLine++;
        lastLineBreakIndex = i;
      }
    }
    this.line = currentLine;
    this.column = len - lastLineBreakIndex;
  };
}

function ParseException(got, expected, input){
  this.got = got;
  this.expected = expected;
  this.line = input.line;
  this.column = input.column;
  this.char = input.index();
  this.input = input;
  
  this.toString = function(){
    var str = "got '" + this.got + "' but expected '" + this.expected + "' in line " + this.line + ", column " + this.column;
    return str + " near " + this.nearStr();
  };
  
  this.nearStr = function(){
    var str = "'";
    var radius = 5;
    for (var i = this.char - radius; i < this.char; i++){
        str += input.get(i);
    }
    str += "'<X>'";
    for (var i = this.char; i < this.char + radius; i++){
        str += input.get(i);
    }
    return str + "'";
  }
}

//Usage
parser = new Parser();

with(parser){
    start = any(wo("abc"));
}
console.log(parser.parse("abcdc") + "");
