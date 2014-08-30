/*
 * A simple peg parser for JavaScript, inspired by parslet.
 *
 * (c) Johannes Bechberger, GNU GPL v3 licenced
 * 
 * It currently supports the following operations:
 * - match_word/word
 * - end
 * - without/not
 * - times_range (`{min, max}` in regular expressions)
 * - any
 * - combine/and
 * - or
 * - create_rule
 * - rule (apply a rule)
 * 
 */

var PEGParser = {
	helpers: {
		addError: function(return_obj, expected){
			return_obj.error_stack.push({
				next_char: return_obj.next_char,
				expected : expected,
				actual   : return_obj.value 
			});
		},
		merge_rules: function(rules, new_rules){
			for (var rule in new_rules){
				if (!(rule in rules)){
					rules[rule] = new_rules[rule];
				} else if (rules[rule] instanceof Array) {
					rule_obj.push(new_rules[rule]);
				} else {
					rules[rule] = [rules[rule], new_rules[rule]];
				}
			}
		}
	},
	rules: {}
}

/**
 * Returns a parse function that matches the input against 
 * the given word.
 *
 * @param word given word string
 * @return parse function
 */
PEGParser.match_word = function(word){
	var parser = this;
	return function(input, next_char){
		var isCorrect = false;
		var value = ""; 
		if (input.length - next_char >= word.length){ // match the input against the passed word
			isCorrect = true;
			for (i = 0; i < word.length; i++){
				input_char = input.charAt(next_char + i); 
				value += input_char;
				if (input_char != word.charAt(i)){
					isCorrect = false;
					break;
				}
			}
		}   
		var return_obj = { 
			value      : value,
			next_char  : next_char + value.length,
			error_stack: [], 
			rules      : {}
		}   
		if (!isCorrect){
			parser.helpers.addError(return_obj, word);
		}                                                                 
		return return_obj;
	}
}

/**
 * Returns a parse function that matches the input against 
 * the given word.
 * Alias for the match_word function.
 *
 * @param word given word string
 * @return parse function
 */
PEGParser.word = function(word){
	return this.match_word(word);
}

/**
 * Returns a parse function that checks for the end 
 * of the input string.
 *
 * @return parse function
 */
PEGParser.end = function(){
	parser = this;
	return function(input, next_char){
		var return_obj = {
			value: "",
			next_char: next_char + 1,
			rules: {},
			error_stack: []
		};
		if (input.length > next_char){
			return_obj.value = input.charAt(input.length - 1);
			parser.helpers.addError(return_obj, "[end of input]");
		}
		return return_obj;		
	}
}

/**
 * Returns a function that matches the char, that doesn't begin
 * a string matched by the given parsing function.
 * 
 * @param parse_func given parsing function
 */
PEGParser.without = function(parse_func){
	var parser = this;
	return function(input, next_char){
		var return_obj = {
			value: "",
			next_char: next_char + 1,
			rules: {},
			error_stack: []
		};
		if (input.length > next_char){
			var res = parse_func(input, next_char);
			return_obj.value = res.value;
			if (res.error_stack.length > 0){
				return_obj.value = input.charAt(input.length - 1);
				return return_obj;
			} else {
				parser.helpers.addError(return_obj,
						"[not '" + res.value + "']"
				);
			}
		} else {
			parser.helpers.addError(return_obj, "[a char]");
		}
		return return_obj;
	}
}

/**
 * Returns a function that matches the char, that doesn't begin
 * a string matched by the given parsing function.
 * Alias for the without function. 
 * 
 * @param parse_func given parsing function
 */
PEGParser.not = function(parse_func){
	return this.without(parse_func);
}

/**
 * Returns a parse function that matches the given parse function
 * min to max times against the input.
 * Comparable to using `{min, max}` in a regular expression.
 *
 * @param min minimum times the given function has to match
 * @param max maximum times the given function has to match
 */
PEGParser.times_range = function(parse_func, min, max){
	var parser = this;
	return function(input, next_char){
		var return_obj = {
			value: "",
			next_char: next_char,
			rules: {},
			error_stack: []
		};
		for (i = 0; i < max; i++){
			var res = parse_func(input, return_obj.next_char);
			return_obj.next_char = res.next_char;
			return_obj.value += res.value;
			parser.helpers.merge_rules(return_obj.rules, res.rules);
			if (res.error_stack.length > 0){
				if (i < min){
					return_obj.error_stack = res.error_stack;
					parser.helpers.addError(return_obj,
						min + " times or more"
					);
				}
				return return_obj;
			}
		}                                                             
		return return_obj;
	}
}

/**
 * Alias for times_range(parse_func, 0, "Infinity")
 */
PEGParser.any = function(parse_func){
	return this.times_range(parse_func, 0, "Infinity");
}

/**
 * Alias for times_range(parse_func, 1, "Infinity")
 */
PEGParser.some = function(parse_func){
	return this.times_range(parse_func, 1, "Infinity");
}

/**
 * Joins the passed parsing functions to one.
 * Works with every number of parsing function as arguments.
 * 
 * @param parse_func parsing function
 * @return resulting parsing function
 */
PEGParser.combine = function(parse_func){
	var parser = this;
	var args = arguments;
	return function(input, next_char){
		var return_obj = {
			value: "",
			next_char: next_char,
			rules: {},
			error_stack: []
		};
		for (var arg_index in args){
			var arg = args[arg_index];
			var res = arg(input, return_obj.next_char);
			return_obj.next_char = res.next_char;
			return_obj.value += res.value;
			parser.helpers.merge_rules(return_obj.rules, res.rules);
			if (res.error_stack.length > 0){
				return_obj.error_stack = res.error_stack;
				var expected = return_obj.value;
				expected += res.error_stack[res.error_stack.length - 1].expected;
				parser.helpers.addError(return_obj, expected);
				return return_obj;
			}
		}                                                             
		return return_obj;
	}
}

/**
 * Joins the passed parsing functions to one.
 * Works with every number of parsing function as arguments.
 * Alias for the combine function.
 * 
 * @param parse_func parsing function
 * @return resulting parsing function
 */
PEGParser.and = function(parse_func){
	return this.combine.apply(this, [].slice.apply(arguments))	
}

/**
 * Joins the passed parsing functions to one by or-ring them.
 * Only one of passed functions has to match.
 * The resulting functions returns the result of the first matching
 * function.
 * Works with every number of parsing function as arguments.
 * 
 * @param parse_func parsing function
 * @return resulting parsing function
 */
PEGParser.or = function(parse_func){
	var parser = this;
	var args = arguments;
	return function(input, next_char){
		for (var arg_index in args){
			var arg = args[arg_index];
			var res = arg(input, next_char);
			if (res.error_stack.length > 0){
				if (arg_index == args.length - 1){
					return res;
				}
			} else {
				return res;
			}
		}                                                             
		return {
			value: "",
			next_char: next_char,
			rules: {},
			error_stack: []
		};
	}
}

/**
 * Creates a rule function of the given parse function.
 * 
 * @param name rule name
 * @param parse_func parse function
 */
PEGParser.create_rule = function(name, parse_func){
	var parser = this;
	this.rules[name] = function(input, next_char){
		var res_obj = parse_func(input, next_char);
		var return_obj = {
			value      : res_obj.value,
			next_char  : res_obj.next_char,
			error_stack: res_obj.error_stack,
			rules      : {}
		}
		return_obj.rules[name] = res_obj.rules;
		return_obj.rules[name].value = res_obj.value;
		if (res_obj.error_stack.length > 0){
			parser.helpers.addError(return_obj, "[Rule " + name + "]");
		}
		return return_obj;
	}
}

/*
 * Returns the function belonging to the named rule.
 * Throws an exception, if the rule doesn't exist.
 * 
 * @param name rule name
 * @return function belonging to the named rule
 */
PEGParser._rule = function(name){
	if (this.rules[name] === undefined){
		throw "No such rule " + name;
	}
	return this.rules[name];
}


/*
 * Returns a function that delegates the parsing 
 * to the rule with the given name.
 * Throws an exception, if the rule doesn't exist.
 * It's a lazy wrapper around the _rule function.
 * If in doubt, use this function.
 *
 * @param name rule name
 * @return result of the rule
 */
PEGParser.rule = function(name){
	var parser = this;
	return function(input, next_char){
		return parser._rule(name)(input, next_char);
	}
}

/**
 * Execute the given match function with the given input string.
 * @param match_func given match function
 * @param input given input string to be parsed
 * @result resulting parse tree like object
 */
PEGParser.exec = function(match_func, input){
	return match_func(input, 0, this.helpers, {});
}

/*
 * Some test code, replaced later by unit tests...
 * It shows example usage of the PEGParser.
 * Using `with (PEGParser){...}` reduces the redundancy.
 */
with (PEGParser){
//  console.log(exec(match_word("3"), "3"));
	create_rule("a_rule", match_word("3"));
	create_rule("a_rule2", rule("a_rule"));
	create_rule("other", match_word("4"));
//  console.log(exec(rule("a_rule"), "b"));
//  console.log(exec(some(rule("a_rule2"), 5, 10), ""));
//  console.log(exec(combine(rule("a_rule"), rule("a_rule2")), "3"));
// 	console.log(exec(or(rule("a_rule"), rule("other")), "4"));
//	console.log(exec(not(rule("other")), "4"));	
	console.log(exec(end(), "4"));
}