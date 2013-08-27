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
  
  this.p = function(str){
    if (!(str instanceof Rule)){
      rule = new SimpleRule();
      rule.init(Array.prototype.slice.call(arguments));
      return rule;
    }
    return str;
  };
  
  this.combine = function(){
    rule = new CombineRule();
    rule.init(arguments);
    return rule;
  };
  
  this.fork = function(){
    rule = new ForkRule();
    rule.init(arguments);
    return rule;
  };
  
  this.start = new Rule("");
  
  this.parse = function(str){
    var input = new Input(str);
    return this.start.match(input);
  }
}

Rule = Class.extend({
  on_function: null,
  as_str: null,
  subRules: [],
  init: function(rules){
      if (rules instanceof Array){
        this.subRules = rules;
      } else {
        this.subRules[0] = rules;
      }
  },
  match: function(input){
      throw "Not yet implemented";
  }
});

SimpleRule = Rule.extend({
    match: function(input){
        result = new Result();
        for (i = 0; i < this.subRules.length; i++){
          var curRule = this.subRules[i];
          var got = "";
          var match = true;
          if (curRule instanceof RegExp){
            got = input.get();
            match = curRule.exec(got) !== null;
          } else {
            curRule = curRule.toString();
            got = input.getString(curRule.length);
            match = curRule == got;
          }
          if (match){
            result.add(got);
          } else {
            throw new ParseException(got, curRule, input);
          }
        }
        return result;
    }
});

ForkRule = Rule.extend({
    match: function(input){
     var indexBefore = input.index();
     var lastException = null;
     for (i = 0; i < this.subRules.length; i++){
       try {
         result = this.subRules[i].match(input);
         return result;
       } catch (e){
         console.info("fork error: " + e.toString() + " - rewind");
         lastException = e;
         input.rewind(indexBefore);
       }
     }
     if (lastException === null){
       return new Result();
     } else {
       throw lastException;
     }
  }
});

CombineRule = Rule.extend({
  match: function(input){
     var result = new Result();
     for (i = 0; i < this.subRules.length; i++){
       result.add(this.subRules[i].match(input));
     }
     return result;
  }
});
  
function Result(){
  this.matchedStrs = []; 
  
  this.add = function(match){
    if (match instanceof Result){ this.matchedStrs.push(match.matchedStr);
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
      index++;
      this.updateLineColumnNumber();
      return this.chars[index - 1];
    } else {
      if (this.chars.length > index){
        return this.chars[index];
      } else { 
        return "";
      }
    }
  };
  
  this.getString = function(length){
     var str = "";
     for (i = index; i < index + length && i < this.chars.length; i++){
       str += this.chars[i];
     }
     index += length;
     this.updateLineColumnNumber();
     return str;
  };
  
  this.rewind = function(_index){
    index = _index;
    this.updateLineColumnNumber();
  };
  
  this.end = function(){
    return this.chars.length <= index;
  };
  
  this.index = function(){
     return index;
  };

  this.updateLineColumnNumber = function(){
    var currentLine = 0;
    var lastLineBreakIndex = 0;
    var len = this.chars.length;
    for (i = 0; i < index; i++){
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
  
  this.toString = function(){
    return "Parse error: got '" + this.got + "' but expected '" + this.expected + "' in line " + this.line + ", column " + this.column;
  };
}

//Usage
parser = new Parser();
with(parser){
    start = p("str");
}
console.log(parser.parse("str") + "");
