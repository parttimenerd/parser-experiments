
/*
 * A simple peg parser for JavaScript, inspired by parslet.
 *
 * (c) Johannes Bechberger, GNU GPL v3 licenced
 * 
 * It currently supports the following operations:
 * - match_word/word
 * - char_range
 * - lnbrk (linebreak)
 * - end
 * - without
 * - not
 * - times_range (`{min, max}` in regular expressions)
 * - any
 * - combine/and
 * - or
 * - create_rule
 * - rule (apply a rule)
 * 
 */

var PEGParser = function(){
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
						rules[rule].push(new_rules[rule]);
					} else {
						rules[rule] = [rules[rule], new_rules[rule]];
					}
				}
			},
			memoize: function(memo, next_char, tag, return_obj){
				if (memo[tag] === undefined){
					memo[tag] = {};
				}
				memo[tag][next_char] = return_obj;
			},
			is_memoized: function(memo, next_char, tag){
				return memo !== undefined && 
					memo[tag] !== undefined  && 
					memo[tag][next_char] !== undefined;
			},
			get_memoized: function(memo, next_char, tag){
				if (this.is_memoized(memo, next_char, tag)){
					return memo[tag][next_char];
				}
				return undefined;
			}
		},
		tree_helpers: {},
		rules: {}
	};
	
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
	 * Returns a function that matches a single char that is lexicographically
	 * between (or equals) the start_char and the end_char.
	 */
	PEGParser.char_range = function(start_char, end_char){
		var parser = this;
		if (start_char.length != 1 || end_char.length != 1){
			throw "char_range expects single chars as input";
		}
		return function(input, next_char){
			char = input.charAt(next_char);
			var return_obj = { 
				value      : char,
				next_char  : next_char + 1,
				error_stack: [], 
				rules      : {}
			}  
			//  		console.log("Test " + char + start_char + end_char);
			if (start_char.localeCompare(char) >= 1 || end_char.localeCompare(char) <= -1){
				// 			console.log("true");
				parser.helpers.addError(return_obj, "[" + start_char + end_char + "]");
			}      
			// 		console.log(return_obj);
			return return_obj;
		}
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
	 * Returns a parse function that checks a linebreak.
	 *
	 * @return parse function
	 */
	PEGParser.lbrk = function(){
		return PEGParser.and(PEGParser.any(PEGParser.word("\r")), PEGParser.word("\n"));
	}
	
	/**
	 * Returns a parse function that matches any whitespace (and tabs).
	 *
	 * @return parse function
	 */
	PEGParser.ws = function(min_number){
		if (min_number === undefined){
			min_number = 0;
		}
		return PEGParser.times_range(PEGParser.or(PEGParser.word(" "), PEGParser.word("\t")), min_number, Infinity);
	}
	
	/**
	 * Returns a function that matches the char, that doesn't begin
	 * a string matched by the given parsing function.
	 * 
	 * @param parse_func given parsing function
	 */
	PEGParser.not = function(parse_func){
		var parser = this;
		return function(input, next_char, memo){
			var return_obj = {
				value: "",
				next_char: next_char + 1,
				rules: {},
				error_stack: []
			};
			if (input.length > next_char){
				var res = parse_func(input, next_char, memo);
				return_obj.value = res.value;
				//it's expected that the called function fails
				if (res.error_stack.length > 0){
					return_obj.value = input.charAt(next_char);
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
	 * Returns a function that matches the string, that doesn't 
	 * contain a string matched by the given parsing function.
	 * Alias for the without function. 
	 * 
	 * @param parse_func given parsing function
	 */
	PEGParser.without = function(parse_func){
		return PEGParser.any(PEGParser.not(parse_func));
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
		return function(input, next_char, memo){
			var return_obj = {
				value: "",
				next_char: next_char,
				rules: {},
				error_stack: []
			};
			var last_return_obj = return_obj;
			for (i = 0; i < max; i++){
				var res = parse_func(input, return_obj.next_char, memo);
				return_obj = {
					next_char: res.next_char,
					value: return_obj.value + res.value,
					rules: return_obj.rules,
					error_stack: []
				};
// 				 			console.log(res);
				parser.helpers.merge_rules(return_obj.rules, res.rules);			
				if (res.error_stack.length > 0){
					if (i < min){
						return_obj.error_stack = res.error_stack;
						parser.helpers.addError(return_obj,
												min + " times or more"
						);
						return return_obj;
					}
					return last_return_obj;
				} else {
					last_return_obj = return_obj;
				}
			}                                                             
			return last_return_obj;
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
		return function(input, next_char, memo){
			var return_obj = {
				value: "",
				next_char: next_char,
				rules: {},
				error_stack: []
			};
			for (var arg_index in args){
				var arg = args[arg_index];
				var res = arg(input, return_obj.next_char, memo);
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
	PEGParser.and = PEGParser.combine;
	
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
		return function(input, next_char, memo){
			for (var arg_index in args){
				var arg = args[arg_index];
				var res = arg(input, next_char, memo);
// 				console.log(res);
				if (res.error_stack.length > 0){
					if (arg_index == args.length - 1){
// 						console.log("........", res);
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
	 * Name should't be 'value', 'next_char', 'error_stack' or  'rules'.
	 * 
	 * @param name rule name
	 * @param parse_func parse function
	 * @param rewrite_func (optional) function that gets the string result of parse_func
	 *                     and returns the extracted information, e.g. return a number
	 *                     for a numeric expression
	 */
	PEGParser.create_rule = function(name, parse_func, rewrite_func){
		var parser = this;
		if (this.rules[name] !== undefined){
			throw "Rule " + name + " already exists";
		}
		this.rules[name] = function(input, next_char, memo){
			var memo_tag = name;
			if (parser.helpers.is_memoized(memo, next_char, memo_tag)){
				return parser.helpers.get_memoized(memo, next_char, memo_tag);
			}
			var res_obj = parse_func(input, next_char, memo);
			var return_obj = {
				value      : res_obj.value,
				next_char  : res_obj.next_char,
				error_stack: res_obj.error_stack,
				rules      : {}
			}
			return_obj.rules[name] = res_obj.rules;
			var val = res_obj.value;
			if (rewrite_func !== undefined && res_obj.error_stack.length == 0){
				val = rewrite_func(val);
			}
			return_obj.rules[name].value = val;
			if (res_obj.error_stack.length > 0){
				parser.helpers.addError(return_obj, 
										"[Rule " + name + "]"
				);
			}
			parser.helpers.memoize(memo, next_char, memo_tag, return_obj);
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
		if (name === "value"){
			throw "A rule can't be named 'value'.";
		}
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
	 * It calls the create_rule function if more than one argument 
	 * is passed, e.g. `rule("abc", word("as"))`.
	 *
	 * Name should't be 'value'.
	 * 
	 * @param name rule name
	 * @return result of the rule
	 */
	PEGParser.rule = function(name){
		var parser = this;
		if (arguments.length == 1){
			return function(input, next_char, memo){
				return parser._rule(name)(input, next_char, memo);
			}
		} else {
			return parser.create_rule.apply(this, [].slice.apply(arguments));
		}
	}
	
	/**
	 * Execute the given match function with the given input string.
	 * @param match_func given match function
	 * @param input given input string to be parsed
	 * @result resulting parse tree like object
	 */
	PEGParser.exec = function(match_func, input){
		return match_func(input, 0, {});
	}
	
	PEGParser.hasError = function(exec_result){
		return exec_result.error_stack.length > 0;
	}
	
	/**
	 * Normalizes the result of the exec function.
	 * Can only be used with exec results without errors.
	 */
	PEGParser.normalize = function(exec_result){
		if (PEGParser.hasError(exec_result)){
			throw "Exec result has error.";
		}
		var ret_obj = {};
		ret_obj = exec_result.rules;
		ret_obj.value = exec_result.value;
		
		var processRule = function(rule_obj){
			for (var rule in rule_obj){
				if (rule === "value"){
					continue;
				}

				if (!(rule_obj[rule] instanceof Array)) {
					rule_obj[rule] = [rule_obj[rule]];
				}
				for (var child_rule_obj in rule_obj[rule]){
					processRule(rule_obj[rule][child_rule_obj]);
				}
			}	
		}
		
		processRule(ret_obj);
		return ret_obj;
	}
	
	PEGParser.tree_helpers.is_leaf_object = function(tree_object){
		return tree_object.length > 1;
	}
	
	PEGParser.tree_helpers.extend = function(expected_structure, actual_tree_object){
		for (var expected_key in expected_structure){
			if (actual_tree_object[expected_key] === undefined){
				actual_tree_object[expected_key] = expected_structure[expected_key];
			}
		}
	}
	
	return PEGParser;
}

if (module !== undefined){
	module.exports = {
		parser: PEGParser
	}
}

var Interpreter = require("./interpreter.js");
if (module !== undefined){
	module.exports.interpreter = Interpreter;
}