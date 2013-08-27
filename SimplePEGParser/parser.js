
function Parser(){
  
  this.p = function(str){
    /*if (str instanceof Array){
      return str.map(function(ele){
        return p(ele);
      });
    }*/
    if (!(str instanceof Rule)){
      rule = new Rule(arguments);
      rule.match = Rule.simpleMatch;
      return rule;
    }
    return str;
  };
  
  this.combine = function(){
    rule = new Rule(arguments);
    rule.match = Rule.combineMatch;
    return rule;
  };
  
  this.any = function(){
    rule = new Rule(arguments);
    rule.match = Rule.anyMatch;
    return rule;
  };
  
  this.combine = function(){
    rule = new Rule(arguments);
    rule.match = Rule.forkMatch;
    return rule;
  };
  
}

function Rule(_args){
  var on_function;
  var as_str;
  this.subRules = null;
  if (_args instanceof Array){
    this.subRules = _args;
  } else {
    this.subRules = arguments;
  }
  this.match = function(input){
    
  };
  this.simpleMatch = function(input){
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
  };
  
  this.combineMatch = function(input){
     var result = new Result();
     for (i = 0; i < this.subRules.length; i++){
       result.add(this.subRules[i].match(input));
     }
     return result;
  };

  this.anyMatch = function(input){
    //implement
  };

  this.forkMatch = function(input){
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
  };
}
  
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
  
  /*this.incr = function(){
    if (arguments.length == 1){
      this.index += arguments[0];
    } else {
      this.index++;
    }
  };*/
  
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

